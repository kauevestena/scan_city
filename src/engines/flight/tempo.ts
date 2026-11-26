/**
 * Ritmo do voo (survey-flight §5.14, ADR-034): o tempo simulado corre `FLIGHT_TEMPO` vezes o
 * real na decolagem e nas linhas. A física, as fotos, a energia e as notas são as mesmas (tudo é
 * medido em tempo de simulação); só o jogador vê o mundo passar mais rápido e tem menos tempo
 * real para reagir. A curva (com o boletim), o pouso, o retorno e a queda ficam em ×1, para dar
 * para ler. O cruzeiro automático multiplica por cima.
 */
import type { FlightPhase } from './hudPublisher';

/** Tempo simulado por segundo real, nas fases em que o ritmo vale. */
export const FLIGHT_TEMPO = 1.75;

/** O ritmo base da fase: `FLIGHT_TEMPO` na decolagem e nas linhas; ×1 nas outras. */
export function tempoFor(phase: FlightPhase): number {
  return phase === 'TAKEOFF' || phase === 'RUN' ? FLIGHT_TEMPO : 1;
}
