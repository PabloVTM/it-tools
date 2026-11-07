import {
  defineConfig,
  presetAttributify,
  presetTypography,
  presetWind3,
  transformerDirectives,
  transformerVariantGroup,
} from 'unocss';

import { presetScrollbar } from 'unocss-preset-scrollbar';

export default defineConfig({
  presets: [presetWind3(), presetAttributify({
    ignoreAttributes: ['size'],
  }), presetTypography(), presetScrollbar()],
  transformers: [transformerDirectives(), transformerVariantGroup()],
  theme: {
    colors: {
      // follows light/dark mode, set on :root by App.vue and index.html
      primary: 'var(--it-primary)',

    },
  },
  shortcuts: {
    // Inlined expansion of the preset's `scrollbar` shortcut, minus `scrollbar-width-auto`
    // and `scrollbar-color-[...]`: preset-scrollbar 4.0.0 only registers rules for those
    // two when `compatible: true`, so they trigger "unmatched utility" build warnings, and
    // enabling compatible mode would make browsers ignore the ::-webkit-scrollbar styling.
    'pretty-scrollbar': 'overflow-auto scrollbar-custom-property scrollbar-track:scrollbar-background-color-[var(--scrollbar-track)] scrollbar-thumb:scrollbar-background-color-[var(--scrollbar-thumb)] scrollbar:scrollbar-width-[var(--scrollbar-width)] scrollbar:scrollbar-height-[var(--scrollbar-height)] scrollbar-rounded scrollbar-thumb-color-gray-300 scrollbar-track-color-gray-100 dark:scrollbar-thumb-color-#30363d dark:scrollbar-track-color-#161b22',
    'divider': 'h-1px bg-current op-10',
    'bg-surface': 'bg-#ffffff dark:bg-#161b22',
    'bg-background': 'bg-#f6f8fa dark:bg-#0d1117',
  },
});
