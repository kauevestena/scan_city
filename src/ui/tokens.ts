/**
 * Tokens visuais (ui-style §1) para os engines de Canvas.
 * Os mesmos valores estão em `src/index.css` (`@theme`); um teste garante a sincronia.
 */
export const COLORS = {
  bgBase: '#020617',
  bgPanel: '#0f172a',
  bgRaised: '#1e293b',
  border: '#334155',
  text: '#f1f5f9',
  textMuted: '#94a3b8',
  radar: '#22d3ee',
  radarDim: '#0e7490',
  warn: '#fbbf24',
  ok: '#34d399',
  danger: '#f43f5e',
  rift: '#8b5cf6',
  money: '#bef264',
} as const;

export type ColorToken = keyof typeof COLORS;

/** Variável CSS (`@theme`) correspondente a cada token. */
export const COLOR_CSS_VARS: Record<ColorToken, string> = {
  bgBase: '--color-slate-950',
  bgPanel: '--color-slate-900',
  bgRaised: '--color-slate-800',
  border: '--color-slate-700',
  text: '--color-slate-100',
  textMuted: '--color-slate-400',
  radar: '--color-cyan-400',
  radarDim: '--color-cyan-700',
  warn: '--color-amber-400',
  ok: '--color-emerald-400',
  danger: '--color-rose-500',
  rift: '--color-violet-500',
  money: '--color-lime-300',
};

export const FONTS = {
  sans: 'ui-sans-serif, system-ui, sans-serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
} as const;

/** "#rrggbb" + alfa → "rgba(r, g, b, a)", para `fillStyle`/`strokeStyle`. */
export function withAlpha(hex: string, alpha: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
