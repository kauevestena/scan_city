import { CATALOG } from '@/data/catalog';
import { C00 } from '@/data/contracts';
import { shadowLengthM } from '@/domain/flightPhysics';
import { buildFlightPlan } from '@/domain/flightPlanner';
import { LIGHTING } from '@/domain/photogrammetry';
import { referenceParams } from '@/test/fixtures/syntheticMission';
import type { LightingId } from '@/types';
import { createTerrain } from '@/world/terrain/createTerrain';
import { cameraModel, recordShot } from './cameraSensor';
import { MAX_PARTICLES, particleKind, WeatherParticles, WIND_PX_PER_MS } from './particles';
import { makeCamera } from './projection';
import { runFrame } from './runFrame';
import { buildDrawList, sunInRunFrame, type TerrainScene } from './terrainRenderer';

const palette = createTerrain(C00).palette;
const LIGHTS: LightingId[] = ['SUN_HIGH', 'OVERCAST', 'GOLDEN_HOUR', 'BLIZZARD', 'MAGIC_FOG'];

function scene(lighting: LightingId, over: Partial<TerrainScene> = {}): TerrainScene {
  return {
    cam: makeCamera(1280, 720, 0, 60),
    quality: 'LOW',
    elevation: () => 0,
    cover: () => 'GRASS',
    palette,
    lighting,
    sun: sunInRunFrame(lighting, { u: 1, v: 0 }, { u: 0, v: 1 }),
    reliefM: 10,
    timeS: 0,
    objects: [
      {
        id: 1,
        kind: 'BUILDING',
        X: 4,
        Z: 80,
        widthM: 10,
        depthM: 10,
        heightM: 20,
        baseM: 0,
        color: [150, 120, 100],
      },
    ],
    marks: [],
    ...over,
  };
}

describe('iluminação (REQ-FLT-012)', () => {
  it('as 5 janelas: exposição e sombra distintas; só sol projeta sombra na draw list', () => {
    const shadows = Object.fromEntries(
      LIGHTS.map((l) => [l, buildDrawList(scene(l)).filter((c) => c.type === 'SHADOW')]),
    );
    expect(shadows.SUN_HIGH).toHaveLength(1);
    expect(shadows.GOLDEN_HOUR).toHaveLength(1);
    for (const l of ['OVERCAST', 'BLIZZARD', 'MAGIC_FOG'] as const)
      expect(shadows[l]).toHaveLength(0);
    const sun = shadows.SUN_HIGH?.[0];
    const golden = shadows.GOLDEN_HOUR?.[0];
    expect(sun?.type === 'SHADOW' && sun.lengthM).toBeCloseTo(shadowLengthM(20, 'SUN_HIGH'), 9);
    expect(golden?.type === 'SHADOW' && golden.lengthM).toBeCloseTo(142.307, 2);
    expect(
      golden?.type === 'SHADOW' && sun?.type === 'SHADOW' && golden.lengthM > sun.lengthM * 10,
    ).toBe(true);
    // Exposição distinta por janela (blur).
    expect(new Set(LIGHTS.map((l) => LIGHTING[l].exposureS)).size).toBe(5);
  });

  it('a draw list difere entre as paletas (cor dos quads)', () => {
    const first = (l: LightingId) => buildDrawList(scene(l)).find((c) => c.type === 'QUAD');
    expect(first('SUN_HIGH')).not.toEqual(first('OVERCAST'));
  });

  it('fios, anéis e postes não projetam sombra', () => {
    const wire = {
      id: 2,
      kind: 'WIRE' as const,
      X: 0,
      Z: 50,
      widthM: 1,
      heightM: 1,
      baseM: 10,
      color: [0, 0, 0] as [number, number, number],
    };
    const list = buildDrawList(scene('GOLDEN_HOUR', { objects: [wire] }));
    expect(list.some((c) => c.type === 'SHADOW')).toBe(false);
  });
});

describe('água especular (REQ-FLT-021)', () => {
  const water = { cover: () => 'WATER' as const };
  it('brilho só com SPECULAR_WATER sob SUN_HIGH', () => {
    const glints = (l: LightingId, specular: boolean) =>
      buildDrawList(scene(l, { ...water, specularWater: specular })).filter(
        (c) => c.type === 'GLINT',
      ).length;
    expect(glints('SUN_HIGH', true)).toBeGreaterThan(0);
    expect(glints('SUN_HIGH', false)).toBe(0);
    expect(glints('OVERCAST', true)).toBe(0);
  });

  it('fotos sobre água marcam overWater; MAGIC_FOG marca inFog', () => {
    const plan = buildFlightPlan(referenceParams(C00), C00, CATALOG);
    const base = createTerrain(C00);
    const frame = runFrame(plan.lines[0]!);
    const shotWith = (lighting: LightingId, cover: 'WATER' | 'GRASS') =>
      recordShot({
        index: 0,
        tS: 0,
        sortie: 0,
        lineIndex: 0,
        frame,
        s: 100,
        x: 0,
        altM: 70,
        speedMs: 10,
        crabRad: 0,
        tiltDeg: 0,
        lighting,
        rtk: 'NONE',
        manual: false,
        camera: cameraModel(plan, CATALOG),
        terrain: { elevation: base.elevation, landCover: () => cover },
      });
    expect(shotWith('SUN_HIGH', 'WATER').overWater).toBe(true);
    expect(shotWith('SUN_HIGH', 'GRASS').overWater).toBe(false);
    expect(shotWith('MAGIC_FOG', 'GRASS').inFog).toBe(true);
    expect(shotWith('SUN_HIGH', 'GRASS').inFog).toBe(false);
  });
});

describe('partículas do clima (§5.5)', () => {
  it('neve no BLIZZARD, vaga-lumes na MAGIC_FOG, nada nas demais; no máximo 300', () => {
    expect(LIGHTS.map(particleKind)).toEqual([null, null, null, 'SNOW', 'FIREFLY']);
    expect(new WeatherParticles('SUN_HIGH', 800, 600).particles).toHaveLength(0);
    expect(new WeatherParticles('BLIZZARD', 800, 600).particles.length).toBeLessThanOrEqual(
      MAX_PARTICLES,
    );
    expect(new WeatherParticles('BLIZZARD', 800, 600, 1, 50).particles).toHaveLength(50);
    expect(new WeatherParticles('MAGIC_FOG', 800, 600).particles.length).toBeGreaterThan(0);
  });

  it('a neve respeita o vento: deriva para o lado do vento e cai', () => {
    const calm = new WeatherParticles('BLIZZARD', 800, 600, 7);
    const right = new WeatherParticles('BLIZZARD', 800, 600, 7);
    const left = new WeatherParticles('BLIZZARD', 800, 600, 7);
    const x0 = right.particles.map((p) => p.x);
    const y0 = right.particles.map((p) => p.y);
    calm.update(0.1, 0, 0);
    right.update(0.1, 5, 0);
    left.update(0.1, -5, 0);
    // Só as que não reentraram (as que passaram da borda renascem em outro x).
    const dx = (ps: typeof right.particles) =>
      ps.flatMap((p, k) => (p.y > (y0[k] as number) ? [p.x - (x0[k] as number)] : []));
    const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
    expect(mean(dx(calm.particles))).toBeCloseTo(0, 6);
    expect(mean(dx(right.particles))).toBeGreaterThan(5 * WIND_PX_PER_MS * 0.1 * 0.8);
    expect(mean(dx(left.particles))).toBeLessThan(-5 * WIND_PX_PER_MS * 0.1 * 0.8);
    expect(right.particles.some((p, k) => p.y > (y0[k] as number))).toBe(true);
  });

  it('as partículas que saem voltam, a contagem se mantém, e desenham', () => {
    const w = new WeatherParticles('BLIZZARD', 400, 300, 3);
    const n = w.particles.length;
    for (let t = 0; t < 600; t++) w.update(1 / 60, 8, t / 60);
    expect(w.particles).toHaveLength(n);
    expect(w.particles.every((p) => p.y <= 300 && p.x >= -8 && p.x <= 408)).toBe(true);
    const ctx = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;
    w.draw(ctx, 1);
    const f = new WeatherParticles('MAGIC_FOG', 400, 300);
    f.update(0.5, 0, 1);
    f.draw(ctx, 1);
    expect(ctx.fillRect).toHaveBeenCalled();
    expect(ctx.arc).toHaveBeenCalled();
  });
});
