import * as x509 from '@/utils/x509';
import * as forge from 'node-forge';
import {
  EXTENDED_KEY_USAGES,
  type ExtendedKeyUsageName,
  type HashAlgorithm,
  type KeyAlgorithmId,
  type KeyUsageName,
  SUBJECT_ATTRIBUTES,
  type SanEntry,
  type SubjectKey,
  generateKeyPair,
  importPrivateKey,
  isIpAddress,
  isValidDnsName,
  keyUsagesToFlags,
  parseSanList,
  toPem,
} from '@/utils/x509-csr';

export type CsrSubject = Partial<Record<SubjectKey, string>>;

export interface CsrOptions {
  subject: CsrSubject;
  subjectAlternativeNames: string;
  includeCommonNameInSan: boolean;
  keySource: 'generate' | 'existing';
  keyAlgorithm: KeyAlgorithmId;
  existingPrivateKeyPem?: string;
  existingKeyPassphrase?: string;
  hash: HashAlgorithm;
  keyUsages: KeyUsageName[];
  keyUsageCritical: boolean;
  extendedKeyUsages: ExtendedKeyUsageName[];
  isCA: boolean;
  pathLength?: number | null;
  challengePassword?: string;
  privateKeyPassphrase?: string;
}

export interface CsrResult {
  csrPem: string;
  privateKeyPem: string;
  publicKeyPem: string;
  keyDescription: string;
  sans: SanEntry[];
  opensslConfig: string;
  opensslCommands: string;
}

export const USAGE_PRESETS: Record<
  string,
  { keyUsages: KeyUsageName[]; extendedKeyUsages: ExtendedKeyUsageName[]; isCA: boolean }
> = {
  'tls-server': { keyUsages: ['digitalSignature', 'keyEncipherment'], extendedKeyUsages: ['serverAuth'], isCA: false },
  'tls-client': { keyUsages: ['digitalSignature'], extendedKeyUsages: ['clientAuth'], isCA: false },
  'tls-server-client': {
    keyUsages: ['digitalSignature', 'keyEncipherment'],
    extendedKeyUsages: ['serverAuth', 'clientAuth'],
    isCA: false,
  },
  'code-signing': { keyUsages: ['digitalSignature'], extendedKeyUsages: ['codeSigning'], isCA: false },
  smime: {
    keyUsages: ['digitalSignature', 'keyEncipherment', 'nonRepudiation'],
    extendedKeyUsages: ['emailProtection'],
    isCA: false,
  },
  'intermediate-ca': { keyUsages: ['keyCertSign', 'cRLSign', 'digitalSignature'], extendedKeyUsages: [], isCA: true },
};

export type CsrValidationError =
  | 'common-name-required'
  | 'country-two-letters'
  | 'invalid-san'
  | 'existing-key-required'
  | 'invalid-path-length';

export function validateCsrOptions(options: CsrOptions): CsrValidationError[] {
  const errors: CsrValidationError[] = [];
  if (!options.subject.commonName?.trim()) {
    errors.push('common-name-required');
  }
  const country = options.subject.country?.trim();
  if (country && !/^[A-Z]{2}$/i.test(country)) {
    errors.push('country-two-letters');
  }
  const sans = parseSanList(options.subjectAlternativeNames);
  if (sans.some((san) => san.type === 'dns' && !isValidDnsName(san.value))) {
    errors.push('invalid-san');
  }
  if (options.keySource === 'existing' && !options.existingPrivateKeyPem?.trim()) {
    errors.push('existing-key-required');
  }
  if (options.isCA && options.pathLength != null && (options.pathLength < 0 || !Number.isInteger(options.pathLength))) {
    errors.push('invalid-path-length');
  }
  return errors;
}

export function collectSans(
  options: Pick<CsrOptions, 'subject' | 'subjectAlternativeNames' | 'includeCommonNameInSan'>,
) {
  const sans = parseSanList(options.subjectAlternativeNames);
  const cn = options.subject.commonName?.trim().toLowerCase();
  if (options.includeCommonNameInSan && cn && (isValidDnsName(cn) || isIpAddress(cn))) {
    const type = isIpAddress(cn) ? 'ip' : 'dns';
    if (!sans.some((san) => san.type === type && san.value === cn)) {
      sans.unshift({ type, value: cn });
    }
  }
  return sans;
}

function buildSubjectName(subject: CsrSubject): x509.JsonName {
  return SUBJECT_ATTRIBUTES.map(({ key, oid }) => {
    const value = subject[key]?.trim();
    if (!value) {
      return null;
    }
    return { [oid]: [key === 'country' ? value.toUpperCase() : value] };
  }).filter((item): item is Record<string, string[]> => item !== null);
}

function buildExtensions(options: CsrOptions, sans: SanEntry[]) {
  const extensions: x509.Extension[] = [];
  if (sans.length) {
    extensions.push(new x509.SubjectAlternativeNameExtension(sans));
  }
  if (options.keyUsages.length) {
    extensions.push(new x509.KeyUsagesExtension(keyUsagesToFlags(options.keyUsages), options.keyUsageCritical));
  }
  if (options.extendedKeyUsages.length) {
    const oids = EXTENDED_KEY_USAGES.filter((u) => options.extendedKeyUsages.includes(u.name)).map((u) => u.oid);
    extensions.push(new x509.ExtendedKeyUsageExtension(oids));
  }
  if (options.isCA) {
    extensions.push(new x509.BasicConstraintsExtension(true, options.pathLength ?? undefined, true));
  }
  return extensions;
}

const OPENSSL_SAN_PREFIX: Record<SanEntry['type'], string> = { dns: 'DNS', ip: 'IP', email: 'email', url: 'URI' };

export function buildOpensslConfig(options: CsrOptions, sans: SanEntry[]) {
  const [family, size] = options.keyAlgorithm.split('-');
  const lines = ['[ req ]'];
  if (family === 'RSA' && options.keySource === 'generate') {
    lines.push(`default_bits       = ${size}`);
  }
  lines.push(
    'prompt             = no',
    `default_md         = ${options.hash.replace('-', '').toLowerCase()}`,
    'distinguished_name = dn',
  );
  const hasExtensions = sans.length || options.keyUsages.length || options.extendedKeyUsages.length || options.isCA;
  if (hasExtensions) {
    lines.push('req_extensions     = req_ext');
  }
  if (options.challengePassword) {
    lines.push(
      'attributes         = req_attributes',
      '',
      '[ req_attributes ]',
      `challengePassword = ${options.challengePassword}`,
    );
  }

  lines.push('', '[ dn ]');
  for (const { key, short } of SUBJECT_ATTRIBUTES) {
    const value = options.subject[key]?.trim();
    if (value) {
      lines.push(`${short} = ${key === 'country' ? value.toUpperCase() : value}`);
    }
  }

  if (hasExtensions) {
    lines.push('', '[ req_ext ]');
    if (sans.length) {
      lines.push('subjectAltName   = @alt_names');
    }
    if (options.keyUsages.length) {
      lines.push(`keyUsage         = ${options.keyUsageCritical ? 'critical, ' : ''}${options.keyUsages.join(', ')}`);
    }
    if (options.extendedKeyUsages.length) {
      lines.push(`extendedKeyUsage = ${options.extendedKeyUsages.join(', ')}`);
    }
    if (options.isCA) {
      const pathLen = options.pathLength != null ? `, pathlen:${options.pathLength}` : '';
      lines.push(`basicConstraints = critical, CA:TRUE${pathLen}`);
    }
  }

  if (sans.length) {
    lines.push('', '[ alt_names ]');
    const counters: Record<string, number> = {};
    for (const san of sans) {
      const prefix = OPENSSL_SAN_PREFIX[san.type];
      counters[prefix] = (counters[prefix] ?? 0) + 1;
      lines.push(`${prefix}.${counters[prefix]} = ${san.value}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

export function buildOpensslCommands(options: CsrOptions) {
  const base = (options.subject.commonName?.trim() || 'request').replace(/^\*\./, 'wildcard.').replace(/[^\w.-]/g, '_');
  const [family, size] = options.keyAlgorithm.split('-');
  const commands = [];
  if (options.keySource === 'generate') {
    commands.push(
      '# 1. Generate the private key',
      family === 'RSA'
        ? `openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:${size} -out ${base}.key`
        : `openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-${size.slice(1)} -out ${base}.key`,
      '',
    );
  }
  commands.push(
    `# ${options.keySource === 'generate' ? '2' : '1'}. Create the CSR from the config above saved as ${base}.cnf`,
    `openssl req -new -key ${base}.key -config ${base}.cnf -out ${base}.csr`,
    '',
    '# Check the result',
    `openssl req -in ${base}.csr -noout -text -verify`,
  );
  return `${commands.join('\n')}\n`;
}

function encryptPkcs8(pkcs8Der: ArrayBuffer, passphrase: string) {
  const asn1 = forge.asn1.fromDer(forge.util.createBuffer(new Uint8Array(pkcs8Der)));
  const encrypted = forge.pki.encryptPrivateKeyInfo(asn1, passphrase, { algorithm: 'aes256' });
  return forge.pki.encryptedPrivateKeyToPem(encrypted);
}

export async function generateCsr(options: CsrOptions): Promise<CsrResult> {
  const sans = collectSans(options);
  const [family] = options.keyAlgorithm.split('-');

  let keys: CryptoKeyPair;
  let keyFamily: 'RSA' | 'ECDSA';
  let keyDescription: string;
  if (options.keySource === 'existing') {
    const imported = await importPrivateKey(
      options.existingPrivateKeyPem ?? '',
      options.existingKeyPassphrase ?? '',
      options.hash,
    );
    keys = imported.keys;
    keyFamily = imported.family;
    keyDescription = imported.description;
  } else {
    const generated = await generateKeyPair(options.keyAlgorithm, options.hash);
    keys = generated.keys;
    keyFamily = generated.family;
    keyDescription =
      family === 'RSA'
        ? `RSA ${options.keyAlgorithm.split('-')[1]} bits`
        : `ECDSA ${options.keyAlgorithm.replace('ECDSA-P', 'P-')}`;
  }

  const attributes: x509.Attribute[] = [];
  if (options.challengePassword) {
    attributes.push(new x509.ChallengePasswordAttribute(options.challengePassword));
  }

  const csr = await x509.Pkcs10CertificateRequestGenerator.create({
    name: buildSubjectName(options.subject),
    keys,
    signingAlgorithm:
      keyFamily === 'RSA' ? { name: 'RSASSA-PKCS1-v1_5', hash: options.hash } : { name: 'ECDSA', hash: options.hash },
    extensions: buildExtensions(options, sans),
    attributes,
  });

  let privateKeyPem = '';
  if (options.keySource === 'generate') {
    const pkcs8 = await crypto.subtle.exportKey('pkcs8', keys.privateKey);
    privateKeyPem = options.privateKeyPassphrase
      ? encryptPkcs8(pkcs8, options.privateKeyPassphrase)
      : toPem(pkcs8, 'PRIVATE KEY');
  }
  const spki = await crypto.subtle.exportKey('spki', keys.publicKey);

  return {
    csrPem: csr.toString('pem'),
    privateKeyPem,
    publicKeyPem: toPem(spki, 'PUBLIC KEY'),
    keyDescription,
    sans,
    opensslConfig: buildOpensslConfig(options, sans),
    opensslCommands: buildOpensslCommands(options),
  };
}
