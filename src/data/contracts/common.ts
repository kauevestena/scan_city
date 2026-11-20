/** O que todo contrato tem em comum (contracts-real §2). */
import type { ContractRequirement } from '@/types';

/** Execução mínima do voo nos contratos (domain-math §10.3); o tutorial pede menos. */
export const MIN_EXECUTION = 0.6;
export const MIN_EXECUTION_TUTORIAL = 0.4;

/**
 * Requisito comum a todo contrato, sempre o último da lista: a execução do voo. Abaixo do
 * valor, o voo é rejeitado no controle de qualidade e a missão é reprovada.
 */
export function executionRequirement(
  contractId: string,
  value: number = MIN_EXECUTION,
): ContractRequirement {
  return {
    id: `${contractId}-exec`,
    label: `Execução do voo ≥ ${Math.round(value * 100)} %`,
    severity: 'CRITICAL',
    check: { type: 'MIN_EXECUTION', value },
  };
}
