import { CATALOG } from '@/data/catalog';
import { R06 } from '@/data/contracts/rifts';
import { buildFlightPlan } from '@/domain/flightPlanner';
import { neutralModifiers } from '@/domain/modifiers';
import { referenceParams } from '@/domain/referencePlan';
import type { FeatureTarget, LandCover, MissionData, Rgb } from '@/types';
import { createTerrain } from '@/world/terrain/createTerrain';
import { FlightEngine } from './FlightEngine';
import { makeCamera } from './projection';
import {
  COVER_HEAT,
  HOT_SPOT_HEAT,
  hotSpotHeat,
  objectHeat,
  thermalColor,
  thermalFeatures,
} from './thermal';
import { buildDrawList, renderTerrain, sunInRunFrame, type TerrainScene } from './terrainRenderer';

// A cena que o `FlightEngine` manda ao render é capturada sem trocar o desenho de verdade.
vi.mock('./terrainRenderer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./terrainRenderer')>();
  return { ...actual, renderTerrain: vi.fn(actual.renderTerrain) };
});

const luma = (c: Rgb) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const den = (over: Partial<FeatureTarget> = {}): FeatureTarget => ({
  id: 'DEN_X',
  name: 'Toca',
  u: 100,
  v: 100,
  radiusM: 8,
  needs: 'PHOTO',
  sensorKind: 'THERMAL',
  ...over,
});

describe('rampa térmica', () => {
  it('sobe com o calor: do preto-azulado ao branco-amarelado, sem nunca escurecer', () => {
    const lumas = Array.from({ length: 21 }, (_, i) => luma(thermalColor(i / 20)));
    for (let i = 1; i < lumas.length; i++) {
      expect(lumas[i] as number, `calor ${i / 20}`).toBeGreaterThan(lumas[i - 1] as number);
    }
    expect(thermalColor(0)).toEqual([8, 4, 28]);
    expect(thermalColor(1)).toEqual([255, 248, 204]);
    // Fora de 0–1 vale o extremo.
    expect(thermalColor(-3)).toEqual(thermalColor(0));
    expect(thermalColor(7)).toEqual(thermalColor(1));
    // O meio é avermelhado e o alto é laranja.
    const mid = thermalColor(0.5);
    expect(mid[0]).toBeGreaterThan(mid[1] * 3);
    const warm = thermalColor(0.75);
    expect(warm[0]).toBeGreaterThan(warm[1]);
    expect(warm[1]).toBeGreaterThan(warm[2]);
  });

  it('a água é o mais frio, o brejo e o capim são frios e a pedra e o telhado, mornos', () => {
    const order: LandCover[] = ['WATER', 'SWAMP', 'GRASS', 'ROCK', 'ROAD', 'ROOF'];
    for (let i = 1; i < order.length; i++) {
      expect(COVER_HEAT[order[i] as LandCover]).toBeGreaterThan(
        COVER_HEAT[order[i - 1] as LandCover],
      );
    }
    expect(COVER_HEAT.LAVA).toBe(1);
    // Toda cobertura é um calor válido.
    for (const heat of Object.values(COVER_HEAT)) {
      expect(heat).toBeGreaterThanOrEqual(0);
      expect(heat).toBeLessThanOrEqual(1);
    }
    // A árvore morta é fria e o prédio, morno; o que não está na tabela tem um calor padrão.
    expect(objectHeat('TREE')).toBeLessThan(objectHeat('BUILDING'));
    expect(objectHeat('MOVING_HAZARD')).toBeGreaterThan(0);
  });
});

describe('manchas quentes', () => {
  it('só os alvos térmicos entram na lista de manchas', () => {
    const facade: FeatureTarget = {
      id: 'TEMPLE_FACADE',
      name: 'Fachada',
      u: 1,
      v: 1,
      radiusM: 5,
      needs: 'PHOTO',
    };
    expect(thermalFeatures([den(), facade])).toEqual([den()]);
  });

  it('o calor extra é máximo no centro, cai a ~22 % a um raio e some a 2,5 raios', () => {
    const spots = [den()];
    expect(hotSpotHeat(spots, 100, 100)).toBeCloseTo(HOT_SPOT_HEAT, 9);
    expect(hotSpotHeat(spots, 108, 100)).toBeCloseTo(HOT_SPOT_HEAT * Math.exp(-1.5), 9);
    expect(hotSpotHeat(spots, 100, 92)).toBeCloseTo(HOT_SPOT_HEAT * Math.exp(-1.5), 9);
    expect(hotSpotHeat(spots, 100 + 2.5 * 8 + 0.1, 100)).toBe(0);
    expect(hotSpotHeat([], 100, 100)).toBe(0);
    // Duas manchas que se sobrepõem valem pela mais quente, sem somar.
    const two = [den(), den({ u: 104 })];
    expect(hotSpotHeat(two, 102, 100)).toBeLessThanOrEqual(HOT_SPOT_HEAT);
    // O centro da toca sobre o brejo é bem mais quente que o brejo: aparece na rampa.
    const swamp = luma(thermalColor(COVER_HEAT.SWAMP));
    const hot = luma(thermalColor(COVER_HEAT.SWAMP + HOT_SPOT_HEAT));
    expect(hot).toBeGreaterThan(swamp * 2);
  });
});

describe('render termal do terreno', () => {
  const scene = (over: Partial<TerrainScene> = {}): TerrainScene => ({
    cam: makeCamera(1280, 720, 0, 40),
    quality: 'LOW',
    elevation: () => 0,
    cover: () => 'SWAMP',
    palette: createTerrain(R06).palette,
    lighting: 'OVERCAST',
    sun: sunInRunFrame('OVERCAST', { u: 1, v: 0 }, { u: 0, v: 1 }),
    reliefM: 8,
    timeS: 0,
    objects: [],
    marks: [],
    ...over,
  });
  const quadColors = (s: TerrainScene) =>
    buildDrawList(s)
      .filter((c) => c.type === 'QUAD')
      .map((c) => (c.type === 'QUAD' ? c.color : ''));

  it('com a câmera termal o terreno troca as cores do bioma pela rampa de calor', () => {
    const rgb = quadColors(scene());
    const thermal = quadColors(scene({ thermal: { heatAt: () => 0 } }));
    expect(thermal).toHaveLength(rgb.length);
    expect(new Set(thermal)).not.toEqual(new Set(rgb));
    // O chão de brejo uniforme vira poucas cores (a rampa de um calor só, com a névoa).
    expect(new Set(thermal).size).toBeLessThan(rgb.length / 2);
  });

  it('a mancha quente brilha só no render termal: no RGB o mesmo terreno é uniforme', () => {
    // Uma mancha quente numa faixa lateral do campo, a 120 m à frente.
    const heatAt = (X: number, Z: number) =>
      Math.abs(X) < 10 && Math.abs(Z - 120) < 25 ? 0.55 : 0;
    const parse = (c: string) => c.match(/\d+/g)?.map(Number) as [number, number, number];
    const lumas = (s: TerrainScene) =>
      buildDrawList(s)
        .filter((c) => c.type === 'QUAD' && c.z > 95 && c.z < 145)
        .map((c) => (c.type === 'QUAD' ? luma(parse(c.color)) : 0));
    const hot = lumas(scene({ thermal: { heatAt } }));
    const cold = lumas(scene({ thermal: { heatAt: () => 0 } }));
    expect(Math.max(...hot)).toBeGreaterThan(Math.max(...cold) * 1.5);
    // No RGB (sem `thermal`) a toca não deixa rastro nenhum na cena.
    const rgbA = quadColors(scene());
    const rgbB = quadColors(scene());
    expect(rgbA).toEqual(rgbB);
  });

  it('renderTerrain desenha a cena termal sem erro', () => {
    const ctx = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;
    renderTerrain(ctx, scene({ thermal: { heatAt: () => 0.2 } }));
    expect(ctx.fill).toHaveBeenCalled();
  });
});

describe('FlightEngine com a câmera termal', () => {
  function run(thermal: boolean) {
    const contract = thermal
      ? R06
      : {
          ...R06,
          referencePlan: {
            ...R06.referencePlan,
            sensorId: 'CAM_45MP_FF',
            lensId: 'LENS_24' as const,
          },
        };
    const mission: MissionData = {
      id: `${contract.id}-1`,
      contractId: contract.id,
      createdAt: 0,
      rivalAdjustment: 1,
      isReplay: false,
      plan: buildFlightPlan(referenceParams(contract), contract, CATALOG),
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
      terrain: createTerrain(contract),
      catalog: CATALOG,
      input: { axis: () => 0 },
      mods: neutralModifiers(),
      ownsRtkKit: true,
      autopilot: true,
      quality: () => 'LOW',
      reduceFlashes: () => false,
      colors: { primary: '#64748b', secondary: '#0f172a' },
      sortie: 0,
      shotOffset: 0,
      now: () => (now += 200),
    });
    const ctx = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;
    e.attach({ ctx, width: 1280, height: 720, dpr: 1 });
    for (let t = 0; t < 14; t += 1 / 60) e.update(1 / 60);
    const spy = vi.mocked(renderTerrain);
    spy.mockClear();
    e.render();
    return spy.mock.calls.at(-1)?.[1] as TerrainScene;
  }

  it('o termal manda o render de calor ao terreno e pinta as árvores mortas na rampa; o RGB, não', () => {
    const thermal = run(true);
    expect(thermal.thermal).toBeDefined();
    expect(Number.isFinite(thermal.thermal?.heatAt(0, 100))).toBe(true);
    expect(thermal.thermal?.heatAt(0, 100)).toBeGreaterThanOrEqual(0);
    const trees = thermal.objects.filter((o) => o.kind === 'TREE');
    expect(trees.length).toBeGreaterThan(0);
    for (const t of trees) expect(t.color).toEqual(thermalColor(objectHeat('TREE')));
    // Com a câmera RGB (o mesmo bioma, o mesmo voo), a cena é a do bioma.
    const rgb = run(false);
    expect(rgb.thermal).toBeUndefined();
    for (const t of rgb.objects.filter((o) => o.kind === 'TREE')) {
      expect(t.color).not.toEqual(thermalColor(objectHeat('TREE')));
    }
  });
});
