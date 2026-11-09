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
    'pretty-scrollbar': 'overflow-auto scrollbar-custom-property scrollbar-track:scrollbar-background-color-[var(--scrollbar-track)] scrollbar-thumb:scrollbar-background-color-[var(--scrollbar-thumb)] scrollbar:scrollbar-width-[var(--scrollbar-width)] scrollbar:scrollbar-height-[var(--scrollbar-height)] scrollbar-rounded scrollbar-thumb-color-#d3cdbb scrollbar-track-color-#e7e3d6 dark:scrollbar-thumb-color-#4b5a50 dark:scrollbar-track-color-#2e3731',
    'divider': 'h-1px bg-current op-10',
    'bg-surface': 'bg-#fdfcf8 dark:bg-#2e3731',
    'bg-background': 'bg-#f1eee3 dark:bg-#252c28',
  },
});
