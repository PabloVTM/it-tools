<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import {
  type LineLength,
  bytesToText,
  decodeToBytes,
  detectContent,
  encodeText,
  hexDump,
  InvalidBase64Error,
  normalizeBase64,
} from './base64-string-converter.service';
import { useCopy } from '@/composable/copy';
import { useITStorage, useQueryParam, useQueryParamOrStorage } from '@/composable/queryParams';

const { t } = useI18n();
const tx = (key: string, params?: Record<string, unknown>) =>
  t(`tools.base64-string-converter.extra.${key}`, params ?? {});

const encoding = useQueryParamOrStorage({
  storageName: 'base64-string-converter:encoding',
  name: 'encoding',
  defaultValue: 'utf8',
});

// ---- Encode ----
const encodeUrlSafe = useITStorage('base64-string-converter:encode-url-safe', false);
const encodePadding = useITStorage('base64-string-converter:encode-padding', true);
const lineLength = useITStorage<LineLength>('base64-string-converter:line-length', 0);
const lineLengthOptions = computed(() => [
  { label: tx('line-none'), value: 0 },
  { label: tx('line-pem'), value: 64 },
  { label: tx('line-mime'), value: 76 },
]);

const textInput = useQueryParam({ tool: 'base64-string-converter', name: 'text', defaultValue: '' });
const encoded = computed(() => {
  try {
    return encodeText(textInput.value, {
      encoding: encoding.value,
      urlSafe: encodeUrlSafe.value,
      padding: encodePadding.value,
      lineLength: lineLength.value,
    });
  } catch {
    return { output: '', byteLength: 0 };
  }
});
const base64Output = computed(() => encoded.value.output);
const { copy: copyTextBase64 } = useCopy({
  source: base64Output,
  text: t('tools.base64-string-converter.texts.text-base64-string-copied-to-the-clipboard'),
});

// ---- Decode ----
const base64Input = useQueryParam({ tool: 'base64-string-converter', name: 'base64', defaultValue: '' });
const showHexDump = ref(false);

const decoded = computed(() => {
  if (!base64Input.value.trim()) {
    return null;
  }
  try {
    const normalized = normalizeBase64(base64Input.value);
    const bytes = decodeToBytes(normalized.base64);
    return { normalized, bytes, content: detectContent(bytes), error: null };
  } catch (e) {
    return { normalized: null, bytes: null, content: null, error: e as InvalidBase64Error };
  }
});

const decodeError = computed(() => {
  const error = decoded.value?.error;
  if (!error) {
    return '';
  }
  if (error instanceof InvalidBase64Error && error.reason === 'invalid-character') {
    return tx('error-invalid-character', { position: (error.position ?? 0) + 1 });
  }
  return t('tools.base64-string-converter.texts.message-invalid-base64-string');
});

const textOutput = computed(() => {
  const bytes = decoded.value?.bytes;
  if (!bytes) {
    return '';
  }
  try {
    return bytesToText(bytes, encoding.value);
  } catch {
    return '';
  }
});
const hexOutput = computed(() => (decoded.value?.bytes ? hexDump(decoded.value.bytes) : ''));
const isBinary = computed(() => decoded.value?.content?.isText === false);
watch(isBinary, (binary) => (showHexDump.value = binary), { immediate: true });

const decodeSummary = computed(() => {
  const value = decoded.value;
  if (!value?.bytes || !value.content || !value.normalized) {
    return [];
  }
  const items = [tx('bytes', { count: value.bytes.length })];
  items.push(value.content.label ?? (value.content.isText ? tx('text-content') : tx('binary-content')));
  if (value.normalized.pemLabel) {
    items.push(`PEM: ${value.normalized.pemLabel}`);
  }
  if (value.normalized.dataUriMimeType) {
    items.push(`data URI: ${value.normalized.dataUriMimeType}`);
  }
  for (const cleanup of value.normalized.cleanups) {
    if (cleanup !== 'pem' && cleanup !== 'data-uri') {
      items.push(tx(`cleanup-${cleanup}`));
    }
  }
  return items;
});

const { copy: copyText } = useCopy({
  source: textOutput,
  text: t('tools.base64-string-converter.texts.text-string-copied-to-the-clipboard'),
});
const { copy: copyHex } = useCopy({ source: hexOutput, text: tx('hex-copied') });

function downloadDecoded() {
  const value = decoded.value;
  if (!value?.bytes || !value.content) {
    return;
  }
  const mimeType = value.normalized?.dataUriMimeType ?? value.content.mimeType ?? 'application/octet-stream';
  const url = URL.createObjectURL(new Blob([value.bytes], { type: mimeType }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `decoded.${value.content.extension}`;
  link.click();
  URL.revokeObjectURL(url);
}

const encodings = [
  { label: 'UTF-8', value: 'utf8' },
  { label: 'UTF-8 (Alias: UTF8)', value: 'utf-8' },

  { label: 'UTF-16LE', value: 'utf16le' },
  { label: 'UTF-16BE', value: 'utf16be' },

  { label: 'UTF-7', value: 'utf7' },
  { label: 'UTF-7 (IMAP)', value: 'utf7imap' },

  { label: 'UTF-32LE', value: 'utf32le' },
  { label: 'UTF-32BE', value: 'utf32be' },

  { label: 'ISO-8859-1 (Latin-1)', value: 'latin1' },
  { label: 'ISO-8859-2 (Central European)', value: 'iso-8859-2' },
  { label: 'ISO-8859-3 (South European)', value: 'iso-8859-3' },
  { label: 'ISO-8859-4 (North European)', value: 'iso-8859-4' },
  { label: 'ISO-8859-5 (Cyrillic)', value: 'iso-8859-5' },
  { label: 'ISO-8859-6 (Arabic)', value: 'iso-8859-6' },
  { label: 'ISO-8859-7 (Greek)', value: 'iso-8859-7' },
  { label: 'ISO-8859-8 (Hebrew)', value: 'iso-8859-8' },
  { label: 'ISO-8859-9 (Turkish)', value: 'iso-8859-9' },
  { label: 'ISO-8859-10 (Nordic)', value: 'iso-8859-10' },
  { label: 'ISO-8859-13 (Baltic)', value: 'iso-8859-13' },
  { label: 'ISO-8859-14 (Celtic)', value: 'iso-8859-14' },
  { label: 'ISO-8859-15 (Latin-9)', value: 'iso-8859-15' },
  { label: 'ISO-8859-16 (Romanian)', value: 'iso-8859-16' },

  { label: 'Windows-1250 (Central European)', value: 'win1250' },
  { label: 'Windows-1251 (Cyrillic)', value: 'win1251' },
  { label: 'Windows-1252 (Western European)', value: 'win1252' },
  { label: 'Windows-1253 (Greek)', value: 'win1253' },
  { label: 'Windows-1254 (Turkish)', value: 'win1254' },
  { label: 'Windows-1255 (Hebrew)', value: 'win1255' },
  { label: 'Windows-1256 (Arabic)', value: 'win1256' },
  { label: 'Windows-1257 (Baltic)', value: 'win1257' },
  { label: 'Windows-1258 (Vietnamese)', value: 'win1258' },

  { label: 'KOI8-R (Russian)', value: 'koi8-r' },
  { label: 'KOI8-U (Ukrainian)', value: 'koi8-u' },

  { label: 'GBK (Simplified Chinese)', value: 'gbk' },
  { label: 'GB2312 (Simplified Chinese)', value: 'gb2312' },
  { label: 'GB18030 (Simplified Chinese)', value: 'gb18030' },

  { label: 'Big5 (Traditional Chinese)', value: 'big5' },

  { label: 'Shift-JIS (Japanese)', value: 'shift_jis' },
  { label: 'EUC-JP (Japanese)', value: 'euc-jp' },

  { label: 'MacRoman', value: 'macroman' },
  { label: 'MacGreek', value: 'macgreek' },
  { label: 'MacTurkish', value: 'macturkish' },
  { label: 'MacCyrillic', value: 'maccyrillic' },
  { label: 'MacCentralEurope', value: 'maccentraleurope' },
  { label: 'MacIceland', value: 'maciceland' },
];
</script>

<template>
  <c-card :title="t('tools.base64-string-converter.texts.title-string-to-base64')">
    <n-space align="center">
      <n-form-item :label="t('tools.base64-string-converter.texts.label-encode-url-safe')" label-placement="left">
        <n-switch v-model:value="encodeUrlSafe" />
      </n-form-item>
      <n-form-item :label="tx('padding')" label-placement="left">
        <n-switch v-model:value="encodePadding" />
      </n-form-item>
      <n-form-item :label="tx('line-length')" label-placement="left">
        <n-select v-model:value="lineLength" :options="lineLengthOptions" w-220px />
      </n-form-item>
    </n-space>
    <c-select
      :label="t('tools.base64-string-converter.texts.text-encoding')"
      label-position="left"
      style="max-width: 400px"
      v-model:value="encoding"
      :options="encodings"
      searchable
      mb-3
    />
    <c-input-text
      v-model:value="textInput"
      multiline
      :placeholder="t('tools.base64-string-converter.texts.placeholder-put-your-string-here')"
      rows="5"
      :label="t('tools.base64-string-converter.texts.label-string-to-encode')"
      raw-text
      mb-5
    />

    <c-input-text
      :label="t('tools.base64-string-converter.texts.label-base64-of-string')"
      :value="base64Output"
      multiline
      readonly
      :placeholder="
        t('tools.base64-string-converter.texts.placeholder-the-base64-encoding-of-your-string-will-be-here')
      "
      rows="5"
      mb-2
    />
    <n-text v-if="textInput" depth="3" block mb-3>
      {{ tx('encode-summary', { bytes: encoded.byteLength, chars: base64Output.replace(/\n/g, '').length }) }}
    </n-text>

    <div flex justify-center>
      <c-button @click="copyTextBase64()">
        {{ t('tools.base64-string-converter.texts.tag-copy-base64') }}
      </c-button>
    </div>
  </c-card>

  <c-card :title="t('tools.base64-string-converter.texts.title-base64-to-string')">
    <c-select
      :label="t('tools.base64-string-converter.texts.text-encoding')"
      label-position="left"
      style="max-width: 400px"
      v-model:value="encoding"
      :options="encodings"
      searchable
      mb-3
    />
    <c-input-text
      v-model:value="base64Input"
      multiline
      :placeholder="t('tools.base64-string-converter.texts.placeholder-your-base64-string')"
      rows="5"
      :label="t('tools.base64-string-converter.texts.label-base64-string-to-decode')"
      raw-text
      mb-2
    />
    <n-text depth="3" block mb-3>{{ tx('decode-help') }}</n-text>

    <n-alert v-if="decodeError" type="error" mb-3>{{ decodeError }}</n-alert>

    <template v-if="decoded?.bytes">
      <div flex flex-wrap gap-2 mb-3>
        <n-tag v-for="item in decodeSummary" :key="item" size="small">{{ item }}</n-tag>
      </div>
      <n-alert v-if="isBinary" type="warning" mb-3>{{ tx('binary-warning') }}</n-alert>

      <c-input-text
        v-if="!showHexDump"
        :value="textOutput"
        :label="t('tools.base64-string-converter.texts.label-decoded-string')"
        :placeholder="t('tools.base64-string-converter.texts.placeholder-the-decoded-string-will-be-here')"
        multiline
        rows="5"
        readonly
        mb-5
      />
      <c-input-text v-else :value="hexOutput" :label="tx('hex-dump')" multiline rows="8" readonly font-mono mb-5 />

      <div flex flex-wrap justify-center gap-3>
        <c-button @click="showHexDump = !showHexDump">
          {{ showHexDump ? tx('show-text') : tx('show-hex') }}
        </c-button>
        <c-button @click="showHexDump ? copyHex() : copyText()">
          {{ showHexDump ? tx('copy-hex') : t('tools.base64-string-converter.texts.tag-copy-decoded-string') }}
        </c-button>
        <c-button @click="downloadDecoded()">{{ tx('download') }}</c-button>
      </div>
    </template>
  </c-card>
</template>
