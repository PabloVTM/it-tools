import { defineThemes } from '../theme/theme.models';
import { terminalPalette } from '@/terminal-palette';

export const { useTheme } = defineThemes({
  dark: {
    backgroundColor: terminalPalette.dark.input,
    borderColor: terminalPalette.dark.border,

    focus: {
      backgroundColor: `${terminalPalette.dark.primary}1a`,
    },
  },
  light: {
    backgroundColor: terminalPalette.light.input,
    borderColor: terminalPalette.light.border,

    focus: {
      backgroundColor: '#ffffff',
    },
  },
});
