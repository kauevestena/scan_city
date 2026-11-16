import { describe, expect, it, vi } from 'vitest';
import {
  FLIGHT_STAGE,
  HOLO_STAGE,
  PERF,
  setPerfEnabled,
  SMOOTHING,
  StageTimer,
  WORLD_STAGE,
} from './perf';

/** Relógio manual: `tick(ms)` avança o tempo. */
function clock() {
  let t = 100;
  return {
    now: () => t,
    tick: (ms: number) => {
      t += ms;
    },
  };
}

function timer(c = clock()) {
  return { c, t: new StageTimer('Teste', ['a', 'b', 'c'], c.now) };
}

describe('StageTimer', () => {
  it('desligado não lê o relógio nem acumula nada', () => {
    const now = vi.fn(() => 0);
    const t = new StageTimer('Teste', ['a', 'b'], now);
    t.enter(0);
    t.enter(1);
    t.leave();
    t.endFrame();
    expect(now).not.toHaveBeenCalled();
    expect(t.frameCount).toBe(0);
    expect(t.readings()).toEqual([
      { stage: 'a', ms: 0 },
      { stage: 'b', ms: 0 },
    ]);
  });

  it('cada instante é de uma etapa só: enter fecha a anterior e abre a nova', () => {
    const { c, t } = timer();
    t.setEnabled(true);
    t.enter(0);
    c.tick(2);
    t.enter(1);
    c.tick(3);
    t.leave();
    c.tick(50); // fora de qualquer etapa: não conta
    t.endFrame();
    expect(t.readings().map((r) => r.ms)).toEqual([2, 3, 0]);
    expect(t.totalMs).toBe(5);
    expect(t.frameCount).toBe(1);
  });

  it('visitas à mesma etapa no quadro se somam (objetos entre quads)', () => {
    const { c, t } = timer();
    t.setEnabled(true);
    t.enter(1);
    c.tick(1);
    t.enter(2);
    c.tick(4);
    t.enter(1);
    c.tick(1);
    t.enter(2);
    c.tick(4);
    t.endFrame(); // fecha a etapa que sobrou aberta
    expect(t.readings().map((r) => r.ms)).toEqual([0, 2, 8]);
  });

  it('o primeiro quadro entra inteiro; os seguintes pesam SMOOTHING na média', () => {
    const { c, t } = timer();
    t.setEnabled(true);
    t.enter(0);
    c.tick(10);
    t.endFrame();
    expect(t.readings()[0]?.ms).toBe(10);
    t.enter(0);
    c.tick(20);
    t.endFrame();
    expect(t.readings()[0]?.ms).toBeCloseTo(10 + (20 - 10) * SMOOTHING, 10);
    // Quadro sem a etapa: a média decai.
    t.endFrame();
    expect(t.readings()[0]?.ms).toBeCloseTo((10 + 10 * SMOOTHING) * (1 - SMOOTHING), 10);
  });

  it('ligar recomeça do zero e desligar para de medir', () => {
    const { c, t } = timer();
    t.setEnabled(true);
    t.enter(0);
    c.tick(7);
    t.endFrame();
    expect(t.totalMs).toBe(7);
    t.setEnabled(false);
    t.setEnabled(true);
    expect(t.totalMs).toBe(0);
    expect(t.frameCount).toBe(0);
    t.setEnabled(false);
    t.enter(0);
    c.tick(5);
    t.endFrame();
    expect(t.totalMs).toBe(0);
    expect(t.enabled).toBe(false);
  });

  it('leave sem etapa aberta não faz nada', () => {
    const { t } = timer();
    t.setEnabled(true);
    t.leave();
    t.endFrame();
    expect(t.totalMs).toBe(0);
  });
});

describe('contadores do jogo', () => {
  it('há um rótulo para cada etapa de cada tela', () => {
    expect(PERF.flight.stages).toHaveLength(Object.keys(FLIGHT_STAGE).length);
    expect(PERF.holo.stages).toHaveLength(Object.keys(HOLO_STAGE).length);
    expect(PERF.world.stages).toHaveLength(Object.keys(WORLD_STAGE).length);
    // Os índices são 0, 1, 2… sem buracos, na ordem do quadro.
    for (const stages of [FLIGHT_STAGE, HOLO_STAGE, WORLD_STAGE]) {
      expect(Object.values(stages)).toEqual(Object.values(stages).map((_, i) => i));
    }
  });

  it('setPerfEnabled liga e desliga todos', () => {
    setPerfEnabled(true);
    expect(Object.values(PERF).every((t) => t.enabled)).toBe(true);
    setPerfEnabled(false);
    expect(Object.values(PERF).some((t) => t.enabled)).toBe(false);
  });
});
