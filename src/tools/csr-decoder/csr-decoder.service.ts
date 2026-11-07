import * as x509 from '@/utils/x509';
import {
  SUBJECT_ATTRIBUTES,
  type SanEntry,
  bytesToHex,
  extendedKeyUsageName,
  flagsToKeyUsages,
  toPem,
} from '@/utils/x509-csr';

export type CsrWarning =
  | 'invalid-signature'
  | 'weak-rsa-key'
  | 'weak-hash'
  | 'no-san'
  | 'cn-not-in-san'
  | 'country-not-two-letters'
  | 'is-ca';

export interface DecodedCsr {
  subject: Array<{ name: string; oid: string; value: string }>;
  subjectString: string;
  publicKey: {
    algorithm: string;
    size?: number;
    curve?: string;
    sha256Fingerprint: string;
    pem: string;
  };
  signatureAlgorithm: string;
  signatureValid: boolean;
  subjectAlternativeNames: SanEntry[];
  keyUsages: string[];
  keyUsageCritical?: boolean;
  extendedKeyUsages: string[];
  basicConstraints?: { ca: boolean; pathLength?: number; critical: boolean };
  otherExtensions: Array<{ oid: string; critical: boolean }>;
  challengePassword?: string;
  warnings: CsrWarning[];
}

const SUBJECT_NAMES: Record<string, string> = Object.fromEntries(SUBJECT_ATTRIBUTES.map((a) => [a.oid, a.short]));
const OTHER_NAMES: Record<string, string> = {
  '2.5.4.5': 'serialNumber',
  '2.5.4.9': 'street',
  '2.5.4.17': 'postalCode',
  '2.5.4.12': 'title',
  '2.5.4.42': 'givenName',
  '2.5.4.4': 'surname',
  '0.9.2342.19200300.100.1.25': 'DC',
  '0.9.2342.19200300.100.1.1': 'UID',
};
const KNOWN_EXTENSIONS = new Set(['2.5.29.17', '2.5.29.15', '2.5.29.37', '2.5.29.19']);

function normalizeInput(input: string) {
  const trimmed = input.trim();
  // "NEW CERTIFICATE REQUEST" is the label used by older tools (Microsoft, Java keytool).
  return trimmed.replace(/-----(BEGIN|END) NEW CERTIFICATE REQUEST-----/g, '-----$1 CERTIFICATE REQUEST-----');
}

function hashName(algorithm: x509.HashedAlgorithm | Algorithm) {
  const hash = (algorithm as x509.HashedAlgorithm).hash;
  return typeof hash === 'string' ? hash : (hash?.name ?? '');
}

async function describePublicKey(publicKey: x509.PublicKey) {
  const fingerprint = await crypto.subtle.digest('SHA-256', publicKey.rawData);
  const result: DecodedCsr['publicKey'] = {
    algorithm: publicKey.algorithm.name,
    sha256Fingerprint: bytesToHex(fingerprint),
    pem: toPem(publicKey.rawData, 'PUBLIC KEY'),
  };
  try {
    const key = await publicKey.export();
    const algorithm = key.algorithm as RsaHashedKeyAlgorithm & EcKeyAlgorithm;
    if (algorithm.modulusLength) {
      result.algorithm = 'RSA';
      result.size = algorithm.modulusLength;
    }
    if (algorithm.namedCurve) {
      result.algorithm = 'ECDSA';
      result.curve = algorithm.namedCurve;
      result.size = Number(algorithm.namedCurve.replace('P-', ''));
    }
  } catch {
    // Algorithms WebCrypto cannot import (DSA, some curves) keep the generic name.
  }
  return result;
}

export async function decodeCsr(input: string): Promise<DecodedCsr> {
  const csr = new x509.Pkcs10CertificateRequest(normalizeInput(input));

  const subject = csr.subjectName.toJSON().flatMap((rdn) =>
    Object.entries(rdn).flatMap(([type, values]) =>
      values.map((value) => {
        const oid = /^\d+(\.\d+)+$/.test(type) ? type : (SUBJECT_ATTRIBUTES.find((a) => a.short === type)?.oid ?? type);
        return { name: SUBJECT_NAMES[oid] ?? OTHER_NAMES[oid] ?? type, oid, value };
      }),
    ),
  );

  const sanExtension = csr.getExtension('2.5.29.17') as x509.SubjectAlternativeNameExtension | null;
  const subjectAlternativeNames: SanEntry[] = sanExtension
    ? sanExtension.names.toJSON().map((name) => ({ type: name.type as SanEntry['type'], value: name.value }))
    : [];

  const keyUsageExtension = csr.getExtension('2.5.29.15') as x509.KeyUsagesExtension | null;
  const ekuExtension = csr.getExtension('2.5.29.37') as x509.ExtendedKeyUsageExtension | null;
  const basicConstraintsExtension = csr.getExtension('2.5.29.19') as x509.BasicConstraintsExtension | null;
  const challengePassword = (csr.getAttribute('1.2.840.113549.1.9.7') as x509.ChallengePasswordAttribute | null)
    ?.password;

  const publicKey = await describePublicKey(csr.publicKey);
  const signatureHash = hashName(csr.signatureAlgorithm);
  const signatureAlgorithm = [csr.signatureAlgorithm.name, signatureHash].filter(Boolean).join(' / ');
  const signatureValid = await csr.verify().catch(() => false);

  const decoded: DecodedCsr = {
    subject,
    subjectString: csr.subject,
    publicKey,
    signatureAlgorithm,
    signatureValid,
    subjectAlternativeNames,
    keyUsages: keyUsageExtension ? flagsToKeyUsages(keyUsageExtension.usages) : [],
    keyUsageCritical: keyUsageExtension?.critical,
    extendedKeyUsages: ekuExtension ? ekuExtension.usages.map((oid) => extendedKeyUsageName(String(oid))) : [],
    basicConstraints: basicConstraintsExtension
      ? {
          ca: basicConstraintsExtension.ca,
          pathLength: basicConstraintsExtension.pathLength,
          critical: basicConstraintsExtension.critical,
        }
      : undefined,
    otherExtensions: csr.extensions
      .filter((extension) => !KNOWN_EXTENSIONS.has(extension.type))
      .map((extension) => ({ oid: extension.type, critical: extension.critical })),
    challengePassword,
    warnings: [],
  };
  decoded.warnings = computeWarnings(decoded, signatureHash);
  return decoded;
}

function computeWarnings(csr: DecodedCsr, signatureHash: string): CsrWarning[] {
  const warnings: CsrWarning[] = [];
  if (!csr.signatureValid) {
    warnings.push('invalid-signature');
  }
  if (csr.publicKey.algorithm === 'RSA' && (csr.publicKey.size ?? 0) < 2048) {
    warnings.push('weak-rsa-key');
  }
  if (/sha-?1$|md5/i.test(signatureHash)) {
    warnings.push('weak-hash');
  }
  const cn = csr.subject.find((item) => item.name === 'CN')?.value.toLowerCase();
  if (!csr.subjectAlternativeNames.length) {
    warnings.push('no-san');
  } else if (cn && !cn.includes(' ') && !csr.subjectAlternativeNames.some((san) => san.value.toLowerCase() === cn)) {
    warnings.push('cn-not-in-san');
  }
  const country = csr.subject.find((item) => item.name === 'C')?.value;
  if (country && !/^[A-Z]{2}$/.test(country)) {
    warnings.push('country-not-two-letters');
  }
  if (csr.basicConstraints?.ca) {
    warnings.push('is-ca');
  }
  return warnings;
}
