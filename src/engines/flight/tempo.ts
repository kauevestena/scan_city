/**
 * Ritmo do voo (survey-flight §5.14, ADR-034, ADR-035): o tempo simulado corre o ritmo da
 * dificuldade (×1,3 na fácil, ×1,75 na média, ×2,1 na difícil) vezes o real na decolagem e nas
 * linhas. A física, as fotos, a energia e as notas são as mesmas (tudo é medido em tempo de
 * simulação); só o jogador vê o mundo passar mais rápido e tem menos tempo real para reagir. A
 * curva (com o boletim), a arremetida, o pouso, o retorno e a queda ficam em ×1, para dar para
 * ler. O cruzeiro automático multiplica por cima.
 */
import { DEFAULT_DIFFICULTY, DIFFICULTY } from '@/domain/difficulty';
import type { FlightDifficulty } from '@/types';
import type { FlightPhase } from './hudPublisher';

/** Tempo simulado por segundo real nas linhas, na dificuldade média. */
export const FLIGHT_TEMPO = DIFFICULTY[DEFAULT_DIFFICULTY].tempo;

/** O ritmo base da fase: o da dificuldade na decolagem e nas linhas; ×1 nas outras. */
export function tempoFor(
  phase: FlightPhase,
  difficulty: FlightDifficulty = DEFAULT_DIFFICULTY,
): number {
  return phase === 'TAKEOFF' || phase === 'RUN' ? DIFFICULTY[difficulty].tempo : 1;
}
