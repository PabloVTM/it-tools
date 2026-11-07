import type { GlobalThemeOverrides } from 'naive-ui';
import { terminalPalette } from './terminal-palette';

const { dark, light, fontFamily } = terminalPalette;

export const lightThemeOverrides: GlobalThemeOverrides = {
  common: {
    fontFamily,
    fontFamilyMono: fontFamily,
    primaryColor: light.primary,
    primaryColorHover: light.primaryHover,
    primaryColorPressed: light.primaryPressed,
    primaryColorSuppl: light.primaryHover,
    // Keep <body> the same color as the Layout background: Safari 26+ ignores
    // theme-color and derives its browser chrome tint from the body background.
    bodyColor: light.background,
    textColorBase: light.text,
    textColor1: light.text,
    textColor2: light.text,
    textColor3: light.textMuted,
    borderColor: light.border,
    dividerColor: light.borderMuted,
    hoverColor: light.hover,
  },

  Menu: {
    itemHeight: '32px',
  },

  Layout: {
    color: light.background,
    siderColor: light.surface,
    siderBorderColor: light.border,
  },

  Card: {
    color: light.surface,
    borderColor: light.border,
  },

  AutoComplete: {
    peers: {
      InternalSelectMenu: { height: '500px' },
    },
  },
};

export const darkThemeOverrides: GlobalThemeOverrides = {
  common: {
    fontFamily,
    fontFamilyMono: fontFamily,
    primaryColor: dark.primary,
    primaryColorHover: dark.primaryHover,
    primaryColorPressed: dark.primaryPressed,
    primaryColorSuppl: dark.primaryHover,
    // Match the Layout background (see lightThemeOverrides.common.bodyColor)
    bodyColor: dark.background,
    textColorBase: dark.text,
    textColor1: dark.text,
    textColor2: dark.text,
    textColor3: dark.textMuted,
    borderColor: dark.border,
    dividerColor: dark.borderMuted,
    hoverColor: dark.hover,
    popoverColor: dark.surfaceRaised,
    modalColor: dark.surface,
    cardColor: dark.surface,
  },

  Notification: {
    color: dark.surfaceRaised,
  },

  AutoComplete: {
    peers: {
      InternalSelectMenu: { height: '500px', color: dark.surfaceRaised },
    },
  },

  Menu: {
    itemHeight: '32px',
  },

  Layout: {
    color: dark.background,
    siderColor: dark.surface,
    siderBorderColor: dark.border,
  },

  Card: {
    color: dark.surface,
    borderColor: dark.border,
  },

  Table: {
    tdColor: dark.surface,
    thColor: dark.borderMuted,
  },
};
