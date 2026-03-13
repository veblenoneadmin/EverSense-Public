export type Theme = 'dark' | 'light';

export const DARK_PALETTE = {
  bg0:    '#1e1e1e',
  bg1:    '#252526',
  bg2:    '#2d2d2d',
  bg3:    '#333333',
  border: '#3c3c3c',
  border2:'#454545',
  text0:  '#f0f0f0',
  text1:  '#c0c0c0',
  text2:  '#909090',
  blue:   '#569cd6',
  teal:   '#4ec9b0',
  yellow: '#dcdcaa',
  orange: '#ce9178',
  purple: '#c586c0',
  red:    '#f44747',
  green:  '#6a9955',
  accent: '#007acc',
};

export const LIGHT_PALETTE = {
  bg0:    '#e8e8e8',  // page background — medium-light gray
  bg1:    '#f2f2f2',  // card / sidebar — noticeably lighter than bg0
  bg2:    '#dcdcdc',  // inner card sections, inputs
  bg3:    '#d0d0d0',  // deepest recessed elements
  border: '#c4c4c4',  // visible borders
  border2:'#b0b0b0',  // stronger borders
  text0:  '#1a1a1a',  // primary text
  text1:  '#3a3a3a',  // secondary text
  text2:  '#6a6a6a',  // muted text / labels
  blue:   '#0070c1',
  teal:   '#107c7c',
  yellow: '#7a6000',
  orange: '#a34200',
  purple: '#8a00c2',
  red:    '#c50f1f',
  green:  '#107c10',
  accent: '#0078d4',
};

/** Apply theme CSS variables to document root */
export function applyTheme(theme: Theme) {
  const palette = theme === 'light' ? LIGHT_PALETTE : DARK_PALETTE;
  const root = document.documentElement;
  Object.entries(palette).forEach(([key, value]) => {
    root.style.setProperty(`--vs-${key}`, value);
  });
  root.setAttribute('data-theme', theme);
}

/**
 * VS object using CSS custom properties.
 * Works with inline styles: style={{ background: VS.bg0 }}
 */
export const VS = {
  bg0:    'var(--vs-bg0)',
  bg1:    'var(--vs-bg1)',
  bg2:    'var(--vs-bg2)',
  bg3:    'var(--vs-bg3)',
  border: 'var(--vs-border)',
  border2:'var(--vs-border2)',
  text0:  'var(--vs-text0)',
  text1:  'var(--vs-text1)',
  text2:  'var(--vs-text2)',
  blue:   'var(--vs-blue)',
  teal:   'var(--vs-teal)',
  yellow: 'var(--vs-yellow)',
  orange: 'var(--vs-orange)',
  purple: 'var(--vs-purple)',
  red:    'var(--vs-red)',
  green:  'var(--vs-green)',
  accent: 'var(--vs-accent)',
};
