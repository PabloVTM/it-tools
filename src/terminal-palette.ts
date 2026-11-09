// PabloSystems theme: Deep Sage Green #4B5A50, Warm Ivory #F1EEE3 and Vibrant
// Vermillion Red #F20B0B for details. Single source for the app colors:
// naive-ui overrides (src/themes.ts), the c-* components (src/ui), UnoCSS and
// the pre-paint styles in index.html (keep the background/primary values there
// in sync by hand). Text colors keep at least 4.5:1 on their backgrounds;
// accentText is the vermillion tuned for text, accent is the raw brand red.
export const terminalPalette = {
  dark: {
    background: '#252c28',
    surface: '#2e3731',
    surfaceRaised: '#38433c',
    input: '#252c28',
    border: '#4b5a50',
    borderMuted: '#38433c',
    hover: '#38433c',
    text: '#f1eee3',
    textMuted: '#c9c6b9',
    primary: '#a9baae',
    primaryHover: '#bccbc0',
    primaryPressed: '#93a699',
    primaryFaded: '#a9baae2f',
    accent: '#f20b0b',
    accentText: '#ff7a70',
  },
  light: {
    background: '#f1eee3',
    surface: '#f8f6ef',
    surfaceRaised: '#fdfcf8',
    input: '#fdfcf8',
    border: '#d3cdbb',
    borderMuted: '#e2ddce',
    hover: '#e7e3d6',
    text: '#2b332e',
    textMuted: '#5b665f',
    primary: '#4b5a50',
    primaryHover: '#3e4b43',
    primaryPressed: '#333e37',
    primaryFaded: '#4b5a502f',
    accent: '#f20b0b',
    accentText: '#c40808',
  },
  // System monospace fonts only: nothing to download, works offline.
  fontFamily:
    "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', 'DejaVu Sans Mono', monospace",
} as const;
