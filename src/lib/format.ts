/**
 * Formatação pt-BR (constitution §3). Entradas sempre em SI ou centavos;
 * a conversão de unidade acontece só aqui, na camada de apresentação.
 */
const LOCALE = 'pt-BR';

const brl = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'BRL' });
const numberFormatters = new Map<number, Intl.NumberFormat>();

/** Número com vírgula decimal e ponto de milhar, com casas fixas. */
export function formatNumber(n: number, decimals = 0): string {
  let f = numberFormatters.get(decimals);
  if (!f) {
    f = new Intl.NumberFormat(LOCALE, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    numberFormatters.set(decimals, f);
  }
  // Evita "-0" quando o valor arredonda para zero.
  const rounded = Number(n.toFixed(decimals));
  return f.format(rounded === 0 ? 0 : n);
}

/** Centavos inteiros → "R$ 12.345,67". */
export function formatBRL(cents: number): string {
  return brl.format(cents / 100);
}

/** Fração (0,85) → "85 %". */
export function formatPct(fraction: number, decimals = 0): string {
  return `${formatNumber(fraction * 100, decimals)} %`;
}

/** Segundos → "mm:ss" (os minutos passam de 59 em durações longas). */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

/** Metros → centímetros ("2,7 cm"). */
export function formatCm(meters: number, decimals = 1): string {
  return `${formatNumber(meters * 100, decimals)} cm`;
}

/** Metros → micrômetros ("2,4 µm"). */
export function formatUm(meters: number, decimals = 1): string {
  return `${formatNumber(meters * 1e6, decimals)} µm`;
}

/** Metros → milímetros ("8,8 mm"). */
export function formatMm(meters: number, decimals = 1): string {
  return `${formatNumber(meters * 1000, decimals)} mm`;
}

/** Metros → "340 m" abaixo de 1 km, "1,2 km" a partir daí. */
export function formatDistance(meters: number): string {
  const abs = Math.abs(meters);
  if (abs < 1000) return `${formatNumber(meters, 0)} m`;
  return `${formatNumber(meters / 1000, 1)} km`;
}
