import { DIFFICULTY } from '@/domain/difficulty';
import { makeCamera } from './projection';
import {
  buildTurnGate,
  drawTurnGate,
  TURN_GATE_RGB,
  TURN_GATE_VIEW_M,
  turnArrowShape,
  turnArrowSize,
  type TurnGateInput,
} from './turnGate';

const cam = makeCamera(1280, 720, 0, 72, 'HIGH');
const input = (over: Partial<TurnGateInput> = {}): TurnGateInput => ({
  Z: 120,
  alt: 72,
  side: 1,
  spacingM: 33,
  heightM: 60,
  cam,
  toGateS: 2,
  window: DIFFICULTY.MEDIUM.turnWindow,
  judged: null,
  timeS: 0,
  reduceFlashes: true,
  ...over,
});

describe('portal da curva (ADR-035)', () => {
  it('a seta aponta para o lado da próxima faixa, com o tamanho da faixa e da altura', () => {
    expect(turnArrowSize(33, 60)).toEqual({ halfW: 7.26, halfH: 6 });
    expect(turnArrowSize(10, 20)).toEqual({ halfW: 6, halfH: 3 });
    const right = turnArrowShape(1, 10, 4);
    const tip = right.reduce((a, b) => (b[0] > a[0] ? b : a));
    expect(tip).toEqual([10, 0]);
    const left = turnArrowShape(-1, 10, 4);
    expect(left.reduce((a, b) => (b[0] < a[0] ? b : a))).toEqual([-10, 0]);
  });

  it('aparece de longe e some atrás da câmera; na janela, acende', () => {
    expect(buildTurnGate(input({ Z: TURN_GATE_VIEW_M + 1 }))).toBeNull();
    expect(buildTurnGate(input({ Z: 0.5 }))).toBeNull();
    const far = buildTurnGate(input({ Z: 300 }));
    const near = buildTurnGate(input({ Z: 60 }));
    expect(far?.points).toHaveLength(14);
    expect(near?.strokeAlpha ?? 0).toBeGreaterThan(far?.strokeAlpha ?? 1);
    expect(near?.inWindow).toBe(false);
    const inWindow = buildTurnGate(input({ Z: 10, toGateS: 0.2 }));
    expect(inWindow?.inWindow).toBe(true);
    expect(inWindow?.lineWidth ?? 0).toBeGreaterThan(near?.lineWidth ?? 9);
    expect(inWindow?.rgb).toBe(TURN_GATE_RGB.WAITING);
  });

  it('verde na curva no tempo; rosa na perdida', () => {
    expect(buildTurnGate(input({ judged: 'ON_TIME' }))?.rgb).toBe(TURN_GATE_RGB.DONE);
    expect(buildTurnGate(input({ judged: 'EARLY' }))?.rgb).toBe(TURN_GATE_RGB.MISSED);
    expect(buildTurnGate(input({ judged: 'WRONG_SIDE' }))?.rgb).toBe(TURN_GATE_RGB.MISSED);
  });

  it('o desenho: um preenchimento e um contorno; sem seta, nada', () => {
    const ctx = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;
    drawTurnGate(ctx, buildTurnGate(input()));
    expect(ctx.fill).toHaveBeenCalledTimes(1);
    expect(ctx.stroke).toHaveBeenCalledTimes(1);
    const none = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;
    drawTurnGate(none, null);
    expect(none.fill).not.toHaveBeenCalled();
  });
});
