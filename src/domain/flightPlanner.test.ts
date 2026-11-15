import { CATALOG } from '@/data/catalog';
import { mulberry32 } from '@/lib/rng';
import { initialInventory } from '@/state/slices/inventorySlice';
import type { Contract, FlightPlan, PlanParams, SaveGame } from '@/types';
import {
  buildFlightPlan,
  defaultPlanParams,
  validatePlan,
  type PlannerContract,
} from './flightPlanner';
import { lidarDensityWithOverlap, lidarSwathM } from './lidar';

const close = (a: number, e: number, rel = 1e-3) =>
  expect(Math.abs(a - e) / Math.abs(e)).toBeLessThanOrEqual(rel);

const C00: PlannerContract = {
  aoi: { widthM: 160, lengthM: 240 },
  ceilingM: 80,
  wind: { meanMs: 2, gustMs: 1, directionDeg: 90 },
  lightingOptions: ['SUN_HIGH', 'OVERCAST'],
  recommended: { aircraft: ['ATLAS'], sensors: ['CAM_PIGEON'], vehicle: 'FOOT_BIKE', notes: '' },
  requirements: [],
};

const C00_PARAMS: PlanParams = {
  aircraftId: 'ATLAS',
  sensorId: 'CAM_PIGEON',
  primarySensor: 'RGB',
  heightM: 60,
  forwardOverlapPct: 70,
  sideOverlapPct: 60,
  speedMs: 10,
  orientation: 'ALONG_LENGTH',
  crossGrid: false,
  terrainFollowing: false,
  lighting: 'SUN_HIGH',
};

const T2_PARAMS: PlanParams = {
  ...C00_PARAMS,
  aircraftId: 'DRONE_T2',
  sensorId: 'CAM_45MP_FF',
  lensId: 'LENS_35',
  heightM: 100,
  forwardOverlapPct: 80,
  sideOverlapPct: 70,
};

function fullInventory(): SaveGame['inventory'] {
  return {
    ...initialInventory(),
    aircraft: ['ATLAS', 'DRONE_T1', 'DRONE_T2', 'VTOL_T3'],
    sensors: ['CAM_PIGEON', 'CAM_20MP_RS', 'CAM_45MP_FF', 'CAM_MS5', 'CAM_THERMAL', 'CAM_POD_RGB'],
    lenses: ['LENS_35', 'LENS_24'],
    payloads: ['POD_LIDAR'],
  };
}

describe('buildFlightPlan', () => {
  it('G23 — plano de referência do C00: 6 linhas, 96 fotos, 231,45 s', () => {
    const plan = buildFlightPlan(C00_PARAMS, C00, CATALOG);
    close(plan.stats.gsdM, 0.025204);
    close(plan.stats.footprintWM, 82.267);
    close(plan.stats.footprintHM, 60.667);
    close(plan.stats.baseM, 18.2);
    close(plan.stats.spacingM, 32.907);
    close(plan.stats.intervalS, 1.82);
    expect(plan.stats.nLines).toBe(6);
    expect(plan.stats.photosPerLine).toBe(16);
    expect(plan.stats.totalPhotos).toBe(96);
    close(plan.stats.flightTimeS, 231.45);
    expect(plan.stats.batteriesNeeded).toBe(1);
    expect(plan.stats.lineLengthM).toBe(300);
    expect(plan.lines).toHaveLength(6);
    expect(plan.stats.skewPx).toBe(0);
    close(plan.stats.blurPx, 10 / 2000 / 0.025204);
  });

  it('linhas centradas ao longo do comprimento, com lead-in/out e janela da AOI', () => {
    const plan = buildFlightPlan(C00_PARAMS, C00, CATALOG);
    const [first, second] = plan.lines;
    close(first?.start.v as number, (160 - 5 * 32.907) / 2);
    expect(first).toMatchObject({
      index: 0,
      pass: 'PRIMARY',
      direction: 1,
      start: { u: -30 },
      end: { u: 270 },
      aoiStartS: 30,
      aoiEndS: 270,
    });
    expect(second).toMatchObject({ direction: -1, start: { u: 270 }, end: { u: -30 } });
  });

  it('as linhas alternam a direção (zigue-zague), inclusive na malha cruzada', () => {
    const plan = buildFlightPlan({ ...C00_PARAMS, crossGrid: true }, C00, CATALOG);
    plan.lines.forEach((line, i) => {
      expect(line.index).toBe(i);
      expect(line.direction).toBe(i % 2 === 0 ? 1 : -1);
    });
  });

  it('a malha cruzada gera as linhas perpendiculares (total = soma dos conjuntos)', () => {
    const simple = buildFlightPlan(C00_PARAMS, C00, CATALOG);
    const cross = buildFlightPlan({ ...C00_PARAMS, crossGrid: true }, C00, CATALOG);
    const primary = cross.lines.filter((l) => l.pass === 'PRIMARY');
    const perpendicular = cross.lines.filter((l) => l.pass === 'CROSS');
    expect(primary).toHaveLength(6);
    // Ao longo da largura (160 m), os conjuntos trocam: ceil(240/32,907) + 1 = 9.
    expect(perpendicular).toHaveLength(9);
    expect(cross.stats.nLines).toBe(15);
    for (const line of perpendicular) {
      expect(line.start.u).toBe(line.end.u);
      expect(Math.abs(line.end.v - line.start.v)).toBe(160 + 60);
    }
    for (const line of primary) expect(line.start.v).toBe(line.end.v);
    expect(cross.stats.totalPhotos).toBe(96 + 9 * (Math.floor(160 / 18.2) + 3));
    expect(cross.stats.flightTimeS).toBeGreaterThan(simple.stats.flightTimeS);
  });

  it('orientação ao longo da largura troca os eixos', () => {
    const plan = buildFlightPlan({ ...C00_PARAMS, orientation: 'ALONG_WIDTH' }, C00, CATALOG);
    expect(plan.stats.nLines).toBe(9);
    expect(plan.stats.lineLengthM).toBe(220);
    expect(plan.lines[0]?.start.u).toBe(plan.lines[0]?.end.u);
  });

  it('LiDAR primário espaça as linhas pela faixa do LiDAR', () => {
    const params: PlanParams = {
      ...T2_PARAMS,
      sensorId: 'POD_LIDAR',
      lensId: undefined,
      primarySensor: 'LIDAR',
      heightM: 80,
      sideOverlapPct: 50,
    };
    const plan = buildFlightPlan(params, { ...C00, ceilingM: 120 }, CATALOG, { meanCanopy: 0.97 });
    const fov = (70 * Math.PI) / 180;
    close(plan.stats.lidarSwathM as number, lidarSwathM(80, fov));
    close(plan.stats.spacingM, lidarSwathM(80, fov) * 0.5);
    close(plan.stats.lidarDensity as number, lidarDensityWithOverlap(240_000, 10, 80, fov, 50));
    close(plan.stats.groundDensity as number, (plan.stats.lidarDensity as number) * 0.1076);
    // As fotos do pod usam a câmera RGB embutida.
    close(plan.stats.focalM, 0.0123);
  });

  it('Pod com RGB primário: espaçamento pela foto, densidade pela sobreposição efetiva', () => {
    const plan = buildFlightPlan(
      { ...T2_PARAMS, sensorId: 'POD_LIDAR', lensId: undefined, primarySensor: 'RGB' },
      C00,
      CATALOG,
    );
    close(plan.stats.lidarDensity as number, 240_000 / (10 * plan.stats.spacingM));
    expect(plan.stats.groundDensity).toBeCloseTo(plan.stats.lidarDensity as number, 9);
  });

  it('asa fixa: lead-in de 80 m e curva em gota; rolling shutter gera skew', () => {
    const vtol = buildFlightPlan(
      { ...T2_PARAMS, aircraftId: 'VTOL_T3', heightM: 150, speedMs: 20 },
      { ...C00, ceilingM: 300 },
      CATALOG,
    );
    expect(vtol.lines[0]?.start.u).toBe(-80);
    close(vtol.stats.turnTimeS, (Math.PI * 80 + Math.abs(vtol.stats.spacingM - 160)) / 20, 1e-9);

    const t1 = buildFlightPlan(
      { ...C00_PARAMS, aircraftId: 'DRONE_T1', sensorId: 'CAM_20MP_RS', speedMs: 8, heightM: 100 },
      C00,
      CATALOG,
    );
    close(t1.stats.skewPx, 8.7552);
  });

  it('o modificador de autonomia reduz as baterias necessárias', () => {
    const params = { ...C00_PARAMS, heightM: 20, speedMs: 4 };
    const plain = buildFlightPlan(params, C00, CATALOG);
    const boosted = buildFlightPlan(params, C00, CATALOG, { enduranceMod: 3 });
    expect(boosted.stats.batteriesNeeded).toBeLessThan(plain.stats.batteriesNeeded);
  });

  it('propriedade: aumentar q nunca reduz o número de linhas', () => {
    const rng = mulberry32(7);
    for (let trial = 0; trial < 40; trial++) {
      const aoi = { widthM: rng.range(50, 900), lengthM: rng.range(50, 900) };
      const heightM = rng.range(20, 120);
      const crossGrid = rng.next() < 0.3;
      let previous = 0;
      for (let q = 50; q <= 80; q++) {
        const plan = buildFlightPlan(
          { ...T2_PARAMS, heightM, sideOverlapPct: q, crossGrid },
          { ...C00, aoi },
          CATALOG,
        );
        expect(plan.stats.nLines).toBeGreaterThanOrEqual(previous);
        previous = plan.stats.nLines;
      }
    }
  });

  it('AOI menor que a pegada ainda gera 2 linhas', () => {
    const plan = buildFlightPlan(C00_PARAMS, { ...C00, aoi: { widthM: 10, lengthM: 10 } }, CATALOG);
    expect(plan.stats.nLines).toBe(2);
  });
});

describe('validatePlan', () => {
  const plan = (params: Partial<PlanParams> = {}, contract: PlannerContract = C00): FlightPlan =>
    buildFlightPlan({ ...C00_PARAMS, ...params }, contract, CATALOG);
  const inv = initialInventory();

  it('o plano de referência do C00 não tem bloqueios nem avisos', () => {
    expect(validatePlan(plan(), inv, C00, CATALOG)).toEqual({ blocking: [], warnings: [] });
  });

  it('1. sem aeronave (não possuída)', () => {
    const v = validatePlan(
      buildFlightPlan(T2_PARAMS, { ...C00, ceilingM: 120 }, CATALOG),
      inv,
      {
        ...C00,
        ceilingM: 120,
      },
      CATALOG,
    );
    expect(v.blocking).toContain('Nenhuma aeronave selecionada');
  });

  it('2. sensor incompatível com a aeronave ou não possuído', () => {
    const wrong = { ...plan(), params: { ...plan().params, sensorId: 'CAM_20MP_RS' } };
    expect(validatePlan(wrong, fullInventory(), C00, CATALOG).blocking).toEqual([
      'O sensor CAM_20MP_RS não serve na aeronave ATLAS',
    ]);
    const notOwned = buildFlightPlan(
      { ...T2_PARAMS, sensorId: 'POD_LIDAR', lensId: undefined },
      { ...C00, ceilingM: 120 },
      CATALOG,
    );
    const inventory = { ...fullInventory(), payloads: [] };
    expect(validatePlan(notOwned, inventory, { ...C00, ceilingM: 120 }, CATALOG).blocking).toEqual([
      'O sensor POD_LIDAR não serve na aeronave DRONE_T2',
    ]);
  });

  it('3. H fora dos limites (o teto do contrato prevalece)', () => {
    expect(validatePlan(plan({ heightM: 15 }), inv, C00, CATALOG).blocking).toEqual([
      'Altura fora dos limites (20–80 m)',
    ]);
    const lowCeiling = { ...C00, ceilingM: 50 };
    expect(
      validatePlan(plan({ heightM: 60 }, lowCeiling), inv, lowCeiling, CATALOG).blocking,
    ).toEqual(['Altura fora dos limites (20–50 m)']);
  });

  it('4. nenhuma linha', () => {
    const empty: FlightPlan = { ...plan(), lines: [], stats: { ...plan().stats, nLines: 0 } };
    expect(validatePlan(empty, inv, C00, CATALOG).blocking).toEqual([
      'O plano não tem nenhuma linha de voo',
    ]);
  });

  it('5. Atlas sem milho no papo e no estoque', () => {
    const hungry = { ...inv, corn: { stock: 0, crop: 0 } };
    expect(validatePlan(plan(), hungry, C00, CATALOG).blocking).toEqual([
      'O Atlas está sem milho (papo e estoque vazios)',
    ]);
    expect(
      validatePlan(plan(), { ...inv, corn: { stock: 3, crop: 0 } }, C00, CATALOG).blocking,
    ).toEqual([]);
  });

  it('avisos: várias surtidas, energia insuficiente e vento acima da tolerância', () => {
    const long = plan({ heightM: 20, speedMs: 4 });
    expect(long.stats.batteriesNeeded).toBeGreaterThan(1);
    const n = long.stats.batteriesNeeded;
    const v = validatePlan(long, { ...inv, corn: { stock: 0, crop: 10 } }, C00, CATALOG);
    expect(v.blocking).toEqual([]);
    expect(v.warnings).toContain(`O voo precisará de ${n} surtidas`);
    expect(v.warnings).toContain(`Energia para 1 de ${n} surtidas: leve mais baterias ou milho`);

    const windy: PlannerContract = { ...C00, wind: { meanMs: 7, gustMs: 3, directionDeg: 90 } };
    const w = validatePlan(plan({}, windy), inv, windy, CATALOG);
    expect(w.warnings).toHaveLength(1);
    expect(w.warnings[0]?.replace(/\s/g, ' ')).toBe(
      'Vento de até 10,0 m/s acima da tolerância da aeronave (8,0 m/s)',
    );
  });

  it('baterias: 1 + reservas da aeronave', () => {
    const t1Plan = buildFlightPlan(
      { ...C00_PARAMS, aircraftId: 'DRONE_T1', sensorId: 'CAM_20MP_RS', heightM: 20, speedMs: 2 },
      C00,
      CATALOG,
    );
    const v = validatePlan(t1Plan, fullInventory(), C00, CATALOG);
    const n = t1Plan.stats.batteriesNeeded;
    expect(n).toBeGreaterThan(3);
    expect(v.warnings).toContain(`Energia para 3 de ${n} surtidas: leve mais baterias ou milho`);
  });
});

describe('defaultPlanParams', () => {
  it('C00 com o inventário inicial: Atlas, câmera do avô, H = 80, p 75, q 65, v de cruzeiro', () => {
    expect(defaultPlanParams(C00, initialInventory(), CATALOG)).toEqual({
      aircraftId: 'ATLAS',
      sensorId: 'CAM_PIGEON',
      primarySensor: 'RGB',
      heightM: 80,
      forwardOverlapPct: 75,
      sideOverlapPct: 65,
      speedMs: 10,
      orientation: 'ALONG_LENGTH',
      crossGrid: false,
      terrainFollowing: false,
      lighting: 'SUN_HIGH',
    });
  });

  it('prefere a aeronave recomendada possuída; H limitado pelo teto', () => {
    const contract: PlannerContract = {
      ...C00,
      ceilingM: 60,
      recommended: { ...C00.recommended, aircraft: ['DRONE_T2'], sensors: ['CAM_45MP_FF'] },
    };
    const params = defaultPlanParams(contract, fullInventory(), CATALOG);
    expect(params).toMatchObject({
      aircraftId: 'DRONE_T2',
      sensorId: 'CAM_45MP_FF',
      lensId: 'LENS_35',
      heightM: 60,
      speedMs: 10,
    });
  });

  it('sem recomendada possuída, usa a de maior tier compatível com os requisitos críticos', () => {
    const lidar: PlannerContract = {
      ...C00,
      ceilingM: 150,
      recommended: { ...C00.recommended, aircraft: [], sensors: ['POD_LIDAR'] },
      requirements: [
        {
          id: 'k',
          label: 'LiDAR',
          severity: 'CRITICAL',
          check: { type: 'SENSOR_KIND', value: 'LIDAR' },
        },
        {
          id: 'm',
          label: 'Multirrotor',
          severity: 'CRITICAL',
          check: { type: 'AIRCRAFT_KIND', value: 'MULTIROTOR' },
        },
      ],
    };
    expect(defaultPlanParams(lidar, fullInventory(), CATALOG)).toMatchObject({
      aircraftId: 'DRONE_T2',
      sensorId: 'POD_LIDAR',
      primarySensor: 'LIDAR',
      heightM: 80,
    });
    const tier: PlannerContract = {
      ...C00,
      recommended: { ...C00.recommended, aircraft: [] },
      requirements: [
        {
          id: 't',
          label: 'Tier',
          severity: 'CRITICAL',
          check: { type: 'MIN_AIRCRAFT_TIER', value: 3 },
        },
      ],
    };
    expect(defaultPlanParams(tier, fullInventory(), CATALOG).aircraftId).toBe('VTOL_T3');
    // Ninguém atende: fica com a melhor possuída.
    expect(defaultPlanParams(tier, initialInventory(), CATALOG).aircraftId).toBe('ATLAS');
  });

  it('o resultado sempre gera um plano válido', () => {
    const contract: Pick<Contract, 'aoi'> & PlannerContract = { ...C00, ceilingM: 120 };
    for (const inventory of [initialInventory(), fullInventory()]) {
      const params = defaultPlanParams(contract, inventory, CATALOG);
      const plan = buildFlightPlan(params, contract, CATALOG);
      expect(validatePlan(plan, inventory, contract, CATALOG).blocking).toEqual([]);
    }
  });
});
