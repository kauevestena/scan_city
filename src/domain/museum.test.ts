import type { MuseumSector } from '@/types';
import {
  accrueIncome,
  MAX_OFFLINE_MS,
  museumIncomePerMin,
  offlineIncome,
  sectorIncomePerMin,
  visitorsPerHour,
} from './museum';
import { applyModifiers } from './modifiers';

const sector = (contractId: string, incomePerMinBRL: number): MuseumSector => ({
  contractId,
  qualityScore: 1,
  mappedAt: 0,
  incomePerMinBRL,
  className: 'A',
});

describe('museu (domain-math §12.3)', () => {
  it('G24 — renda R$ 10/min com score 0,8 → R$ 9,00/min (com GES_2: R$ 13,50)', () => {
    const income = sectorIncomePerMin(1000, 0.8);
    expect(income).toBe(900);
    expect(museumIncomePerMin({ C00: sector('C00', income) }, {}, 1)).toBe(900);
    expect(
      museumIncomePerMin(
        { C00: sector('C00', income) },
        {},
        applyModifiers(['GES_1', 'GES_2']).museumVisitors,
      ),
    ).toBe(1350);
  });

  it('C00 (0,8) + C01 (1,0), sem destaque: 1 min rende R$ 49,00 (progression §14)', () => {
    const sectors = {
      C00: sector('C00', sectorIncomePerMin(1000, 0.8)),
      C01: sector('C01', sectorIncomePerMin(4000, 1)),
    };
    const perMin = museumIncomePerMin(sectors, {}, 1);
    expect(accrueIncome(perMin, 60_000, 0).creditedCents).toBe(4900);
  });

  it('o setor em destaque rende em dobro', () => {
    const sectors = { C00: sector('C00', 900), R01: sector('R01', 8000) };
    expect(museumIncomePerMin(sectors, { RIFT: 'R01' }, 1)).toBe(900 + 16000);
  });

  it('acumula frações de centavo entre ticks de 10 s', () => {
    // 9 centavos/min: 1,5 centavo a cada 10 s.
    let carry = 0;
    let total = 0;
    for (let i = 0; i < 6; i++) {
      const r = accrueIncome(9, 10_000, carry);
      total += r.creditedCents;
      carry = r.carryCents;
    }
    expect(total).toBe(9);
    expect(carry).toBeCloseTo(0, 9);
    expect(accrueIncome(600, 3_600_000, 0).visitors).toBeCloseTo(36, 12);
    expect(accrueIncome(600, -5, 0.4)).toMatchObject({ creditedCents: 0, carryCents: 0.4 });
  });

  it('visitantes por hora e renda offline limitada a 2 h', () => {
    expect(visitorsPerHour(4900)).toBeCloseTo(294, 12);
    expect(offlineIncome(4900, 60 * 60_000)).toBe(4900 * 60);
    expect(offlineIncome(4900, 10 * MAX_OFFLINE_MS)).toBe(4900 * 120);
    expect(offlineIncome(4900, -1)).toBe(0);
  });
});
