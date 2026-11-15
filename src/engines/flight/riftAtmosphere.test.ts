import { CATALOG } from '@/data/catalog';
import { C00 } from '@/data/contracts';
import { buildFlightPlan } from '@/domain/flightPlanner';
import { neutralModifiers } from '@/domain/modifiers';
import { referenceParams } from '@/domain/referencePlan';
import { COLORS } from '@/ui/tokens';
import type { Contract, MissionData } from '@/types';
import { createTerrain } from '@/world/terrain/createTerrain';
import { FlightEngine } from './FlightEngine';
import { drawRiftParticles, drawRiftSky, RIFT_PARTICLES } from './sky';

const ctx2d = () => document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;

/** Valores atribuídos a `fillStyle`, na ordem (vitest-canvas-mock). */
const fills = (ctx: CanvasRenderingContext2D) =>
  (ctx as unknown as { __getEvents(): Array<{ type: string; props: { value?: unknown } }> })
    .__getEvents()
    .filter((e) => e.type === 'fillStyle')
    .map((e) => e.props.value);

describe('céu e partículas das fendas', () => {
  it('o céu é um gradiente violeta → ciano até o horizonte, e respira com o tempo', () => {
    const ctx = ctx2d();
    drawRiftSky(ctx, 800, 300, 0);
    expect(ctx.createLinearGradient).toHaveBeenCalledWith(0, 0, 0, 300);
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 800, 301);
    const gradient = (
      ctx.createLinearGradient as unknown as { mock: { results: Array<{ value: CanvasGradient }> } }
    ).mock.results[0]?.value;
    expect(gradient?.addColorStop).toHaveBeenCalledTimes(2);
    const stops = (
      gradient?.addColorStop as unknown as { mock: { calls: Array<[number, string]> } }
    ).mock.calls;
    expect(stops[0]?.[1]).toMatch(/^rgba\(139, 92, 246, /); // violeta no alto
    expect(stops[1]?.[1]).toMatch(/^rgba\(34, 211, 238, /); // ciano no horizonte
    // Parado (reduceFlashes), o véu é o mesmo em qualquer instante.
    const a = ctx2d();
    const b = ctx2d();
    drawRiftSky(a, 800, 300, 1, true);
    drawRiftSky(b, 800, 300, 9, true);
    const stopsOf = (c: CanvasRenderingContext2D) =>
      (
        (
          c.createLinearGradient as unknown as {
            mock: { results: Array<{ value: CanvasGradient }> };
          }
        ).mock.results[0]?.value.addColorStop as unknown as { mock: { calls: unknown[] } }
      ).mock.calls;
    expect(stopsOf(a)).toEqual(stopsOf(b));
  });

  it('48 partículas alternando violeta e ciano, que sobem com o tempo', () => {
    const early = ctx2d();
    drawRiftParticles(early, 800, 600, 1);
    expect(early.fillRect).toHaveBeenCalledTimes(RIFT_PARTICLES);
    const colors = new Set(fills(early));
    expect(colors).toEqual(new Set(['rgba(139, 92, 246, 0.55)', 'rgba(34, 211, 238, 0.55)']));
    const ys = (c: CanvasRenderingContext2D) =>
      (c.fillRect as unknown as { mock: { calls: number[][] } }).mock.calls.map(
        (k) => k[1] as number,
      );
    const later = ctx2d();
    drawRiftParticles(later, 800, 600, 1.5);
    // Em meio segundo, as que não deram a volta subiram (y diminuiu).
    const moved = ys(early).filter((y, i) => (ys(later)[i] as number) < y);
    expect(moved.length).toBeGreaterThan(RIFT_PARTICLES / 2);
    expect(COLORS.rift).toBe('#8b5cf6');
  });
});

describe('FlightEngine em uma fenda', () => {
  function engine(contract: Contract, reduceFlashes = false) {
    const mission: MissionData = {
      id: `${contract.id}-1`,
      contractId: contract.id,
      createdAt: 0,
      rivalAdjustment: 1,
      isReplay: false,
      plan: buildFlightPlan(referenceParams(C00), C00, CATALOG),
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
    let now = 0;
    const e = new FlightEngine({
      mission,
      contract,
      terrain: createTerrain(C00),
      catalog: CATALOG,
      input: { axis: () => 0 },
      mods: neutralModifiers(),
      ownsRtkKit: false,
      autopilot: true,
      quality: () => 'LOW',
      reduceFlashes: () => reduceFlashes,
      colors: { primary: '#64748b', secondary: '#0f172a' },
      sortie: 0,
      shotOffset: 0,
      now: () => (now += 200),
    });
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    e.attach({ ctx, width: 1280, height: 720, dpr: 1 });
    for (let t = 0; t < 4; t += 1 / 60) e.update(1 / 60);
    e.render();
    return ctx;
  }
  const rift: Contract = { ...C00, id: 'R99', dimension: 'RIFT' };
  const gradients = (c: CanvasRenderingContext2D) =>
    (c.createLinearGradient as unknown as { mock: { calls: unknown[] } }).mock.calls.length;
  const rects = (c: CanvasRenderingContext2D) =>
    (c.fillRect as unknown as { mock: { calls: unknown[] } }).mock.calls.length;

  it('só a fenda ganha o véu de céu e as partículas; o contrato real, não', () => {
    const real = engine(C00);
    const inRift = engine(rift);
    expect(gradients(inRift)).toBe(gradients(real) + 1);
    expect(rects(inRift)).toBeGreaterThanOrEqual(rects(real) + RIFT_PARTICLES);
  });

  it('com reduceFlashes mantém o céu da fenda, mas sem as partículas', () => {
    const calm = engine(rift, true);
    const live = engine(rift, false);
    expect(gradients(calm)).toBe(gradients(live));
    expect(rects(live) - rects(calm)).toBe(RIFT_PARTICLES);
  });
});
