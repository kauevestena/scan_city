/** Rival MegaMap — domain-math §13 e progression §8. */
import type { Rng } from '@/lib/rng';
import type { ContractProgress, QualityReport } from '@/types';

export const COUNTER_OFFER_CHANCE = 0.2;
export const MATCH_PRICE_FACTOR = 0.85;
export const PORTFOLIO_FAIL_REPUTATION = -2;
/** Classe gravada quando o contrato é aprovado em ASPRS com RMSE_H ≤ 5 cm. */
export const ASPRS_TOP_CLASS = 'ASPRS-H5';

/** A MegaMap faz contraproposta? p = 0,20 · rivalChance. */
export function rollCounterOffer(rng: Rng, rivalChanceMod: number): boolean {
  return rng.next() < COUNTER_OFFER_CHANCE * rivalChanceMod;
}

/** Classe a guardar em `ContractProgress.bestClass` a partir do relatório. */
export function portfolioClass(report: Pick<QualityReport, 'pec' | 'asprs'>): string | undefined {
  if (report.pec) return report.pec.planimetric.achieved;
  if (report.asprs) {
    const pass = report.asprs.passH && report.asprs.passV;
    if (!pass) return 'FORA';
    return report.asprs.rmseHcm <= 5 ? ASPRS_TOP_CLASS : 'ASPRS';
  }
  return undefined;
}

/**
 * Resposta "Apresentar portfólio técnico": com algum contrato concluído em classe A (PEC) ou
 * ASPRS com H ≤ 5 cm, o preço se mantém; senão, o cliente iguala a MegaMap e a reputação cai 2.
 */
export function portfolioOutcome(contracts: Readonly<Record<string, ContractProgress>>): {
  rivalAdjustment: number;
  reputationDelta: number;
  convinced: boolean;
} {
  const convinced = Object.values(contracts).some(
    (p) => p.status === 'COMPLETED' && (p.bestClass === 'A' || p.bestClass === ASPRS_TOP_CLASS),
  );
  return convinced
    ? { rivalAdjustment: 1, reputationDelta: 0, convinced }
    : {
        rivalAdjustment: MATCH_PRICE_FACTOR,
        reputationDelta: PORTFOLIO_FAIL_REPUTATION,
        convinced,
      };
}

/** A MegaMap toma o contrato após uma falha crítica (nunca em replay). */
export function stealContract(
  progress: ContractProgress,
  contractsCompleted: number,
  isReplay: boolean,
): ContractProgress {
  if (isReplay) return progress;
  return { ...progress, status: 'STOLEN', stolenAtCompletionCount: contractsCompleted };
}

/** Contratos roubados voltam depois que o jogador conclui **outro** contrato. */
export function returnStolen(
  contracts: Readonly<Record<string, ContractProgress>>,
  contractsCompleted: number,
): Record<string, ContractProgress> {
  const out: Record<string, ContractProgress> = {};
  for (const [id, p] of Object.entries(contracts)) {
    if (p.status === 'STOLEN' && contractsCompleted > (p.stolenAtCompletionCount ?? Infinity)) {
      const { stolenAtCompletionCount: _gone, ...rest } = p;
      out[id] = { ...rest, status: 'AVAILABLE' };
    } else {
      out[id] = p;
    }
  }
  return out;
}
