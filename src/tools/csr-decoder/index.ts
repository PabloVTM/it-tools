import { defineTool } from '../tool';
import { translate as t } from '@/plugins/i18n.plugin';

export const tool = defineTool({
  name: t('tools.csr-decoder.title'),
  path: '/csr-decoder',
  description: t('tools.csr-decoder.description'),
  keywords: [
    'csr',
    'decoder',
    'certificate',
    'signing',
    'request',
    'x509',
    'pkcs10',
    'parser',
    'san',
    'openssl',
    'tls',
    'ssl',
  ],
  component: () => import('./csr-decoder.vue'),
  icon: defineAsyncComponent(() => import('@vicons/tabler/es/FileSearch')),
  createdAt: new Date('2026-11-08'),
  category: 'Crypto',
});
