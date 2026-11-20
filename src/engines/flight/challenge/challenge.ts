/**
 * Metas de desafio do voo (ADR-032, REQ-NFR-010): os limites que os testes conferem com os
 * pilotos simulados, num lugar só.
 */
import { MIN_EXECUTION } from '@/data/contracts/common';

export const CHALLENGE = {
  /** O mediano aprova em todos os contratos com pelo menos esta execução. */
  mediumMinExecution: 0.7,
  /** A nota média do mediano não fica abaixo da usada na simulação da campanha (0,8). */
  mediumMeanScore: 0.8,
  /** O bom aprova com pelo menos esta execução e sem nenhuma linha recusada. */
  goodMinExecution: 0.9,
  /** O distraído fica pelo menos isto abaixo do mediano, em todo contrato. */
  alignGap: 0.2,
  /** O distraído reprova em pelo menos tantos contratos (dos 18). */
  alignMinRejected: 15,
  /** O parado não passa da execução mínima dos contratos. */
  idleMaxExecution: MIN_EXECUTION,
} as const;
