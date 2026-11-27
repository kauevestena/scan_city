import { FLIGHT_TEMPO, tempoFor } from './tempo';

describe('ritmo do voo', () => {
  it('×1,75 na decolagem e nas linhas; ×1 na curva, na arremetida, no pouso, no retorno e na queda', () => {
    expect(FLIGHT_TEMPO).toBe(1.75);
    expect(tempoFor('TAKEOFF')).toBe(FLIGHT_TEMPO);
    expect(tempoFor('RUN')).toBe(FLIGHT_TEMPO);
    for (const p of [
      'TURN',
      'GO_AROUND',
      'LANDING',
      'RETURNING',
      'CRASHED',
      'POST_FLIGHT',
    ] as const) {
      expect(tempoFor(p)).toBe(1);
      expect(tempoFor(p, 'HARD')).toBe(1);
    }
  });

  it('a dificuldade muda o ritmo das linhas: ×1,3 na fácil e ×2,1 na difícil (ADR-035)', () => {
    expect(tempoFor('RUN', 'EASY')).toBe(1.3);
    expect(tempoFor('RUN', 'MEDIUM')).toBe(FLIGHT_TEMPO);
    expect(tempoFor('TAKEOFF', 'HARD')).toBe(2.1);
  });
});
