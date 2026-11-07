<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { type DecodedCsr, decodeCsr } from './csr-decoder.service';
import TextareaCopyable from '@/components/TextareaCopyable.vue';

const { t } = useI18n();
const tk = (key: string) => t(`tools.csr-decoder.${key}`);

const input = ref('');
const decoded = ref<DecodedCsr | null>(null);
const error = ref(false);

watchDebounced(
  input,
  async (value) => {
    if (!value.trim()) {
      decoded.value = null;
      error.value = false;
      return;
    }
    try {
      decoded.value = await decodeCsr(value);
      error.value = false;
    } catch {
      decoded.value = null;
      error.value = true;
    }
  },
  { debounce: 300, immediate: true },
);

async function loadFile(file: File) {
  const buffer = new Uint8Array(await file.arrayBuffer());
  const text = new TextDecoder().decode(buffer);
  // DER files are binary: hand them over as base64
  input.value = text.includes('-----BEGIN') ? text : btoa(String.fromCharCode(...buffer));
}

const keyDescription = computed(() => {
  const key = decoded.value?.publicKey;
  if (!key) {
    return '';
  }
  if (key.curve) {
    return `${key.algorithm} ${key.curve}`;
  }
  return key.size ? `${key.algorithm} ${key.size} bits` : key.algorithm;
});

const warningType = (warning: string) =>
  warning === 'invalid-signature' || warning === 'weak-hash' ? 'error' : 'warning';
</script>

<template>
  <div flex flex-col gap-3>
    <c-card>
      <c-input-text
        v-model:value="input"
        :label="tk('input-label')"
        placeholder="-----BEGIN CERTIFICATE REQUEST-----"
        multiline
        rows="8"
        raw-text
        mb-2
      />
      <c-file-upload :title="tk('file-upload')" @file-upload="loadFile" />
    </c-card>

    <n-alert v-if="error" type="error">{{ tk('invalid') }}</n-alert>

    <template v-if="decoded">
      <n-alert :type="decoded.signatureValid ? 'success' : 'error'">
        {{ decoded.signatureValid ? tk('signature-valid') : tk('signature-invalid') }}
      </n-alert>
      <n-alert
        v-for="warning in decoded.warnings.filter((w) => w !== 'invalid-signature')"
        :key="warning"
        :type="warningType(warning)"
      >
        {{ tk(`warnings.${warning}`) }}
      </n-alert>

      <c-card :title="tk('subject')">
        <c-table
          :data="decoded.subject.map((item) => ({ name: item.name, value: item.value, oid: item.oid }))"
          :headers="[
            { key: 'name', label: tk('field') },
            { key: 'value', label: tk('value') },
            { key: 'oid', label: 'OID' },
          ]"
        />
        <n-text depth="3" mt-2 block font-mono>{{ decoded.subjectString }}</n-text>
      </c-card>

      <c-card :title="tk('subject-alternative-names')">
        <div v-if="decoded.subjectAlternativeNames.length" flex flex-wrap gap-2>
          <n-tag v-for="san in decoded.subjectAlternativeNames" :key="`${san.type}:${san.value}`" size="small">
            {{ san.type.toUpperCase() }}: {{ san.value }}
          </n-tag>
        </div>
        <n-text v-else depth="3">{{ tk('none') }}</n-text>
      </c-card>

      <c-card :title="tk('public-key')">
        <c-key-value-list
          :items="[
            { label: tk('algorithm'), value: keyDescription },
            { label: tk('signature-algorithm'), value: decoded.signatureAlgorithm },
            { label: tk('fingerprint'), value: decoded.publicKey.sha256Fingerprint },
          ]"
        />
        <TextareaCopyable :value="decoded.publicKey.pem" download-file-name="public-key.pem" mt-3 />
      </c-card>

      <c-card :title="tk('extensions')">
        <c-key-value-list
          :items="[
            {
              label: tk('key-usage'),
              value: decoded.keyUsages.length
                ? `${decoded.keyUsageCritical ? `${tk('critical')}, ` : ''}${decoded.keyUsages.join(', ')}`
                : tk('none'),
            },
            {
              label: tk('extended-key-usage'),
              value: decoded.extendedKeyUsages.length ? decoded.extendedKeyUsages.join(', ') : tk('none'),
            },
            {
              label: tk('basic-constraints'),
              value: decoded.basicConstraints
                ? `CA:${decoded.basicConstraints.ca ? 'TRUE' : 'FALSE'}${decoded.basicConstraints.pathLength !== undefined ? `, pathlen:${decoded.basicConstraints.pathLength}` : ''}`
                : tk('none'),
            },
            ...(decoded.challengePassword
              ? [{ label: tk('challenge-password'), value: decoded.challengePassword }]
              : []),
            ...decoded.otherExtensions.map((extension) => ({
              label: extension.oid,
              value: extension.critical ? tk('critical') : tk('present'),
            })),
          ]"
        />
      </c-card>

      <c-card :title="tk('openssl')">
        <TextareaCopyable value="openssl req -in request.csr -noout -text -verify" language="bash" />
      </c-card>
    </template>
  </div>
</template>
