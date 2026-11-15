import { mulberry32 } from '@/lib/rng';
import type { ContractProgress, QualityReport } from '@/types';
import {
  ASPRS_TOP_CLASS,
  portfolioClass,
  portfolioOutcome,
  returnStolen,
  rollCounterOffer,
  stealContract,
} from './rival';

const progress = (status: ContractProgress['status'], bestClass?: string): ContractProgress => ({
  status,
  completions: status === 'COMPLETED' ? 1 : 0,
  bestScore: 0.8,
  ...(bestClass ? { bestClass } : {}),
});

describe('rival MegaMap', () => {
  it('contraproposta com p = 0,20 · rivalChance, determinística por seed', () => {
    const rate = (mod: number) => {
      const rng = mulberry32(42);
      let hits = 0;
      for (let i = 0; i < 10_000; i++) if (rollCounterOffer(rng, mod)) hits++;
      return hits / 10_000;
    };
    expect(Math.abs(rate(1) - 0.2)).toBeLessThan(0.015);
    expect(Math.abs(rate(0.5) - 0.1)).toBeLessThan(0.015);
    expect(rollCounterOffer(mulberry32(7), 1)).toBe(rollCounterOffer(mulberry32(7), 1));
  });

  it('portfólio: classe A ou ASPRS com H ≤ 5 cm convence; senão iguala o preço e perde 2 de reputação', () => {
    expect(portfolioOutcome({ C00: progress('COMPLETED', 'C') })).toEqual({
      rivalAdjustment: 0.85,
      reputationDelta: -2,
      convinced: false,
    });
    expect(portfolioOutcome({ C00: progress('COMPLETED', 'A') })).toEqual({
      rivalAdjustment: 1,
      reputationDelta: 0,
      convinced: true,
    });
    expect(portfolioOutcome({ C06: progress('COMPLETED', ASPRS_TOP_CLASS) }).convinced).toBe(true);
    expect(portfolioOutcome({ C01: progress('STOLEN', 'A') }).convinced).toBe(false);
  });

  it('classe do portfólio a partir do relatório', () => {
    const pec = { planimetric: { achieved: 'B' } } as QualityReport['pec'];
    expect(portfolioClass({ pec })).toBe('B');
    const asprs = (h: number, ok = true) => ({
      horizontalCm: 7,
      verticalCm: 10,
      rmseHcm: h,
      rmseVcm: 5,
      passH: ok,
      passV: ok,
    });
    expect(portfolioClass({ asprs: asprs(4) })).toBe(ASPRS_TOP_CLASS);
    expect(portfolioClass({ asprs: asprs(6) })).toBe('ASPRS');
    expect(portfolioClass({ asprs: asprs(4, false) })).toBe('FORA');
    expect(portfolioClass({})).toBeUndefined();
  });

  it('roubo após falha crítica e retorno após concluir outro contrato (C05 → R08)', () => {
    const stolen = stealContract(progress('AVAILABLE'), 4, false);
    expect(stolen).toMatchObject({ status: 'STOLEN', stolenAtCompletionCount: 4 });
    expect(stealContract(progress('COMPLETED'), 4, true).status).toBe('COMPLETED');
    const contracts = { C05: stolen, C00: progress('COMPLETED') };
    expect(returnStolen(contracts, 4).C05?.status).toBe('STOLEN');
    const back = returnStolen(contracts, 5);
    expect(back.C05).toEqual({ status: 'AVAILABLE', completions: 0, bestScore: 0.8 });
    expect(back.C00).toBe(contracts.C00);
  });
});
