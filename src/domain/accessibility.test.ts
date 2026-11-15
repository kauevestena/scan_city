import { getVehicle } from '@/data/catalog';
import { POND, HOUSE, ORCHARD } from '@/world/terrain/biomes/ruralTutorial';
import { clearTerrainCache, createTerrain } from '@/world/terrain/createTerrain';
import { isAccessible, snapToAccessible, type AccessTerrain } from './accessibility';

const C00 = {
  id: 'C00',
  seed: 1001,
  biome: 'RURAL_TUTORIAL' as const,
  aoi: { widthM: 160, lengthM: 240 },
  terrainReliefM: 15,
};
const FOOT = [getVehicle('FOOT_BIKE')];
const PICKUP = [getVehicle('PICKUP_4X4')];
const NONE = { paintMarkers: false };

beforeEach(() => clearTerrainCache());

describe('isAccessible — C00', () => {
  const t = () => createTerrain(C00);

  it('água do açude', () => {
    expect(isAccessible(POND.u, POND.v, t(), FOOT, NONE)).toEqual({ ok: false, reason: 'WATER' });
  });

  it('telhado da casa', () => {
    expect(isAccessible(HOUSE.u, HOUSE.v, t(), FOOT, NONE)).toEqual({ ok: false, reason: 'ROOF' });
  });

  it('longe da estrada a pé (> 150 m); a 4x4 alcança (400 m)', () => {
    expect(isAccessible(288, -32 + 1, t(), FOOT, NONE)).toEqual({
      ok: false,
      reason: 'OUT_OF_REACH',
    });
    expect(isAccessible(288, -32 + 1, t(), [...FOOT, ...PICKUP], NONE)).toEqual({ ok: true });
  });

  it('sob a copa de uma árvore (dossel > 0,6); o pomar (0,5) é acessível', () => {
    const tree = t().objects.find(
      (o) => o.kind === 'TREE' && !(o.u >= ORCHARD.uMin && o.u <= ORCHARD.uMax),
    );
    expect(tree).toBeDefined();
    expect(isAccessible(tree?.u as number, tree?.v as number, t(), FOOT, NONE)).toEqual({
      ok: false,
      reason: 'CANOPY',
    });
    expect(isAccessible(ORCHARD.uMin + 1, ORCHARD.vMin + 1, t(), FOOT, NONE).ok).toBe(true);
  });

  it('os 7 pontos do plano de referência do C00 são acessíveis a pé', () => {
    const points = [
      [25, 20],
      [215, 20],
      [25, 140],
      [215, 140],
      [120, 80],
      [70, 50],
      [170, 110],
    ] as const;
    for (const [u, v] of points)
      expect(isAccessible(u, v, t(), FOOT, NONE), `${u},${v}`).toEqual({ ok: true });
  });

  it('PAINT_MARKERS ignora o alcance e o dossel, mas não a água nem o telhado', () => {
    expect(isAccessible(288, -31, t(), FOOT, { paintMarkers: true })).toEqual({ ok: true });
    const tree = t().objects.find((o) => o.kind === 'TREE') as { u: number; v: number };
    expect(isAccessible(tree.u, tree.v, t(), FOOT, { paintMarkers: true })).toEqual({ ok: true });
    expect(isAccessible(HOUSE.u, HOUSE.v, t(), FOOT, { paintMarkers: true }).reason).toBe('ROOF');
    expect(isAccessible(POND.u, POND.v, t(), FOOT, { paintMarkers: true }).reason).toBe('WATER');
  });

  it('sem veículos, nada fora d’água é alcançado', () => {
    expect(isAccessible(25, 20, t(), [], NONE)).toEqual({ ok: false, reason: 'OUT_OF_REACH' });
  });
});

describe('isAccessible — declividade, brejo e redes (terreno sintético)', () => {
  const flat = (overrides: Partial<AccessTerrain> = {}): AccessTerrain => ({
    landCover: () => 'GRASS',
    canopy: () => 0,
    slopePct: () => 0,
    distanceToRoad: () => 100,
    distanceToTrack: () => 10,
    ...overrides,
  });

  it('declividade acima do máximo de todos → TOO_STEEP; a 4x4 sobe até 60 %', () => {
    const steep = flat({ slopePct: () => 45 });
    expect(isAccessible(0, 0, steep, FOOT, NONE)).toEqual({ ok: false, reason: 'TOO_STEEP' });
    expect(isAccessible(0, 0, steep, PICKUP, NONE)).toEqual({ ok: true });
  });

  it('brejo só com a 4x4', () => {
    const swamp = flat({ landCover: () => 'SWAMP' });
    expect(isAccessible(0, 0, swamp, FOOT, NONE)).toEqual({ ok: false, reason: 'SWAMP' });
    expect(isAccessible(0, 0, swamp, PICKUP, NONE)).toEqual({ ok: true });
  });

  it('o carro só mede pela estrada; a pé conta a trilha', () => {
    const car = [getVehicle('COMPACT_CAR')];
    const t = flat({ distanceToRoad: () => 200, distanceToTrack: () => 20 });
    expect(isAccessible(0, 0, t, car, NONE)).toEqual({ ok: false, reason: 'OUT_OF_REACH' });
    expect(isAccessible(0, 0, t, FOOT, NONE)).toEqual({ ok: true });
  });
});

describe('snapToAccessible', () => {
  it('ponto já acessível volta igual; na água, vai para a margem (≤ 30 m)', () => {
    const t = createTerrain(C00);
    expect(snapToAccessible({ u: 25, v: 20 }, t, FOOT, NONE)).toEqual({ u: 25, v: 20 });
    const snapped = snapToAccessible({ u: POND.u + 10, v: POND.v }, t, FOOT, NONE);
    expect(snapped).not.toBeNull();
    const d = Math.hypot((snapped?.u as number) - (POND.u + 10), (snapped?.v as number) - POND.v);
    expect(d).toBeLessThanOrEqual(30);
    expect(isAccessible(snapped?.u as number, snapped?.v as number, t, FOOT, NONE).ok).toBe(true);
  });

  it('sem ponto acessível no raio, devolve null', () => {
    const t = createTerrain(C00);
    expect(snapToAccessible({ u: POND.u, v: POND.v }, t, FOOT, NONE, 6)).toBeNull();
  });
});
