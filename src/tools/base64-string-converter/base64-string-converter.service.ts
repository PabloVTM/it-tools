import iconv from 'iconv-lite';
import { Base64 } from 'js-base64';

export type LineLength = 0 | 64 | 76;

export interface EncodeOptions {
  encoding: string;
  urlSafe: boolean;
  padding: boolean;
  lineLength: LineLength;
}

export function textToBytes(text: string, encoding: string): Uint8Array {
  return encoding === 'utf8' || encoding === 'utf-8' ? new TextEncoder().encode(text) : iconv.encode(text, encoding);
}

export function encodeBytes(bytes: Uint8Array, { urlSafe, padding, lineLength }: Omit<EncodeOptions, 'encoding'>) {
  let encoded = Base64.fromUint8Array(bytes);
  if (urlSafe) {
    encoded = encoded.replace(/\+/g, '-').replace(/\//g, '_');
  }
  if (!padding) {
    encoded = encoded.replace(/=+$/, '');
  }
  if (lineLength > 0) {
    encoded = encoded.match(new RegExp(`.{1,${lineLength}}`, 'g'))?.join('\n') ?? '';
  }
  return encoded;
}

export function encodeText(text: string, options: EncodeOptions) {
  const bytes = textToBytes(text, options.encoding);
  return { output: encodeBytes(bytes, options), byteLength: bytes.length };
}

export type Base64Cleanup = 'data-uri' | 'pem' | 'whitespace' | 'url-safe' | 'padding-added';

export interface NormalizedBase64 {
  base64: string;
  cleanups: Base64Cleanup[];
  dataUriMimeType?: string;
  pemLabel?: string;
}

export class InvalidBase64Error extends Error {
  constructor(
    public readonly reason: 'empty' | 'invalid-character' | 'invalid-length',
    public readonly position?: number,
  ) {
    super(reason);
  }
}

// Turns whatever people paste (PEM blocks, data URIs, MIME-wrapped lines, URL-safe or
// unpadded base64) into canonical padded base64, recording what was fixed.
export function normalizeBase64(input: string): NormalizedBase64 {
  const cleanups: Base64Cleanup[] = [];
  let value = input.trim();
  let dataUriMimeType: string | undefined;
  let pemLabel: string | undefined;

  const dataUri = value.match(/^data:([^;,]*)(?:;[^,]*)?;base64,/i);
  if (dataUri) {
    dataUriMimeType = dataUri[1] || undefined;
    value = value.slice(dataUri[0].length);
    cleanups.push('data-uri');
  }

  const pem = value.match(/-----BEGIN ([^-]+)-----([\s\S]*?)-----END \1-----/);
  if (pem) {
    pemLabel = pem[1];
    // drop RFC 1421 headers such as Proc-Type / DEK-Info
    value = pem[2].replace(/^[\w-]+:.*$/gm, '');
    cleanups.push('pem');
  }

  if (/\s/.test(value)) {
    value = value.replace(/\s+/g, '');
    cleanups.push('whitespace');
  }

  if (!value) {
    throw new InvalidBase64Error('empty');
  }

  if (/[-_]/.test(value)) {
    value = value.replace(/-/g, '+').replace(/_/g, '/');
    cleanups.push('url-safe');
  }

  const invalid = value.search(/[^A-Za-z0-9+/=]/);
  if (invalid >= 0) {
    throw new InvalidBase64Error('invalid-character', invalid);
  }
  const firstPadding = value.indexOf('=');
  if (firstPadding >= 0 && !/^=*$/.test(value.slice(firstPadding))) {
    throw new InvalidBase64Error('invalid-character', firstPadding);
  }

  const unpadded = value.replace(/=+$/, '');
  if (unpadded.length % 4 === 1) {
    throw new InvalidBase64Error('invalid-length');
  }
  const padded = unpadded.padEnd(Math.ceil(unpadded.length / 4) * 4, '=');
  if (padded !== value) {
    cleanups.push('padding-added');
  }
  return { base64: padded, cleanups, dataUriMimeType, pemLabel };
}

export function decodeToBytes(base64: string) {
  return Base64.toUint8Array(base64);
}

export function bytesToText(bytes: Uint8Array, encoding: string) {
  return encoding === 'utf8' || encoding === 'utf-8'
    ? new TextDecoder('utf-8').decode(bytes)
    : iconv.decode(bytes as Buffer, encoding);
}

const SIGNATURES: Array<{ bytes: number[]; offset?: number; mime: string; extension: string; label: string }> = [
  { bytes: [0x89, 0x50, 0x4e, 0x47], mime: 'image/png', extension: 'png', label: 'PNG image' },
  { bytes: [0xff, 0xd8, 0xff], mime: 'image/jpeg', extension: 'jpg', label: 'JPEG image' },
  { bytes: [0x47, 0x49, 0x46, 0x38], mime: 'image/gif', extension: 'gif', label: 'GIF image' },
  { bytes: [0x52, 0x49, 0x46, 0x46], mime: 'image/webp', extension: 'webp', label: 'RIFF / WebP' },
  { bytes: [0x25, 0x50, 0x44, 0x46], mime: 'application/pdf', extension: 'pdf', label: 'PDF document' },
  {
    bytes: [0x50, 0x4b, 0x03, 0x04],
    mime: 'application/zip',
    extension: 'zip',
    label: 'ZIP archive (or docx, xlsx, jar)',
  },
  { bytes: [0x1f, 0x8b], mime: 'application/gzip', extension: 'gz', label: 'gzip data' },
  { bytes: [0x42, 0x5a, 0x68], mime: 'application/x-bzip2', extension: 'bz2', label: 'bzip2 data' },
  { bytes: [0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00], mime: 'application/x-xz', extension: 'xz', label: 'xz data' },
  { bytes: [0x28, 0xb5, 0x2f, 0xfd], mime: 'application/zstd', extension: 'zst', label: 'Zstandard data' },
  { bytes: [0x7f, 0x45, 0x4c, 0x46], mime: 'application/x-elf', extension: 'elf', label: 'ELF executable' },
  {
    bytes: [0x4d, 0x5a],
    mime: 'application/vnd.microsoft.portable-executable',
    extension: 'exe',
    label: 'Windows executable',
  },
  {
    bytes: [0x30, 0x82],
    mime: 'application/pkix-cert',
    extension: 'der',
    label: 'DER (ASN.1) structure: certificate, key or CSR',
  },
];

export interface ContentInfo {
  isText: boolean;
  mimeType?: string;
  extension: string;
  label?: string;
}

export function detectContent(bytes: Uint8Array): ContentInfo {
  const signature = SIGNATURES.find((s) => s.bytes.every((b, i) => bytes[(s.offset ?? 0) + i] === b));
  if (signature) {
    return { isText: false, mimeType: signature.mime, extension: signature.extension, label: signature.label };
  }
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    // Text, unless it is full of control characters other than tab / newlines
    const controls = [...text].filter((c) => {
      const code = c.charCodeAt(0);
      return (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) || code === 0x7f;
    }).length;
    if (controls <= Math.max(1, text.length / 100)) {
      return { isText: true, mimeType: 'text/plain', extension: 'txt' };
    }
  } catch {
    // not UTF-8
  }
  return { isText: false, extension: 'bin' };
}

export function hexDump(bytes: Uint8Array, maxBytes = 1024) {
  const lines: string[] = [];
  const length = Math.min(bytes.length, maxBytes);
  for (let offset = 0; offset < length; offset += 16) {
    const chunk = bytes.slice(offset, Math.min(offset + 16, length));
    const hex = [...chunk].map((b) => b.toString(16).padStart(2, '0')).join(' ');
    const ascii = [...chunk].map((b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : '.')).join('');
    lines.push(`${offset.toString(16).padStart(8, '0')}  ${hex.padEnd(47, ' ')}  |${ascii}|`);
  }
  if (bytes.length > maxBytes) {
    lines.push(`... ${bytes.length - maxBytes} more bytes`);
  }
  return lines.join('\n');
}
