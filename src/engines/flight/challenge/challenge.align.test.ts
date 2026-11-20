/**
 * REQ-NFR-010: o jogador distraído (alinha na entrada de cada linha e larga o controle) fica
 * bem abaixo do mediano e reprova na maioria dos contratos (ADR-032).
 */
import { CONTRACTS } from '@/data/contracts';
import { flyMission } from '@/test/flyMission';
import { CHALLENGE } from './challenge';

const rejected: string[] = [];

describe('o jogador distraído', () => {
  it.each(CONTRACTS.map((c) => [c.id, c] as const))(
    '%s: execução pelo menos 0,2 abaixo da do mediano',
    (_id, contract) => {
      const align = flyMission(contract, 'ALIGN');
      const medium = flyMission(contract, 'MEDIUM');
      expect(align.execution).toBeLessThanOrEqual(medium.execution - CHALLENGE.alignGap);
      if (!align.report.approved) rejected.push(contract.id);
    },
    60_000,
  );

  it(`reprova em pelo menos ${CHALLENGE.alignMinRejected} dos ${CONTRACTS.length} contratos`, () => {
    expect(rejected.length).toBeGreaterThanOrEqual(CHALLENGE.alignMinRejected);
  });
});
