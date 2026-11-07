import { describe, expect, it } from 'vitest';
import * as forge from 'node-forge';
import { decodeCsr } from './csr-decoder.service';

function legacyCsr() {
  // 1024-bit RSA, SHA-1, no SAN, non ISO country: everything the decoder should flag
  const keys = forge.pki.rsa.generateKeyPair({ bits: 1024, e: 0x10001 });
  const csr = forge.pki.createCertificationRequest();
  csr.publicKey = keys.publicKey;
  csr.setSubject([
    { name: 'commonName', value: 'legacy.example.com' },
    { name: 'countryName', value: 'France' },
  ]);
  csr.sign(keys.privateKey, forge.md.sha1.create());
  return forge.pki.certificationRequestToPem(csr);
}

describe('csr-decoder', () => {
  it('decodes a legacy CSR and reports its weaknesses', async () => {
    const decoded = await decodeCsr(legacyCsr());
    expect(decoded.signatureValid).toBe(true);
    expect(decoded.publicKey).toMatchObject({ algorithm: 'RSA', size: 1024 });
    expect(decoded.publicKey.sha256Fingerprint).toMatch(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);
    expect(decoded.subject).toEqual([
      { name: 'CN', oid: '2.5.4.3', value: 'legacy.example.com' },
      { name: 'C', oid: '2.5.4.6', value: 'France' },
    ]);
    expect(decoded.warnings).toEqual(['weak-rsa-key', 'weak-hash', 'no-san', 'country-not-two-letters']);
  });

  it('accepts the NEW CERTIFICATE REQUEST label and base64 without armor', async () => {
    const pem = legacyCsr();
    const newLabel = pem.replace(/CERTIFICATE REQUEST/g, 'NEW CERTIFICATE REQUEST');
    expect((await decodeCsr(newLabel)).subject[0].value).toBe('legacy.example.com');

    const base64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s/g, '');
    expect((await decodeCsr(base64)).subject[0].value).toBe('legacy.example.com');
  });

  it('flags a tampered signature', async () => {
    const pem = legacyCsr();
    const der = forge.util.decode64(pem.replace(/-----[^-]+-----/g, '').replace(/\s/g, ''));
    // flip a byte in the subject, inside the signed part
    const index = der.indexOf('legacy');
    const tampered = `${der.slice(0, index)}L${der.slice(index + 1)}`;
    const decoded = await decodeCsr(forge.util.encode64(tampered));
    expect(decoded.signatureValid).toBe(false);
    expect(decoded.warnings).toContain('invalid-signature');
  });

  it('throws on input that is not a CSR', async () => {
    await expect(decodeCsr('not a csr')).rejects.toThrow();
  });
});
