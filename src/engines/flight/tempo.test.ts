import { FLIGHT_TEMPO, tempoFor } from './tempo';

describe('ritmo do voo', () => {
  it('×1,75 na decolagem e nas linhas; ×1 na curva, no pouso, no retorno e na queda', () => {
    expect(FLIGHT_TEMPO).toBe(1.75);
    expect(tempoFor('TAKEOFF')).toBe(FLIGHT_TEMPO);
    expect(tempoFor('RUN')).toBe(FLIGHT_TEMPO);
    for (const p of ['TURN', 'LANDING', 'RETURNING', 'CRASHED', 'POST_FLIGHT'] as const) {
      expect(tempoFor(p)).toBe(1);
    }
  });
});
