import { CATALOG } from '@/data/catalog';
import { R09 } from '@/data/contracts/rifts';
import { buildFlightPlan } from '@/domain/flightPlanner';
import { neutralModifiers } from '@/domain/modifiers';
import { referenceParams } from '@/domain/referencePlan';
import type { Contract, MissionData, PlanParams } from '@/types';
import { createTerrain } from '@/world/terrain/createTerrain';
import { drawElectricSparks, SPARK_COUNT } from './electricSparks';
import type { Spike } from './fieldElements';
import { FlightEngine } from './FlightEngine';

const ctx2d = () => document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;

type CanvasEvent = { type: string; props: { value?: unknown } };
const events = (ctx: CanvasRenderingContext2D) =>
  (ctx as unknown as { __getEvents(): CanvasEvent[] }).__getEvents();
/** Cores amarelas das faíscas (`rgba(250, 204, 21, a)`, sem zeros à direita), na ordem de desenho. */
const sparkFills = (ctx: CanvasRenderingContext2D) =>
  events(ctx)
    .filter((e) => e.type === 'fillStyle')
    .map((e) => String(e.props.value))
    .filter((v) => /^rgba\(250, 204, 21, [\d.]+\)$/.test(v));
const alpha = (fill: string) => Number(/, ([\d.]+)\)$/.exec(fill)?.[1]);
const rects = (ctx: CanvasRenderingContext2D) =>
  (ctx.fillRect as unknown as { mock: { calls: number[][] } }).mock.calls;

const spike = (side: -1 | 1 = 1, startS = 10): Spike => ({ startS, endS: startS + 2, side });
const W = 1280;
const H = 720;
const HORIZON = 300;

describe('faíscas das criaturas elétricas (puro)', () => {
  it('fora de um pico não desenha nada', () => {
    const ctx = ctx2d();
    drawElectricSparks(ctx, W, H, HORIZON, null, 11);
    expect(ctx.fillRect).not.toHaveBeenCalled();
  });

  it('durante o pico, 28 faíscas amarelas translúcidas, cada uma um retângulo pequeno', () => {
    const ctx = ctx2d();
    drawElectricSparks(ctx, W, H, HORIZON, spike(), 11);
    expect(SPARK_COUNT).toBe(28);
    expect(ctx.fillRect).toHaveBeenCalledTimes(SPARK_COUNT);
    const fills = sparkFills(ctx);
    expect(fills).toHaveLength(SPARK_COUNT);
    for (const f of fills) {
      expect(alpha(f)).toBeGreaterThanOrEqual(0);
      expect(alpha(f)).toBeLessThanOrEqual(0.9);
    }
    // No meio do pico (age 0,5) o brilho é máximo: a maioria passa de 0,2.
    expect(fills.filter((f) => alpha(f) > 0.2).length).toBeGreaterThan(SPARK_COUNT / 2);
    for (const [, , w, h] of rects(ctx)) {
      expect(w).toBeGreaterThanOrEqual(2);
      expect(w).toBeLessThanOrEqual(4);
      expect(h).toBeGreaterThanOrEqual(5);
      expect(h).toBeLessThanOrEqual(10);
    }
  });

  it('o pico sobe e some: sem brilho no instante em que começa e no em que termina', () => {
    const start = ctx2d();
    drawElectricSparks(start, W, H, HORIZON, spike(), 10);
    expect(sparkFills(start).every((f) => alpha(f) === 0)).toBe(true);
    const end = ctx2d();
    drawElectricSparks(end, W, H, HORIZON, spike(), 12);
    expect(sparkFills(end).every((f) => alpha(f) < 0.001)).toBe(true);
    const mid = ctx2d();
    drawElectricSparks(mid, W, H, HORIZON, spike(), 11);
    expect(Math.max(...sparkFills(mid).map(alpha))).toBeGreaterThan(0.3);
  });

  it('as faíscas ficam do lado da criatura, o oposto ao do empurrão', () => {
    // O pico empurra para o lado `side`; a criatura (e as faíscas) está do outro.
    const toRight = ctx2d();
    drawElectricSparks(toRight, W, H, HORIZON, spike(1), 11);
    for (const [x] of rects(toRight)) expect(x).toBeLessThanOrEqual(W / 2);
    const toLeft = ctx2d();
    drawElectricSparks(toLeft, W, H, HORIZON, spike(-1), 11);
    for (const [x] of rects(toLeft)) expect(x).toBeGreaterThanOrEqual(W / 2);
  });

  it('é determinístico: o mesmo pico no mesmo instante desenha igual, e outro pico desenha diferente', () => {
    const a = ctx2d();
    const b = ctx2d();
    drawElectricSparks(a, W, H, HORIZON, spike(), 11);
    drawElectricSparks(b, W, H, HORIZON, spike(), 11);
    expect(rects(a)).toEqual(rects(b));
    expect(sparkFills(a)).toEqual(sparkFills(b));
    const other = ctx2d();
    drawElectricSparks(other, W, H, HORIZON, spike(1, 22), 23);
    expect(rects(other)).not.toEqual(rects(a));
    // As faíscas sobem com o tempo: um instante depois a maioria está mais alta (y menor).
    const later = ctx2d();
    drawElectricSparks(later, W, H, HORIZON, spike(), 11.1);
    const moved = rects(a).filter(([, y], i) => (rects(later)[i]?.[1] as number) < (y as number));
    expect(moved.length).toBeGreaterThan(SPARK_COUNT / 2);
  });

  it('nascem na metade de baixo da tela (do capim), e o horizonte não é ultrapassado por muito', () => {
    const ctx = ctx2d();
    drawElectricSparks(ctx, W, H, HORIZON, spike(), 10.5);
    for (const [, y] of rects(ctx)) {
      expect(y).toBeLessThanOrEqual(H);
      expect(y).toBeGreaterThan(HORIZON - 200);
    }
  });
});

describe('FlightEngine: faíscas no voo da R09', () => {
  /** Só as criaturas (sem a interferência), para `emGlitch` marcar exatamente os picos. */
  const contract: Contract = { ...R09, specialRules: ['ELECTRIC_CREATURES'] };

  function scene(over: { reduceFlashes?: boolean; aircraft?: 'DRONE_T2' | 'ATLAS' } = {}) {
    const aircraft = over.aircraft ?? 'DRONE_T2';
    const params: PlanParams = {
      ...referenceParams(R09),
      ...(aircraft === 'ATLAS' ? { aircraftId: 'ATLAS', sensorId: 'CAM_PIGEON', speedMs: 10 } : {}),
    };
    const mission: MissionData = {
      id: 'sparks-1',
      contractId: R09.id,
      createdAt: 0,
      rivalAdjustment: 1,
      isReplay: false,
      plan: buildFlightPlan(params, contract, CATALOG),
      groundPoints: [],
      fieldEquipmentId: 'TOTAL_STATION',
      minigames: {},
      atlasCalibrated: false,
      sorties: [],
      completedLines: [],
      shots: [],
      events: {
        collisions: 0,
        crashes: 0,
        detected: false,
        featuresCaptured: [],
        ringsCollected: 0,
      },
      status: 'IN_FLIGHT',
    };
    const e = new FlightEngine({
      mission,
      contract,
      terrain: createTerrain(R09),
      catalog: CATALOG,
      input: { axis: () => 0 },
      mods: neutralModifiers(),
      ownsRtkKit: true,
      autopilot: true,
      quality: () => 'LOW',
      reduceFlashes: () => over.reduceFlashes ?? false,
      colors: { primary: '#64748b', secondary: '#0f172a' },
      sortie: 0,
      shotOffset: 0,
      now: () => 0,
    });
    const ctx = ctx2d();
    e.attach({ ctx, width: W, height: H, dpr: 1 });
    return { e, ctx };
  }

  /** Avança até o pico começar (o primeiro vem entre 8 e 12 s) e desenha um quadro; `null` se não vier. */
  function renderInSpike(s: ReturnType<typeof scene>): CanvasRenderingContext2D | null {
    for (let t = 0; t < 30; t += 1 / 60) {
      s.e.update(1 / 60);
      // Meio segundo depois do começo, no auge do brilho.
      if (s.e.snapshot().emGlitch) {
        for (let k = 0; k < 30; k++) s.e.update(1 / 60);
        const out = ctx2d();
        s.e.attach({ ctx: out, width: W, height: H, dpr: 1 });
        s.e.render();
        return out;
      }
    }
    return null;
  }

  it('o T2 vê as faíscas durante o pico e nenhuma fora dele', () => {
    const s = scene();
    s.e.update(1 / 60);
    s.e.render();
    expect(sparkFills(s.ctx)).toHaveLength(0);
    const frame = renderInSpike(s) as CanvasRenderingContext2D;
    expect(frame).not.toBeNull();
    expect(sparkFills(frame)).toHaveLength(SPARK_COUNT);
    // O pico passa (dura 2 s) e o quadro volta a ficar limpo.
    for (let k = 0; k < 150; k++) s.e.update(1 / 60);
    const after = ctx2d();
    s.e.attach({ ctx: after, width: W, height: H, dpr: 1 });
    s.e.render();
    expect(sparkFills(after)).toHaveLength(0);
  });

  it('com reduceFlashes não há faíscas, mesmo em pleno pico', () => {
    const s = scene({ reduceFlashes: true });
    const frame = renderInSpike(s) as CanvasRenderingContext2D;
    expect(frame).not.toBeNull();
    expect(sparkFills(frame)).toHaveLength(0);
  });

  it('o Atlas é imune: nenhum pico, nenhuma faísca', () => {
    const s = scene({ aircraft: 'ATLAS' });
    expect(renderInSpike(s)).toBeNull();
    s.e.render();
    expect(sparkFills(s.ctx)).toHaveLength(0);
  });
});
