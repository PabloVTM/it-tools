import { describe, expect, it } from 'vitest';
import * as forge from 'node-forge';
import { decodeCsr } from '../csr-decoder/csr-decoder.service';
import {
  type CsrOptions,
  buildOpensslConfig,
  collectSans,
  generateCsr,
  validateCsrOptions,
} from './csr-generator.service';
import {
  EC_P256_ENCRYPTED_PKCS8_PRIVATE_KEY,
  EC_P384_SEC1_PRIVATE_KEY,
  RSA_PKCS1_PRIVATE_KEY,
  RSA_PUBLIC_KEY,
} from './csr-generator.fixtures';

function options(overrides: Partial<CsrOptions> = {}): CsrOptions {
  return {
    subject: {
      commonName: 'www.example.com',
      organizationName: 'Example',
      organizationalUnit: 'IT',
      locality: 'Paris',
      state: 'Ile-de-France',
      country: 'fr',
      emailAddress: 'admin@example.com',
    },
    subjectAlternativeNames: 'example.com\n10.0.0.1, admin@example.com\nURI:https://example.com',
    includeCommonNameInSan: true,
    keySource: 'generate',
    keyAlgorithm: 'ECDSA-P256',
    hash: 'SHA-256',
    keyUsages: ['digitalSignature', 'keyEncipherment'],
    keyUsageCritical: true,
    extendedKeyUsages: ['serverAuth', 'clientAuth'],
    isCA: false,
    ...overrides,
  };
}

describe('csr-generator', () => {
  it('validates the subject and SANs', () => {
    expect(validateCsrOptions(options())).toEqual([]);
    expect(validateCsrOptions(options({ subject: { commonName: ' ' } }))).toContain('common-name-required');
    expect(validateCsrOptions(options({ subject: { commonName: 'a.com', country: 'France' } }))).toContain(
      'country-two-letters',
    );
    expect(validateCsrOptions(options({ subjectAlternativeNames: 'bad_name!.com' }))).toContain('invalid-san');
    expect(validateCsrOptions(options({ keySource: 'existing', existingPrivateKeyPem: '' }))).toContain(
      'existing-key-required',
    );
  });

  it('puts the common name first in the SANs without duplicates', () => {
    expect(collectSans(options())).toEqual([
      { type: 'dns', value: 'www.example.com' },
      { type: 'dns', value: 'example.com' },
      { type: 'ip', value: '10.0.0.1' },
      { type: 'email', value: 'admin@example.com' },
      { type: 'url', value: 'https://example.com' },
    ]);
    expect(collectSans(options({ subjectAlternativeNames: 'www.example.com' }))).toHaveLength(1);
  });

  it('generates an ECDSA CSR that decodes with every requested field', async () => {
    const result = await generateCsr(options());
    expect(result.csrPem).toMatch(/^-----BEGIN CERTIFICATE REQUEST-----/);
    expect(result.privateKeyPem).toMatch(/^-----BEGIN PRIVATE KEY-----/);
    expect(result.keyDescription).toBe('ECDSA P-256');

    const decoded = await decodeCsr(result.csrPem);
    expect(decoded.signatureValid).toBe(true);
    expect(decoded.publicKey).toMatchObject({ algorithm: 'ECDSA', curve: 'P-256' });
    expect(decoded.subject.find((s) => s.name === 'C')?.value).toBe('FR');
    expect(decoded.subject.find((s) => s.name === 'CN')?.value).toBe('www.example.com');
    expect(decoded.subjectAlternativeNames.map((s) => s.value)).toEqual([
      'www.example.com',
      'example.com',
      '10.0.0.1',
      'admin@example.com',
      'https://example.com',
    ]);
    expect(decoded.keyUsages).toEqual(['digitalSignature', 'keyEncipherment']);
    expect(decoded.keyUsageCritical).toBe(true);
    expect(decoded.extendedKeyUsages).toEqual(['serverAuth', 'clientAuth']);
    expect(decoded.warnings).toEqual([]);
  });

  it('generates an RSA CSR with an encrypted key, CA constraints and a challenge password', async () => {
    const result = await generateCsr(
      options({
        keyAlgorithm: 'RSA-2048',
        hash: 'SHA-384',
        privateKeyPassphrase: 'secret',
        isCA: true,
        pathLength: 0,
        keyUsages: ['keyCertSign', 'cRLSign'],
        extendedKeyUsages: [],
        challengePassword: 'challenge',
      }),
    );
    expect(result.privateKeyPem).toMatch(/^-----BEGIN ENCRYPTED PRIVATE KEY-----/);
    const decrypted = forge.pki.decryptRsaPrivateKey(result.privateKeyPem, 'secret');
    expect(decrypted.n.bitLength()).toBe(2048);

    const decoded = await decodeCsr(result.csrPem);
    expect(decoded.signatureValid).toBe(true);
    expect(decoded.publicKey).toMatchObject({ algorithm: 'RSA', size: 2048 });
    expect(decoded.signatureAlgorithm).toContain('SHA-384');
    expect(decoded.basicConstraints).toEqual({ ca: true, pathLength: 0, critical: true });
    expect(decoded.challengePassword).toBe('challenge');
    expect(decoded.warnings).toEqual(['is-ca']);
  });

  it('signs with an existing PKCS#1 RSA key and an SEC1 EC key', async () => {
    const rsaResult = await generateCsr(
      options({ keySource: 'existing', existingPrivateKeyPem: RSA_PKCS1_PRIVATE_KEY }),
    );
    expect(rsaResult.privateKeyPem).toBe('');
    expect(rsaResult.keyDescription).toBe('RSA 2048 bits');
    expect(rsaResult.publicKeyPem.replace(/\s/g, '')).toBe(RSA_PUBLIC_KEY.replace(/\s/g, ''));
    expect((await decodeCsr(rsaResult.csrPem)).signatureValid).toBe(true);

    const ecResult = await generateCsr(
      options({ keySource: 'existing', existingPrivateKeyPem: EC_P384_SEC1_PRIVATE_KEY }),
    );
    expect(ecResult.keyDescription).toBe('ECDSA P-384');
    const decoded = await decodeCsr(ecResult.csrPem);
    expect(decoded.signatureValid).toBe(true);
    expect(decoded.publicKey.curve).toBe('P-384');
  });

  it('imports an encrypted PKCS#8 key and reports a wrong passphrase', async () => {
    const result = await generateCsr(
      options({
        keySource: 'existing',
        existingPrivateKeyPem: EC_P256_ENCRYPTED_PKCS8_PRIVATE_KEY,
        existingKeyPassphrase: 'pass',
      }),
    );
    expect((await decodeCsr(result.csrPem)).signatureValid).toBe(true);
    await expect(
      generateCsr(
        options({
          keySource: 'existing',
          existingPrivateKeyPem: EC_P256_ENCRYPTED_PKCS8_PRIVATE_KEY,
          existingKeyPassphrase: 'wrong',
        }),
      ),
    ).rejects.toThrow('wrong-passphrase');
  });

  it('builds an equivalent OpenSSL config', () => {
    const config = buildOpensslConfig(options({ keyAlgorithm: 'RSA-4096' }), collectSans(options()));
    expect(config).toContain('default_bits       = 4096');
    expect(config).toContain('C = FR');
    expect(config).toContain('keyUsage         = critical, digitalSignature, keyEncipherment');
    expect(config).toContain('extendedKeyUsage = serverAuth, clientAuth');
    expect(config).toContain('DNS.1 = www.example.com');
    expect(config).toContain('DNS.2 = example.com');
    expect(config).toContain('IP.1 = 10.0.0.1');
    expect(config).toContain('email.1 = admin@example.com');
    expect(config).toContain('URI.1 = https://example.com');
  });
});
