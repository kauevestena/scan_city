import {
  formatBRL,
  formatCm,
  formatDistance,
  formatDuration,
  formatMm,
  formatNumber,
  formatPct,
  formatUm,
} from './format';

/** O Intl usa espaços não separáveis (U+00A0 / U+202F); os testes comparam com espaço comum. */
const NBSP = new RegExp(`[${String.fromCharCode(0xa0, 0x202f)}]`, 'g');
const plain = (s: string) => s.replace(NBSP, ' ');

describe('format (pt-BR)', () => {
  it('formatBRL converte centavos em reais', () => {
    expect(plain(formatBRL(1234567))).toBe('R$ 12.345,67');
    expect(plain(formatBRL(500000))).toBe('R$ 5.000,00');
    expect(plain(formatBRL(0))).toBe('R$ 0,00');
    expect(plain(formatBRL(-9950))).toBe('-R$ 99,50');
  });

  it('formatNumber usa vírgula decimal e ponto de milhar', () => {
    expect(formatNumber(1234.5678, 2)).toBe('1.234,57');
    expect(formatNumber(1234.5)).toBe('1.235');
    expect(formatNumber(2.5, 1)).toBe('2,5');
    expect(formatNumber(-0.001, 1)).toBe('0,0');
  });

  it('formatPct recebe uma fração', () => {
    expect(formatPct(0.85)).toBe('85 %');
    expect(formatPct(0.8567, 1)).toBe('85,7 %');
  });

  it('formatDuration gera mm:ss', () => {
    expect(formatDuration(0)).toBe('00:00');
    expect(formatDuration(231.45)).toBe('03:51');
    expect(formatDuration(59.6)).toBe('01:00');
    expect(formatDuration(4000)).toBe('66:40');
    expect(formatDuration(-5)).toBe('00:00');
  });

  it('unidades derivadas do metro', () => {
    expect(formatCm(0.0274)).toBe('2,7 cm');
    expect(formatCm(0.02742, 2)).toBe('2,74 cm');
    expect(formatUm(0.0000024)).toBe('2,4 µm');
    expect(formatMm(0.0088)).toBe('8,8 mm');
  });

  it('formatDistance alterna entre m e km', () => {
    expect(formatDistance(340)).toBe('340 m');
    expect(formatDistance(999.4)).toBe('999 m');
    expect(formatDistance(1200)).toBe('1,2 km');
    expect(formatDistance(15480)).toBe('15,5 km');
  });
});
