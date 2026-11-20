/** REQ-NFR-010: o jogador parado é reprovado em todos os contratos (ADR-032). */
import { CONTRACTS } from '@/data/contracts';
import { flyMission } from '@/test/flyMission';
import { CHALLENGE } from './challenge';

describe('o jogador parado', () => {
  it.each(CONTRACTS.map((c) => [c.id, c] as const))(
    '%s: reprovado, com execução abaixo da mínima',
    (_id, contract) => {
      const f = flyMission(contract, 'IDLE');
      expect(f.report.approved).toBe(false);
      expect(f.execution).toBeLessThan(CHALLENGE.idleMaxExecution);
    },
    60_000,
  );
});
