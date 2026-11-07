<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import {
  type CsrOptions,
  type CsrResult,
  USAGE_PRESETS,
  collectSans,
  generateCsr,
  validateCsrOptions,
} from './csr-generator.service';
import TextareaCopyable from '@/components/TextareaCopyable.vue';
import { useITStorage, useQueryParamOrStorage } from '@/composable/queryParams';
import {
  EXTENDED_KEY_USAGES,
  type ExtendedKeyUsageName,
  type HashAlgorithm,
  KEY_USAGES,
  type KeyAlgorithmId,
  KeyImportError,
  type KeyUsageName,
} from '@/utils/x509-csr';

const { t } = useI18n();
const tk = (key: string) => t(`tools.csr-generator.form.${key}`);

const keySource = ref<'generate' | 'existing'>('generate');
const keyAlgorithm = useQueryParamOrStorage<KeyAlgorithmId>({
  name: 'key',
  storageName: 'csr-gen:key',
  defaultValue: 'RSA-2048',
});
const hash = useQueryParamOrStorage<HashAlgorithm>({
  name: 'hash',
  storageName: 'csr-gen:hash',
  defaultValue: 'SHA-256',
});
const existingPrivateKeyPem = ref('');
const existingKeyPassphrase = ref('');

const subject = reactive({
  commonName: '',
  organizationName: '',
  organizationalUnit: '',
  locality: '',
  state: '',
  country: '',
  emailAddress: '',
});
const subjectAlternativeNames = ref('');
const includeCommonNameInSan = useITStorage('csr-gen:cn-in-san', true);

const preset = ref<string | null>('tls-server');
const keyUsages = ref<KeyUsageName[]>([...USAGE_PRESETS['tls-server'].keyUsages]);
const keyUsageCritical = ref(true);
const extendedKeyUsages = ref<ExtendedKeyUsageName[]>([...USAGE_PRESETS['tls-server'].extendedKeyUsages]);
const isCA = ref(false);
const pathLength = ref<number | null>(null);
const challengePassword = ref('');
const privateKeyPassphrase = ref('');

watch(preset, (name) => {
  if (name && USAGE_PRESETS[name]) {
    keyUsages.value = [...USAGE_PRESETS[name].keyUsages];
    extendedKeyUsages.value = [...USAGE_PRESETS[name].extendedKeyUsages];
    isCA.value = USAGE_PRESETS[name].isCA;
  }
});

const keyAlgorithmOptions = [
  { label: 'RSA 2048', value: 'RSA-2048' },
  { label: 'RSA 3072', value: 'RSA-3072' },
  { label: 'RSA 4096', value: 'RSA-4096' },
  { label: 'ECDSA P-256', value: 'ECDSA-P256' },
  { label: 'ECDSA P-384', value: 'ECDSA-P384' },
  { label: 'ECDSA P-521', value: 'ECDSA-P521' },
];
const hashOptions = ['SHA-256', 'SHA-384', 'SHA-512'].map((value) => ({ label: value, value }));
const presetOptions = computed(() =>
  Object.keys(USAGE_PRESETS).map((value) => ({ label: tk(`presets.${value}`), value })),
);

const options = computed<CsrOptions>(() => ({
  subject: { ...subject },
  subjectAlternativeNames: subjectAlternativeNames.value,
  includeCommonNameInSan: includeCommonNameInSan.value,
  keySource: keySource.value,
  keyAlgorithm: keyAlgorithm.value,
  existingPrivateKeyPem: existingPrivateKeyPem.value,
  existingKeyPassphrase: existingKeyPassphrase.value,
  hash: hash.value,
  keyUsages: keyUsages.value,
  keyUsageCritical: keyUsageCritical.value,
  extendedKeyUsages: extendedKeyUsages.value,
  isCA: isCA.value,
  pathLength: pathLength.value,
  challengePassword: challengePassword.value,
  privateKeyPassphrase: privateKeyPassphrase.value,
}));

const validationErrors = computed(() => validateCsrOptions(options.value));
const sanPreview = computed(() => collectSans(options.value));

const result = ref<CsrResult | null>(null);
const generationError = ref('');
const isGenerating = ref(false);

async function generate() {
  if (validationErrors.value.length) {
    return;
  }
  isGenerating.value = true;
  generationError.value = '';
  try {
    result.value = await generateCsr(options.value);
  } catch (e) {
    result.value = null;
    generationError.value = e instanceof KeyImportError ? tk(`errors.${e.code}`) : String(e);
  } finally {
    isGenerating.value = false;
  }
}

const fileBase = computed(() =>
  (subject.commonName.trim() || 'request').replace(/^\*\./, 'wildcard.').replace(/[^\w.-]/g, '_'),
);
</script>

<template>
  <div flex flex-col gap-3>
    <c-card :title="tk('key.title')">
      <n-radio-group v-model:value="keySource" mb-3>
        <n-radio value="generate">{{ tk('key.generate') }}</n-radio>
        <n-radio value="existing">{{ tk('key.existing') }}</n-radio>
      </n-radio-group>

      <div v-if="keySource === 'generate'" flex flex-wrap gap-3>
        <c-select v-model:value="keyAlgorithm" :label="tk('key.algorithm')" :options="keyAlgorithmOptions" w-200px />
        <c-select v-model:value="hash" :label="tk('key.hash')" :options="hashOptions" w-200px />
      </div>

      <div v-else>
        <c-input-text
          v-model:value="existingPrivateKeyPem"
          :label="tk('key.existing-pem')"
          placeholder="-----BEGIN PRIVATE KEY-----"
          multiline
          rows="6"
          raw-text
          mb-2
        />
        <div flex flex-wrap gap-3>
          <n-form-item :label="tk('key.existing-passphrase')" label-placement="top" flex-1>
            <n-input v-model:value="existingKeyPassphrase" type="password" show-password-on="mousedown" />
          </n-form-item>
          <c-select v-model:value="hash" :label="tk('key.hash')" :options="hashOptions" w-200px />
        </div>
        <n-text depth="3">{{ tk('key.existing-help') }}</n-text>
      </div>
    </c-card>

    <c-card :title="tk('subject.title')">
      <n-grid cols="1 s:2" responsive="screen" x-gap="12">
        <n-form-item-gi :label="tk('subject.commonName')" label-placement="top" :span="2">
          <n-input v-model:value="subject.commonName" placeholder="www.example.com" />
        </n-form-item-gi>
        <n-form-item-gi :label="tk('subject.organizationName')" label-placement="top">
          <n-input v-model:value="subject.organizationName" placeholder="Example SAS" />
        </n-form-item-gi>
        <n-form-item-gi :label="tk('subject.organizationalUnit')" label-placement="top">
          <n-input v-model:value="subject.organizationalUnit" placeholder="IT" />
        </n-form-item-gi>
        <n-form-item-gi :label="tk('subject.locality')" label-placement="top">
          <n-input v-model:value="subject.locality" placeholder="Paris" />
        </n-form-item-gi>
        <n-form-item-gi :label="tk('subject.state')" label-placement="top">
          <n-input v-model:value="subject.state" placeholder="Ile-de-France" />
        </n-form-item-gi>
        <n-form-item-gi :label="tk('subject.country')" label-placement="top">
          <n-input v-model:value="subject.country" placeholder="FR" maxlength="2" />
        </n-form-item-gi>
        <n-form-item-gi :label="tk('subject.emailAddress')" label-placement="top">
          <n-input v-model:value="subject.emailAddress" placeholder="admin@example.com" />
        </n-form-item-gi>
      </n-grid>
    </c-card>

    <c-card :title="tk('san.title')">
      <c-input-text
        v-model:value="subjectAlternativeNames"
        :label="tk('san.label')"
        :placeholder="'example.com\n*.example.com\n10.0.0.1\nadmin@example.com\nURI:https://example.com'"
        multiline
        rows="5"
        raw-text
        mb-2
      />
      <n-checkbox v-model:checked="includeCommonNameInSan">{{ tk('san.include-cn') }}</n-checkbox>
      <div v-if="sanPreview.length" mt-3 flex flex-wrap gap-2>
        <n-tag v-for="san in sanPreview" :key="`${san.type}:${san.value}`" size="small">
          {{ san.type.toUpperCase() }}: {{ san.value }}
        </n-tag>
      </div>
    </c-card>

    <c-card :title="tk('usage.title')">
      <n-form-item :label="tk('usage.preset')" label-placement="top" max-w-300px>
        <n-select v-model:value="preset" :options="presetOptions" :placeholder="tk('usage.custom')" clearable />
      </n-form-item>

      <n-form-item :label="tk('usage.key-usage')" label-placement="top">
        <n-checkbox-group v-model:value="keyUsages" @update:value="preset = null">
          <n-space>
            <n-checkbox v-for="usage in KEY_USAGES" :key="usage.name" :value="usage.name" :label="usage.name" />
          </n-space>
        </n-checkbox-group>
      </n-form-item>
      <n-checkbox v-model:checked="keyUsageCritical" mb-3>{{ tk('usage.critical') }}</n-checkbox>

      <n-form-item :label="tk('usage.extended-key-usage')" label-placement="top">
        <n-checkbox-group v-model:value="extendedKeyUsages" @update:value="preset = null">
          <n-space>
            <n-checkbox
              v-for="usage in EXTENDED_KEY_USAGES"
              :key="usage.name"
              :value="usage.name"
              :label="usage.name"
            />
          </n-space>
        </n-checkbox-group>
      </n-form-item>

      <div flex flex-wrap items-center gap-4>
        <n-checkbox v-model:checked="isCA">{{ tk('usage.is-ca') }}</n-checkbox>
        <n-form-item v-if="isCA" :label="tk('usage.path-length')" label-placement="left" :show-feedback="false">
          <n-input-number v-model:value="pathLength" :min="0" clearable w-140px />
        </n-form-item>
      </div>
    </c-card>

    <c-card :title="tk('options.title')">
      <n-grid cols="1 s:2" responsive="screen" x-gap="12">
        <n-form-item-gi :label="tk('options.challenge-password')" label-placement="top">
          <n-input v-model:value="challengePassword" type="password" show-password-on="mousedown" />
        </n-form-item-gi>
        <n-form-item-gi v-if="keySource === 'generate'" :label="tk('options.key-passphrase')" label-placement="top">
          <n-input
            v-model:value="privateKeyPassphrase"
            type="password"
            show-password-on="mousedown"
            :placeholder="tk('options.key-passphrase-placeholder')"
          />
        </n-form-item-gi>
      </n-grid>
    </c-card>

    <n-alert v-for="error in validationErrors" :key="error" type="warning" :show-icon="true">
      {{ tk(`errors.${error}`) }}
    </n-alert>
    <n-alert v-if="generationError" type="error">{{ generationError }}</n-alert>

    <div flex justify-center>
      <c-button :disabled="validationErrors.length > 0 || isGenerating" @click="generate()">
        {{ isGenerating ? tk('generating') : tk('generate') }}
      </c-button>
    </div>

    <template v-if="result">
      <n-divider />
      <n-text depth="3" text-center>{{ tk('output.key') }}: {{ result.keyDescription }}</n-text>

      <h3>{{ tk('output.csr') }}</h3>
      <TextareaCopyable :value="result.csrPem" :download-file-name="`${fileBase}.csr`" />

      <template v-if="result.privateKeyPem">
        <h3>{{ tk('output.private-key') }}</h3>
        <TextareaCopyable :value="result.privateKeyPem" :download-file-name="`${fileBase}.key`" />
      </template>

      <h3>{{ tk('output.public-key') }}</h3>
      <TextareaCopyable :value="result.publicKeyPem" :download-file-name="`${fileBase}.pub.pem`" />

      <h3>{{ tk('output.openssl-config') }}</h3>
      <TextareaCopyable :value="result.opensslConfig" :download-file-name="`${fileBase}.cnf`" language="ini" />

      <h3>{{ tk('output.openssl-commands') }}</h3>
      <TextareaCopyable :value="result.opensslCommands" language="bash" />
    </template>
  </div>
</template>
