/**
 * REQ-NFR-010: o mediano aprova em todos os contratos e o bom aprova com execução de piloto,
 * sem revoo (ADR-032).
 */
import { CONTRACTS } from '@/data/contracts';
import { flyMission } from '@/test/flyMission';
import { CHALLENGE } from './challenge';

const mediumScores: number[] = [];

describe('o jogador mediano', () => {
  it.each(CONTRACTS.map((c) => [c.id, c] as const))(
    '%s: aprovado, com execução de pelo menos 0,7',
    (_id, contract) => {
      const f = flyMission(contract, 'MEDIUM');
      expect(
        f.report.approved,
        f.report.requirements
          .filter((r) => !r.pass)
          .map((r) => r.id)
          .join(' '),
      ).toBe(true);
      expect(f.execution).toBeGreaterThanOrEqual(CHALLENGE.mediumMinExecution);
      mediumScores.push(f.report.qualityScore);
    },
    60_000,
  );

  it('a nota média dele não fica abaixo da que a simulação da campanha usa', () => {
    const mean = mediumScores.reduce((a, b) => a + b, 0) / mediumScores.length;
    expect(mediumScores).toHaveLength(CONTRACTS.length);
    expect(mean).toBeGreaterThanOrEqual(CHALLENGE.mediumMeanScore);
  });
});

describe('o piloto bom (autopilot)', () => {
  it.each(CONTRACTS.map((c) => [c.id, c] as const))(
    '%s: aprovado, com execução de pelo menos 0,9 e nenhuma linha recusada',
    (_id, contract) => {
      const f = flyMission(contract, 'GOOD');
      expect(f.report.approved).toBe(true);
      expect(f.execution).toBeGreaterThanOrEqual(CHALLENGE.goodMinExecution);
      expect(f.refused).toBe(0);
    },
    60_000,
  );
});
