/** Museu e renda passiva — domain-math §12.3, progression §10. */
import type { CentsBRL, Dimension, MuseumSector } from '@/types';

export const MAX_OFFLINE_MS = 2 * 60 * 60 * 1000;

/** Renda de um setor: round(renda do contrato · (0,5 + 0,5·score)). */
export function sectorIncomePerMin(incomePerMinBRL: CentsBRL, qualityScore: number): CentsBRL {
  return Math.round(incomePerMinBRL * (0.5 + 0.5 * qualityScore));
}

/** Renda total por minuto (centavos, pode ser fracionária): Σ renda·(destaque ? 2 : 1)·visitantes. */
export function museumIncomePerMin(
  sectors: Readonly<Record<string, MuseumSector>>,
  featured: Partial<Record<Dimension, string>>,
  visitorsMod: number,
): number {
  const highlighted = new Set(Object.values(featured));
  return Object.values(sectors).reduce(
    (sum, s) => sum + s.incomePerMinBRL * (highlighted.has(s.contractId) ? 2 : 1) * visitorsMod,
    0,
  );
}

/** Visitantes por hora: renda (R$/min) · 6. */
export function visitorsPerHour(incomePerMinCents: number): number {
  return (incomePerMinCents / 100) * 6;
}

/** Renda acumulada em `elapsedMs`, com as frações de centavo guardadas em `carryCents`. */
export function accrueIncome(
  incomePerMinCents: number,
  elapsedMs: number,
  carryCents: number,
): { creditedCents: CentsBRL; carryCents: number; visitors: number } {
  const minutes = Math.max(0, elapsedMs) / 60_000;
  const raw = incomePerMinCents * minutes + carryCents;
  const creditedCents = Math.floor(raw + 1e-9);
  return {
    creditedCents,
    carryCents: raw - creditedCents,
    visitors: visitorsPerHour(incomePerMinCents) * (minutes / 60),
  };
}

/** Renda enquanto o jogo esteve fechado, limitada a 2 h. */
export function offlineIncome(incomePerMinCents: number, elapsedMs: number): CentsBRL {
  return Math.floor(
    (incomePerMinCents * Math.min(Math.max(0, elapsedMs), MAX_OFFLINE_MS)) / 60_000,
  );
}
