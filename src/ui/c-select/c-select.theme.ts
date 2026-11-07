import { defineThemes } from '../theme/theme.models';
import { appThemes } from '../theme/themes';
import { terminalPalette } from '@/terminal-palette';

const sizes = {
  small: {
    height: '28px',
    fontSize: '12px',
  },
  medium: {
    height: '34px',
    fontSize: '14px',
  },
  large: {
    height: '40px',
    fontSize: '16px',
  },
};

export const { useTheme } = defineThemes({
  dark: {
    sizes,

    backgroundColor: terminalPalette.dark.input,
    borderColor: terminalPalette.dark.border,
    dropdownShadow: 'rgba(0, 0, 0, 0.2) 0px 8px 24px',

    option: {
      hover: {
        backgroundColor: terminalPalette.dark.hover,
      },
      active: {
        textColor: appThemes.dark.primary.color,
      },
    },

    focus: {
      backgroundColor: `${terminalPalette.dark.primary}1a`,
    },
  },
  light: {
    sizes,

    backgroundColor: terminalPalette.light.input,
    borderColor: terminalPalette.light.border,
    dropdownShadow: 'rgba(149, 157, 165, 0.2) 0px 8px 24px',

    option: {
      hover: {
        backgroundColor: terminalPalette.light.hover,
      },
      active: {
        textColor: appThemes.light.primary.color,
      },
    },

    focus: {
      backgroundColor: '#ffffff',
    },
  },
});
