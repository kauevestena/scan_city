import {
  CURSOR_SPEED,
  drawLemniscate,
  fitScale,
  LEMNISCATE_A,
  LEMNISCATE_CANVAS_H,
  LEMNISCATE_CANVAS_W,
  LEMNISCATE_DURATION_S,
  LEMNISCATE_READY_S,
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

  it('2 voltas em 20 s: o guia volta ao ponto de partida a cada 10 s', () => {
    expect(LEMNISCATE_DURATION_S).toBe(20);
    const start = guideAt(0);
    for (const t of [10, 20]) {
      expect(guideAt(t).x).toBeCloseTo(start.x, 8);
      expect(guideAt(t).y).toBeCloseTo(start.y, 8);
    }
  });
});

/** Avança a preparação inteira, com o cursor parado. */
function skipReady(sim: LemniscateSim): void {
  while (sim.phase === 'READY') sim.update(DT);
}

describe('LemniscateSim', () => {
  it('a preparação não amostra nem move o guia; o cursor já se mexe', () => {
    const sim = new LemniscateSim();
    expect(sim.phase).toBe('READY');
    const g0 = sim.guide;
    const x0 = sim.cursor.x;
    sim.setInput({ moveX: -1, moveY: 0 });
    for (let i = 0; i < Math.round((LEMNISCATE_READY_S - 0.1) / DT); i++) sim.update(DT);
    expect(sim.phase).toBe('READY');
    expect(sim.distances).toHaveLength(0);
    expect(sim.elapsedS).toBe(0);
    expect(sim.guide).toEqual(g0);
    expect(sim.cursor.x).toBeLessThan(x0);
    for (let i = 0; i < 12; i++) sim.update(DT);
    expect(sim.phase).toBe('RUNNING');
  });

  it('um passo grande atravessa a preparação e já conta o resto', () => {
    const sim = new LemniscateSim();
    sim.update(LEMNISCATE_READY_S + 0.5);
    expect(sim.phase).toBe('RUNNING');
    expect(sim.elapsedS).toBeCloseTo(0.5, 9);
  });

  it('cursor colado no guia (mouse) dá imuScore 1, com 600 amostras a 30 Hz', () => {
    const sim = new LemniscateSim();
    skipReady(sim);
    let t = 0;
    while (sim.phase === 'RUNNING') {
      t += DT;
      sim.setInput({ moveX: 0, moveY: 0, pointer: guideAt(t) });
      sim.update(DT);
    }
    expect(sim.elapsedS).toBeCloseTo(LEMNISCATE_DURATION_S, 6);
    expect(sim.distances.length).toBe(600);
    expect(sim.score).toBeGreaterThan(0.99);
  });

  it('parado no ponto de partida (sem seguir o guia), o score é 0', () => {
    const sim = new LemniscateSim();
    while (sim.phase !== 'DONE') sim.update(DT);
    expect(sim.score).toBeLessThan(0.05);
  });

  it('seguir com 25 px de atraso ainda vale mais da metade', () => {
    const sim = new LemniscateSim();
    skipReady(sim);
    let t = 0;
    while (sim.phase === 'RUNNING') {
      t += DT;
      const g = guideAt(t);
      sim.setInput({ moveX: 0, moveY: 0, pointer: { x: g.x + 25, y: g.y } });
      sim.update(DT);
    }
    expect(sim.score).toBeGreaterThan(0.5);
  });

  it('o analógico move o cursor a 350 px/s e é limitado ao canvas', () => {
    const sim = new LemniscateSim();
    skipReady(sim);
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
    while (sim.phase !== 'DONE') sim.update(1 / 120);
    expect(sim.distances.length).toBe(600);
  });
});

describe('desenho', () => {
  it('a cena de 480 × 300 cabe inteira num canvas mais estreito', () => {
    expect(fitScale(311, 194, LEMNISCATE_CANVAS_W, LEMNISCATE_CANVAS_H)).toBeCloseTo(194 / 300, 6);
    expect(fitScale(960, 600, LEMNISCATE_CANVAS_W, LEMNISCATE_CANVAS_H)).toBe(2);
    expect(fitScale(0, 0, LEMNISCATE_CANVAS_W, LEMNISCATE_CANVAS_H)).toBe(1);
  });

  it('escala o desenho pelo tamanho do canvas e o fundo cobre o canvas todo', () => {
    const ctx = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;
    const scale = vi.spyOn(ctx, 'scale');
    const fill = vi.spyOn(ctx, 'fillRect');
    drawLemniscate(
      ctx,
      new LemniscateSim(),
      { bg: '#000', curve: '#111', cursor: '#0ff', guide: '#fa0' },
      240,
      150,
    );
    expect(scale).toHaveBeenCalledWith(0.5, 0.5);
    expect(fill).toHaveBeenCalledWith(0, 0, 240, 150);
  });
});
