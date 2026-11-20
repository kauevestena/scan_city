import { corridorProfile, gatePositions } from '@/domain/corridor';
import {
  buildCorridorDrawList,
  drawCorridor,
  GATE_FLASH_S,
  GATE_VIEW_M,
  gustStreaks,
  GUST_STREAKS,
  MAX_GATES,
  type CorridorDrawInput,
} from './corridorRenderer';
import { makeCamera } from './projection';

const profile = corridorProfile(() => 100, 2000, {
  heightM: 60,
  speedMs: 10,
  climbRateMs: 3,
  ceilingAglM: 500,
});

function input(over: Partial<CorridorDrawInput> = {}): CorridorDrawInput {
  return {
    gates: gatePositions({ aoiStartS: 30, aoiEndS: 1900 }, 18),
    profile,
    s: 100,
    spacingM: 33,
    heightM: 60,
    cam: makeCamera(1280, 720, 0, 160),
    rift: false,
    flash: null,
    reduceFlashes: false,
    ...over,
  };
}

describe('buildCorridorDrawList (survey-flight §5.19)', () => {
  it('só os portais à frente, até 400 m, no máximo 16, de longe para perto', () => {
    const list = buildCorridorDrawList(input());
    expect(list).toHaveLength(MAX_GATES);
    for (const g of list) {
      expect(g.Z).toBeGreaterThan(0);
      expect(g.Z).toBeLessThanOrEqual(GATE_VIEW_M);
    }
    const zs = list.map((g) => g.Z);
    expect(zs).toEqual([...zs].sort((a, b) => b - a));
    // O mais perto é o próximo portal, o mais forte.
    expect(list.at(-1)?.next).toBe(true);
    expect(list.filter((g) => g.next)).toHaveLength(1);
    expect(list.at(-1)?.alpha).toBe(0.7);
  });

  it('o portal na altitude do corredor fica centrado na tela, e perto é maior que longe', () => {
    const list = buildCorridorDrawList(input());
    const near = list.at(-1)!;
    const far = list[0]!;
    // A câmera está em X = 0: o portal (centrado em X = 0) fica no meio da tela.
    expect((near.outer.x0 + near.outer.x1) / 2).toBeCloseTo(640, 6);
    expect(near.outer.x1 - near.outer.x0).toBeGreaterThan(far.outer.x1 - far.outer.x0);
    // A zona Perfeita (5 %) fica dentro do portal (10 %).
    expect(near.inner.x0).toBeGreaterThan(near.outer.x0);
    expect(near.inner.x1).toBeLessThan(near.outer.x1);
    expect(near.inner.y0).toBeGreaterThan(near.outer.y0);
    expect(near.inner.y1).toBeLessThan(near.outer.y1);
  });

  it('nas fendas o portal é violeta; sem portais à frente, nada', () => {
    expect(buildCorridorDrawList(input({ rift: true }))[0]?.rgb).toBe('196, 181, 253');
    expect(buildCorridorDrawList(input({ s: 5000 }))).toEqual([]);
  });

  it('o portal cruzado pisca na cor da nota, por 0,25 s, e nunca com reduceFlashes', () => {
    const calls: string[] = [];
    const ctx = {
      save: () => undefined,
      restore: () => undefined,
      beginPath: () => undefined,
      moveTo: () => undefined,
      lineTo: () => undefined,
      closePath: () => undefined,
      rect: () => undefined,
      stroke: () => undefined,
      strokeRect: () => calls.push('rect'),
      set strokeStyle(v: string) {
        calls.push(v);
      },
      lineWidth: 1,
    } as unknown as CanvasRenderingContext2D;
    const list = buildCorridorDrawList(input());
    const flash = { gateS: 90, grade: 'WEAK' as const, ageS: 0.1 };
    drawCorridor(ctx, list, flash, false, 1280, 720);
    expect(calls.some((c) => c.startsWith('rgba(251, 191, 36'))).toBe(true);
    calls.length = 0;
    drawCorridor(ctx, list, flash, true, 1280, 720);
    expect(calls.some((c) => c.startsWith('rgba(251, 191, 36'))).toBe(false);
    calls.length = 0;
    drawCorridor(ctx, list, { ...flash, ageS: GATE_FLASH_S }, false, 1280, 720);
    expect(calls.some((c) => c.startsWith('rgba(251, 191, 36'))).toBe(false);
  });
});

describe('riscos de vento da rajada', () => {
  it('poucos no aviso e todos no sopro, no sentido da rajada e abaixo do horizonte', () => {
    const warned = gustStreaks(1280, 720, 252, { side: 1, inS: 1, active: false }, 3, false);
    const active = gustStreaks(1280, 720, 252, { side: -1, inS: -1, active: true }, 3, false);
    expect(warned.length).toBeLessThan(active.length);
    expect(active).toHaveLength(GUST_STREAKS);
    for (const st of warned) expect(st.x1).toBeGreaterThan(st.x0);
    for (const st of active) {
      expect(st.x1).toBeLessThan(st.x0);
      expect(st.y).toBeGreaterThanOrEqual(252);
      expect(st.y).toBeLessThanOrEqual(720);
    }
  });

  it('andam com o tempo; com reduceFlashes o alfa não muda (não pisca)', () => {
    const g = { side: 1 as const, inS: -1, active: true };
    const a = gustStreaks(1280, 720, 252, g, 3, false);
    const b = gustStreaks(1280, 720, 252, g, 3.1, false);
    expect(a.map((s) => s.x0)).not.toEqual(b.map((s) => s.x0));
    const calmA = gustStreaks(1280, 720, 252, g, 3, true);
    const calmB = gustStreaks(1280, 720, 252, g, 3.7, true);
    expect(new Set([...calmA, ...calmB].map((s) => s.alpha))).toEqual(new Set([0.35]));
  });
});
