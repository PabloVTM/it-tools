// PabloVTM "Terminal" theme. Single source for the app colors: naive-ui overrides
// (src/themes.ts), the c-* components (src/ui), UnoCSS and the pre-paint styles in
// index.html (keep the background/primary values there in sync by hand).
export const terminalPalette = {
  dark: {
    background: '#0d1117',
    surface: '#161b22',
    surfaceRaised: '#1c2128',
    input: '#0d1117',
    border: '#30363d',
    borderMuted: '#21262d',
    hover: '#21262d',
    text: '#c9d1d9',
    textMuted: '#8b949e',
    primary: '#3ddc97',
    primaryHover: '#5fe6ab',
    primaryPressed: '#2bb57a',
    primaryFaded: '#3ddc972f',
    accent: '#f2c14e',
  },
  light: {
    background: '#f6f8fa',
    surface: '#ffffff',
    surfaceRaised: '#ffffff',
    input: '#ffffff',
    border: '#d0d7de',
    borderMuted: '#eaeef2',
    hover: '#eaeef2',
    text: '#1f2328',
    textMuted: '#59636e',
    primary: '#1a7f4b',
    primaryHover: '#22955a',
    primaryPressed: '#13633a',
    primaryFaded: '#1a7f4b2f',
    accent: '#9a6700',
  },
  // System monospace fonts only: nothing to download, works offline.
  fontFamily:
    "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', 'DejaVu Sans Mono', monospace",
} as const;
