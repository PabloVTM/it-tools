import { defineThemes } from '../theme/theme.models';
import { terminalPalette } from '@/terminal-palette';

export const { useTheme } = defineThemes({
  dark: {
    backgroundColor: terminalPalette.dark.surface,
    borderColor: terminalPalette.dark.border,
  },
  light: {
    backgroundColor: terminalPalette.light.surface,
    borderColor: terminalPalette.light.border,
  },
});
