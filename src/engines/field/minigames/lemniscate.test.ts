import {
  CURSOR_SPEED,
  LEMNISCATE_A,
  LEMNISCATE_DURATION_S,
  LemniscateSim,
  guideAt,
  lemniscatePoint,
} from './lemniscate';

const DT = 1 / 60;

describe('curva e guia', () => {
  it('lemniscata de Bernoulli: pontos extremos e passagem pela origem', () => {
    expect(lemniscatePoint(0)).toEqual({ x: LEMNISCATE_A, y: 0 });
    const mid = lemniscatePoint(Math.PI / 2);
    expect(mid.x).toBeCloseTo(0, 10);
    expect(mid.y).toBeCloseTo(0, 10);
    expect(lemniscatePoint(Math.PI).x).toBeCloseTo(-LEMNISCATE_A, 10);
  });

  it('2 voltas em 12 s: o guia volta ao ponto de partida a cada 6 s', () => {
    const start = guideAt(0);
    for (const t of [6, 12]) {
      expect(guideAt(t).x).toBeCloseTo(start.x, 8);
      expect(guideAt(t).y).toBeCloseTo(start.y, 8);
    }
  });
});

describe('LemniscateSim', () => {
  it('cursor colado no guia (mouse) dá imuScore 1, com 360 amostras a 30 Hz', () => {
    const sim = new LemniscateSim();
    let t = 0;
    while (sim.phase === 'RUNNING') {
      t += DT;
      sim.setInput({ moveX: 0, moveY: 0, pointer: guideAt(t) });
      sim.update(DT);
    }
    expect(sim.elapsedS).toBeCloseTo(LEMNISCATE_DURATION_S, 6);
    expect(sim.distances.length).toBe(360);
    expect(sim.score).toBeGreaterThan(0.99);
  });

  it('parado no ponto de partida (sem seguir o guia), o score é 0', () => {
    const sim = new LemniscateSim();
    while (sim.phase === 'RUNNING') sim.update(DT);
    expect(sim.score).toBeLessThan(0.05);
  });

  it('o analógico move o cursor a 350 px/s e é limitado ao canvas', () => {
    const sim = new LemniscateSim();
    const x0 = sim.cursor.x;
    sim.setInput({ moveX: -1, moveY: 0 });
    for (let i = 0; i < 30; i++) sim.update(DT);
    expect(x0 - sim.cursor.x).toBeCloseTo(CURSOR_SPEED * 0.5, 4);
    for (let i = 0; i < 300; i++) sim.update(DT);
    expect(sim.cursor.x).toBeGreaterThanOrEqual(-240);
    // MOVE_Y positivo sobe (y diminui).
    const sim2 = new LemniscateSim();
    const y0 = sim2.cursor.y;
    sim2.setInput({ moveX: 0, moveY: 1 });
    sim2.update(DT);
    expect(sim2.cursor.y).toBeLessThan(y0);
  });

  it('a amostragem não depende do tamanho do passo', () => {
    const sim = new LemniscateSim();
    while (sim.phase === 'RUNNING') sim.update(1 / 120);
    expect(sim.distances.length).toBe(360);
  });
});
