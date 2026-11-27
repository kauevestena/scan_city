/**
 * Dificuldade do voo — domain-math §5.3 (ADR-035). Puro.
 *
 * O jogador escolhe no checklist, antes de decolar, e vale para a missão inteira (todas as
 * surtidas). A média é o voo como ele era (o ritmo ×1,75), mais as rajadas e as correntes
 * verticais de vez em quando; a fácil é mais lenta e só tem vento horizontal; a difícil é mais
 * rápida, com rajadas mais frequentes e mais verticais, e uma janela de curva curta. A fácil
 * paga menos e a difícil, mais.
 */
import type { FlightDifficulty } from '@/types';
import type { TurnWindow } from './turnManeuver';

export interface DifficultyParams {
  /** Ritmo do voo: tempo simulado por segundo real, na decolagem e nas linhas. */
  tempo: number;
  /** Uma rajada a cada tantos segundos de linha. */
  gustPeriodS: number;
  /** Fração das rajadas que sobem ou descem (as outras empurram de lado). */
  verticalGustShare: number;
  /** Uma corrente vertical a cada tantos segundos de linha; `null`, nenhuma. */
  draftPeriodS: number | null;
  /** A janela da manobra de troca de faixa, em segundos reais em volta do portal da curva. */
  turnWindow: TurnWindow;
  /** Multiplicador do pagamento do contrato. */
  paymentFactor: number;
}

export const DIFFICULTIES: readonly FlightDifficulty[] = ['EASY', 'MEDIUM', 'HARD'];
export const DEFAULT_DIFFICULTY: FlightDifficulty = 'MEDIUM';

export const DIFFICULTY: Readonly<Record<FlightDifficulty, DifficultyParams>> = {
  EASY: {
    tempo: 1.3,
    gustPeriodS: 7,
    verticalGustShare: 0,
    draftPeriodS: null,
    turnWindow: { earlyS: 0.9, lateS: 0.6 },
    paymentFactor: 0.8,
  },
  MEDIUM: {
    tempo: 1.75,
    gustPeriodS: 7,
    verticalGustShare: 0.25,
    draftPeriodS: 22,
    turnWindow: { earlyS: 0.45, lateS: 0.3 },
    paymentFactor: 1,
  },
  HARD: {
    tempo: 2.1,
    gustPeriodS: 5.5,
    verticalGustShare: 0.45,
    draftPeriodS: 13,
    turnWindow: { earlyS: 0.25, lateS: 0.15 },
    paymentFactor: 1.25,
  },
};

/** A dificuldade da missão: a média quando não há escolha (save antigo, missão sintética). */
export function missionDifficulty(m: { difficulty?: FlightDifficulty }): FlightDifficulty {
  return m.difficulty ?? DEFAULT_DIFFICULTY;
}

/** Os parâmetros da dificuldade da missão. */
export function difficultyParams(m: { difficulty?: FlightDifficulty }): DifficultyParams {
  return DIFFICULTY[missionDifficulty(m)];
}
