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
});
