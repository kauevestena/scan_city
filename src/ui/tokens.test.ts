import css from '@/index.css?raw';
import { COLOR_CSS_VARS, COLORS, withAlpha, type ColorToken } from './tokens';

describe('tokens', () => {
  it('COLORS e o @theme de index.css têm os mesmos valores', () => {
    for (const token of Object.keys(COLORS) as ColorToken[]) {
      const cssVar = COLOR_CSS_VARS[token];
      const match = new RegExp(`${cssVar}:\\s*(#[0-9a-fA-F]{6})`).exec(css);
      expect(match?.[1], `${cssVar} em index.css`).toBe(COLORS[token]);
    }
  });

  it('cobre os 13 tokens de ui-style §1', () => {
    expect(Object.keys(COLORS)).toHaveLength(13);
    expect(COLORS.radar).toBe('#22d3ee');
    expect(COLORS.bgBase).toBe('#020617');
  });

  it('withAlpha converte hex em rgba', () => {
    expect(withAlpha('#22d3ee', 0.25)).toBe('rgba(34, 211, 238, 0.25)');
    expect(withAlpha(COLORS.bgBase, 1)).toBe('rgba(2, 6, 23, 1)');
  });

  it('contraste AA (REQ-NFR-007): os tokens de texto passam de 4,5 : 1 sobre os fundos escuros', () => {
    const luminance = (hex: string) => {
      const channel = (shift: number) => {
        const v = ((Number.parseInt(hex.slice(1), 16) >> shift) & 255) / 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * channel(16) + 0.7152 * channel(8) + 0.0722 * channel(0);
    };
    const ratio = (a: string, b: string) => {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
      return (hi + 0.05) / (lo + 0.05);
    };
    for (const text of ['text', 'textMuted', 'radar', 'warn', 'ok', 'danger', 'money'] as const) {
      for (const bg of ['bgBase', 'bgPanel'] as const) {
        expect(ratio(COLORS[text], COLORS[bg]), `${text} sobre ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    }
    // O violeta das fendas é só de desenho no canvas e de contornos; em texto o DOM usa o violet-400.
    expect(ratio('#a78bfa', COLORS.bgPanel)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(COLORS.rift, COLORS.bgBase)).toBeGreaterThanOrEqual(3);
  });
});
