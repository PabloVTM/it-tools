import * as x509 from '@/utils/x509';
import * as forge from 'node-forge';

// Shared helpers for the CSR generator and CSR decoder tools.

export const KEY_USAGES = [
  { name: 'digitalSignature', flag: x509.KeyUsageFlags.digitalSignature },
  { name: 'nonRepudiation', flag: x509.KeyUsageFlags.nonRepudiation },
  { name: 'keyEncipherment', flag: x509.KeyUsageFlags.keyEncipherment },
  { name: 'dataEncipherment', flag: x509.KeyUsageFlags.dataEncipherment },
  { name: 'keyAgreement', flag: x509.KeyUsageFlags.keyAgreement },
  { name: 'keyCertSign', flag: x509.KeyUsageFlags.keyCertSign },
  { name: 'cRLSign', flag: x509.KeyUsageFlags.cRLSign },
  { name: 'encipherOnly', flag: x509.KeyUsageFlags.encipherOnly },
  { name: 'decipherOnly', flag: x509.KeyUsageFlags.decipherOnly },
] as const;
export type KeyUsageName = (typeof KEY_USAGES)[number]['name'];

export const EXTENDED_KEY_USAGES = [
  { name: 'serverAuth', oid: '1.3.6.1.5.5.7.3.1' },
  { name: 'clientAuth', oid: '1.3.6.1.5.5.7.3.2' },
  { name: 'codeSigning', oid: '1.3.6.1.5.5.7.3.3' },
  { name: 'emailProtection', oid: '1.3.6.1.5.5.7.3.4' },
  { name: 'timeStamping', oid: '1.3.6.1.5.5.7.3.8' },
  { name: 'OCSPSigning', oid: '1.3.6.1.5.5.7.3.9' },
] as const;
export type ExtendedKeyUsageName = (typeof EXTENDED_KEY_USAGES)[number]['name'];

export const SUBJECT_ATTRIBUTES = [
  { key: 'country', short: 'C', oid: '2.5.4.6' },
  { key: 'state', short: 'ST', oid: '2.5.4.8' },
  { key: 'locality', short: 'L', oid: '2.5.4.7' },
  { key: 'organizationName', short: 'O', oid: '2.5.4.10' },
  { key: 'organizationalUnit', short: 'OU', oid: '2.5.4.11' },
  { key: 'commonName', short: 'CN', oid: '2.5.4.3' },
  { key: 'emailAddress', short: 'emailAddress', oid: '1.2.840.113549.1.9.1' },
] as const;
export type SubjectKey = (typeof SUBJECT_ATTRIBUTES)[number]['key'];

export type SanType = 'dns' | 'ip' | 'email' | 'url';
export interface SanEntry {
  type: SanType;
  value: string;
}

const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;

export function isIpAddress(value: string) {
  if (IPV4.test(value)) {
    return true;
  }
  // IPv6: hex groups and colons, at least two colons
  return /^[0-9a-f:]+$/i.test(value) && (value.match(/:/g) ?? []).length >= 2;
}

export function classifySan(raw: string): SanEntry {
  const value = raw.trim().replace(/^(dns|ip|email|uri|url):\s*/i, '');
  const prefix = raw
    .trim()
    .match(/^(dns|ip|email|uri|url):/i)?.[1]
    ?.toLowerCase();
  if (prefix === 'ip' || (!prefix && isIpAddress(value))) {
    return { type: 'ip', value };
  }
  if (prefix === 'email' || (!prefix && /^[^@\s]+@[^@\s]+$/.test(value))) {
    return { type: 'email', value };
  }
  if (prefix === 'uri' || prefix === 'url' || (!prefix && /^[a-z][a-z0-9+.-]*:\/\//i.test(value))) {
    return { type: 'url', value };
  }
  return { type: 'dns', value: value.toLowerCase() };
}

// Accepts one entry per line or comma separated, with optional "DNS:", "IP:",
// "email:" or "URI:" prefixes as in OpenSSL configs.
export function parseSanList(input: string): SanEntry[] {
  const seen = new Set<string>();
  return input
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(classifySan)
    .filter((san) => {
      const key = `${san.type}:${san.value}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
}

export function isValidDnsName(value: string) {
  return /^(\*\.)?([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/i.test(value);
}

export function keyUsagesToFlags(names: KeyUsageName[]) {
  return KEY_USAGES.filter((u) => names.includes(u.name)).reduce((flags, u) => flags | u.flag, 0);
}

export function flagsToKeyUsages(flags: number): KeyUsageName[] {
  return KEY_USAGES.filter((u) => (flags & u.flag) !== 0).map((u) => u.name);
}

export function extendedKeyUsageName(oid: string) {
  return EXTENDED_KEY_USAGES.find((u) => u.oid === oid)?.name ?? oid;
}

export function toPem(der: ArrayBuffer | Uint8Array, label: string) {
  const bytes = der instanceof Uint8Array ? der : new Uint8Array(der);
  return x509.PemConverter.encode(bytes.slice().buffer, label);
}

export function bytesToHex(buffer: ArrayBuffer, separator = ':') {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(separator);
}

// ---- Private key import --------------------------------------------------

export type KeyAlgorithmId = 'RSA-2048' | 'RSA-3072' | 'RSA-4096' | 'ECDSA-P256' | 'ECDSA-P384' | 'ECDSA-P521';
export type HashAlgorithm = 'SHA-256' | 'SHA-384' | 'SHA-512';

const CURVE_OIDS: Record<string, 'P-256' | 'P-384' | 'P-521'> = {
  '1.2.840.10045.3.1.7': 'P-256',
  '1.3.132.0.34': 'P-384',
  '1.3.132.0.35': 'P-521',
};
const OID_RSA = '1.2.840.113549.1.1.1';
const OID_EC = '1.2.840.10045.2.1';

export class KeyImportError extends Error {
  constructor(public readonly code: 'unsupported-format' | 'unsupported-algorithm' | 'wrong-passphrase') {
    super(code);
  }
}

function derFromForgeAsn1(asn1: forge.asn1.Asn1) {
  const bytes = forge.asn1.toDer(asn1).getBytes();
  return Uint8Array.from(bytes, (c) => c.charCodeAt(0));
}

// Wraps an SEC1 "EC PRIVATE KEY" into a PKCS#8 PrivateKeyInfo.
function sec1ToPkcs8(sec1Der: string) {
  const sec1 = forge.asn1.fromDer(sec1Der);
  const parameters = (sec1.value as forge.asn1.Asn1[]).find(
    (node) => node.tagClass === forge.asn1.Class.CONTEXT_SPECIFIC && node.type === 0,
  );
  const curveNode = parameters && (parameters.value as forge.asn1.Asn1[])[0];
  if (!curveNode) {
    throw new KeyImportError('unsupported-format');
  }
  const curveOid = forge.asn1.derToOid(curveNode.value as string);
  const { asn1 } = forge;
  return asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.INTEGER, false, asn1.integerToDer(0).getBytes()),
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
      asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OID, false, asn1.oidToDer(OID_EC).getBytes()),
      asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OID, false, asn1.oidToDer(curveOid).getBytes()),
    ]),
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OCTETSTRING, false, sec1Der),
  ]);
}

// Normalises any supported private key PEM into an unencrypted PKCS#8 ASN.1 structure.
function privateKeyPemToPkcs8(pem: string, passphrase: string): forge.asn1.Asn1 {
  const label = pem.match(/-----BEGIN ([A-Z ]+)-----/)?.[1];
  const isLegacyEncrypted = /Proc-Type:\s*4,ENCRYPTED/.test(pem);
  try {
    if (label === 'ENCRYPTED PRIVATE KEY') {
      const decrypted = forge.pki.decryptPrivateKeyInfo(forge.pki.encryptedPrivateKeyFromPem(pem), passphrase);
      if (!decrypted) {
        throw new KeyImportError('wrong-passphrase');
      }
      return decrypted;
    }
    if (label === 'RSA PRIVATE KEY') {
      const key = isLegacyEncrypted
        ? forge.pki.decryptRsaPrivateKey(pem, passphrase)
        : forge.pki.privateKeyFromPem(pem);
      if (!key) {
        throw new KeyImportError('wrong-passphrase');
      }
      return forge.pki.wrapRsaPrivateKey(forge.pki.privateKeyToAsn1(key));
    }
    if (label === 'EC PRIVATE KEY') {
      if (isLegacyEncrypted) {
        throw new KeyImportError('unsupported-format');
      }
      return sec1ToPkcs8(forge.pem.decode(pem)[0].body);
    }
    if (label === 'PRIVATE KEY') {
      return forge.asn1.fromDer(forge.pem.decode(pem)[0].body);
    }
  } catch (e) {
    if (e instanceof KeyImportError) {
      throw e;
    }
    throw new KeyImportError(
      isLegacyEncrypted || label === 'ENCRYPTED PRIVATE KEY' ? 'wrong-passphrase' : 'unsupported-format',
    );
  }
  throw new KeyImportError('unsupported-format');
}

export interface ImportedKey {
  keys: CryptoKeyPair;
  family: 'RSA' | 'ECDSA';
  description: string;
}

export async function importPrivateKey(pem: string, passphrase: string, hash: HashAlgorithm): Promise<ImportedKey> {
  const pkcs8 = privateKeyPemToPkcs8(pem.trim(), passphrase);
  const algorithmIdentifier = (pkcs8.value as forge.asn1.Asn1[])[1];
  const [algOidNode, paramNode] = algorithmIdentifier.value as forge.asn1.Asn1[];
  const algOid = forge.asn1.derToOid(algOidNode.value as string);
  const der = derFromForgeAsn1(pkcs8);

  let importAlgorithm: RsaHashedImportParams | EcKeyImportParams;
  let family: ImportedKey['family'];
  if (algOid === OID_RSA) {
    importAlgorithm = { name: 'RSASSA-PKCS1-v1_5', hash };
    family = 'RSA';
  } else if (algOid === OID_EC) {
    const curve = CURVE_OIDS[forge.asn1.derToOid(paramNode.value as string)];
    if (!curve) {
      throw new KeyImportError('unsupported-algorithm');
    }
    importAlgorithm = { name: 'ECDSA', namedCurve: curve };
    family = 'ECDSA';
  } else {
    throw new KeyImportError('unsupported-algorithm');
  }

  const privateKey = await crypto.subtle.importKey('pkcs8', der, importAlgorithm, true, ['sign']);
  // WebCrypto cannot derive a public key directly, but the private JWK carries the public part.
  const {
    d: _d,
    p: _p,
    q: _q,
    dp: _dp,
    dq: _dq,
    qi: _qi,
    ...publicJwk
  } = await crypto.subtle.exportKey('jwk', privateKey);
  const publicKey = await crypto.subtle.importKey('jwk', { ...publicJwk, key_ops: ['verify'] }, importAlgorithm, true, [
    'verify',
  ]);
  const algorithm = privateKey.algorithm as RsaHashedKeyAlgorithm & EcKeyAlgorithm;
  const description = family === 'RSA' ? `RSA ${algorithm.modulusLength} bits` : `ECDSA ${algorithm.namedCurve}`;
  return { keys: { privateKey, publicKey }, family, description };
}

export async function generateKeyPair(keyAlgorithm: KeyAlgorithmId, hash: HashAlgorithm) {
  const [family, size] = keyAlgorithm.split('-');
  const algorithm: RsaHashedKeyGenParams | EcKeyGenParams =
    family === 'RSA'
      ? {
          name: 'RSASSA-PKCS1-v1_5',
          modulusLength: Number(size),
          publicExponent: new Uint8Array([1, 0, 1]),
          hash,
        }
      : { name: 'ECDSA', namedCurve: `P-${size.slice(1)}` };
  const keys = (await crypto.subtle.generateKey(algorithm, true, ['sign', 'verify'])) as CryptoKeyPair;
  return { keys, family: family as 'RSA' | 'ECDSA' };
}
