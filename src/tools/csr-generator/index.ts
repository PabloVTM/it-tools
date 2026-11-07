import { defineTool } from '../tool';
import { translate as t } from '@/plugins/i18n.plugin';

export const tool = defineTool({
  name: t('tools.csr-generator.title'),
  path: '/csr-generator',
  description: t('tools.csr-generator.description'),
  keywords: [
    'csr',
    'certificate',
    'signing',
    'request',
    'x509',
    'pkcs10',
    'generator',
    'rsa',
    'ecdsa',
    'san',
    'openssl',
    'tls',
    'ssl',
  ],
  component: () => import('./csr-generator.vue'),
  icon: defineAsyncComponent(() => import('@vicons/tabler/es/FileCertificate')),
  createdAt: new Date('2024-02-25'),
  category: 'Crypto',
});
