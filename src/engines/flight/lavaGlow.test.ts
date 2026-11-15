import { CATALOG } from '@/data/catalog';
import { R05, R09 } from '@/data/contracts/rifts';
import { buildFlightPlan } from '@/domain/flightPlanner';
import { neutralModifiers } from '@/domain/modifiers';
import { referenceParams } from '@/domain/referencePlan';
import type { Contract, MissionData } from '@/types';
import { createTerrain } from '@/world/terrain/createTerrain';
import { FlightEngine } from './FlightEngine';
import { renderTerrain, type TerrainScene } from './terrainRenderer';

// A cena que o `FlightEngine` manda ao render é capturada sem trocar o desenho de verdade.
vi.mock('./terrainRenderer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./terrainRenderer')>();
  return { ...actual, renderTerrain: vi.fn(actual.renderTerrain) };
});

function sceneOf(contract: Contract): TerrainScene {
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
    events: { collisions: 0, crashes: 0, detected: false, featuresCaptured: [], ringsCollected: 0 },
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
  for (let t = 0; t < 6; t += 1 / 60) e.update(1 / 60);
  const spy = vi.mocked(renderTerrain);
  spy.mockClear();
  e.render();
  return spy.mock.calls.at(-1)?.[1] as TerrainScene;
}

describe('FlightEngine: brilho da lava (LAVA_THERMALS)', () => {
  it('a R05 manda o brilho ao render do terreno; a R09 (sem a regra), não', () => {
    expect(sceneOf(R05).lavaGlow).toBe(true);
    expect(sceneOf(R09).lavaGlow).toBe(false);
  });

  it('o terreno da R05 tem lava no campo de visão do começo do voo (a bacia fica a oeste)', () => {
    const scene = sceneOf(R05);
    let lava = 0;
    for (let Z = 0; Z <= 600; Z += 10) {
      for (let X = -150; X <= 150; X += 10) if (scene.cover(X, Z) === 'LAVA') lava++;
    }
    expect(lava).toBeGreaterThan(0);
  });
});
