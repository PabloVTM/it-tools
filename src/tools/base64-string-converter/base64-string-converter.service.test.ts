import { describe, expect, it } from 'vitest';
import {
  InvalidBase64Error,
  bytesToText,
  decodeToBytes,
  detectContent,
  encodeText,
  hexDump,
  normalizeBase64,
} from './base64-string-converter.service';

const defaults = { encoding: 'utf8', urlSafe: false, padding: true, lineLength: 0 as const };

describe('base64-string-converter service', () => {
  describe('encodeText', () => {
    it('encodes UTF-8 and other charsets', () => {
      expect(encodeText('héllo', defaults)).toEqual({ output: 'aMOpbGxv', byteLength: 6 });
      expect(encodeText('héllo', { ...defaults, encoding: 'latin1' })).toEqual({ output: 'aOlsbG8=', byteLength: 5 });
    });

    it('handles URL-safe, padding and line wrapping', () => {
      expect(encodeText('??>', defaults).output).toBe('Pz8+');
      expect(encodeText('??>', { ...defaults, urlSafe: true }).output).toBe('Pz8-');
      expect(encodeText('a', defaults).output).toBe('YQ==');
      expect(encodeText('a', { ...defaults, padding: false }).output).toBe('YQ');
      const wrapped = encodeText('x'.repeat(100), { ...defaults, lineLength: 64 }).output.split('\n');
      expect(wrapped.map((l) => l.length)).toEqual([64, 64, 8]);
      expect(encodeText('x'.repeat(100), { ...defaults, lineLength: 76 }).output.split('\n')[0]).toHaveLength(76);
    });
  });

  describe('normalizeBase64', () => {
    it('keeps canonical base64 unchanged', () => {
      expect(normalizeBase64('aGVsbG8=')).toEqual({ base64: 'aGVsbG8=', cleanups: [] });
    });

    it('strips data URIs, PEM armor and whitespace', () => {
      expect(normalizeBase64('data:text/plain;charset=utf-8;base64,aGVsbG8=')).toMatchObject({
        base64: 'aGVsbG8=',
        dataUriMimeType: 'text/plain',
        cleanups: ['data-uri'],
      });
      const pem = '-----BEGIN TEST-----\nProc-Type: 4,ENCRYPTED\naGVs\nbG8=\n-----END TEST-----\n';
      expect(normalizeBase64(pem)).toMatchObject({
        base64: 'aGVsbG8=',
        pemLabel: 'TEST',
        cleanups: ['pem', 'whitespace'],
      });
    });

    it('accepts URL-safe and unpadded input', () => {
      expect(normalizeBase64('Pz8-')).toEqual({ base64: 'Pz8+', cleanups: ['url-safe'] });
      expect(normalizeBase64('YQ')).toEqual({ base64: 'YQ==', cleanups: ['padding-added'] });
    });

    it('reports invalid input with its position', () => {
      expect(() => normalizeBase64('   ')).toThrow(InvalidBase64Error);
      const error = (() => {
        try {
          normalizeBase64('aGV*bG8=');
        } catch (e) {
          return e;
        }
      })();
      expect(error).toMatchObject({ reason: 'invalid-character', position: 3 });
      expect(() => normalizeBase64('aGVsb')).toThrow('invalid-length');
      expect(() => normalizeBase64('aG=Vs')).toThrow('invalid-character');
    });
  });

  describe('decoding and content detection', () => {
    it('decodes bytes to text in the chosen charset', () => {
      expect(bytesToText(decodeToBytes('aMOpbGxv'), 'utf8')).toBe('héllo');
      expect(bytesToText(decodeToBytes('aOlsbG8='), 'latin1')).toBe('héllo');
    });

    it('detects text and common binary formats', () => {
      expect(detectContent(new TextEncoder().encode('plain text\n'))).toMatchObject({ isText: true });
      expect(detectContent(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]))).toMatchObject({
        isText: false,
        mimeType: 'image/png',
        extension: 'png',
      });
      expect(detectContent(Uint8Array.from([0x1f, 0x8b, 0x08]))).toMatchObject({ extension: 'gz' });
      expect(detectContent(Uint8Array.from([0x00, 0x01, 0x02, 0x03, 0xff]))).toMatchObject({
        isText: false,
        extension: 'bin',
      });
    });

    it('renders a hex dump with offsets and ASCII', () => {
      const dump = hexDump(new TextEncoder().encode('Hello, world! 123'));
      expect(dump.split('\n')).toEqual([
        '00000000  48 65 6c 6c 6f 2c 20 77 6f 72 6c 64 21 20 31 32  |Hello, world! 12|',
        '00000010  33                                               |3|',
      ]);
      expect(hexDump(new Uint8Array(40), 16).split('\n').at(-1)).toBe('... 24 more bytes');
    });
  });
});
