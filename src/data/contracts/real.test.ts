/** Fichas dos contratos do Mundo Real conferidas contra a spec (contracts-real). */
import { CATALOG, getAircraft, getSensor } from '@/data/catalog';
import { buildFlightPlan } from '@/domain/flightPlanner';
import { referenceParams } from '@/domain/referencePlan';
import { estimateFromPlan } from '@/domain/requirements';
import { meanCanopy } from '@/engines/field/satellite';
import { RULE_PARAMS } from '@/domain/specialRules';
import { meanAoiElevation } from '@/engines/flight/FlightEngine';
import { createTerrain } from '@/world/terrain/createTerrain';
import { MARKER_ACCESS } from '@/data/overworld/map';
import { isReachable } from '@/world/overworld/pathfinding';
import { WORLD_MAP } from '@/world/overworld/tiles';
import type { VehicleId } from '@/types';
import { HARDWARE } from '@/data/catalog';
import { computePayment, computeRewards } from '@/domain/economy';
import { createCoverageGrid } from '@/domain/coverage';
import { evaluateMission, lidarStats, type MissionContext } from '@/domain/mission';
import { neutralModifiers } from '@/domain/modifiers';
import { syntheticMission } from '@/domain/referencePlan';
import { generateProduct } from '@/engines/raster/products';
import { mulberry32 } from '@/lib/rng';
import { C01, C02, C03, C04, C05, C06, museumSlotCoords } from '.';

describe('C01 — Metrópole Vertical', () => {
  it('conforme a ficha: AOI, teto, vento, regra, requisitos, recompensa e museu', () => {
    expect(C01.title).toBe('Metrópole Vertical');
    expect(C01.client.name).toBe('Prefeito Dr. Aurélio Bastos');
    expect(C01.client.portrait).toMatchObject({
      shape: 'SHIELD',
      icon: 'Landmark',
      initials: 'AB',
    });
    expect([C01.biome, C01.seed]).toEqual(['URBAN_VERTICAL', 2002]);
    expect(C01.aoi).toEqual({ widthM: 240, lengthM: 360 });
    expect([C01.ceilingM, C01.terrainReliefM]).toEqual([120, 10]);
    expect(C01.lightingOptions).toEqual(['SUN_HIGH', 'OVERCAST', 'GOLDEN_HOUR']);
    expect(C01.wind).toEqual({ meanMs: 4, gustMs: 3, directionDeg: 90 });
    expect(C01.specialRules).toEqual(['URBAN_CANYON_RTK_LOSS']);
    expect(
      C01.requirements.map((r) => [
        r.severity,
        r.check.type,
        'value' in r.check ? r.check.value : '',
      ]),
    ).toEqual([
      ['CRITICAL', 'MIN_SIDE_OVERLAP', 80],
      ['CRITICAL', 'MIN_COVERAGE_GREEN', 0.8],
      ['CRITICAL', 'ACCURACY_PEC', ''],
      ['MAJOR', 'MIN_FORWARD_OVERLAP', 80],
      ['MAJOR', 'MAX_GSD_CM', 3.5],
      ['MAJOR', 'MIN_GCP', 5],
      ['MINOR', 'MIN_CP', 2],
    ]);
    expect(C01.requirements[2]?.check).toEqual({
      type: 'ACCURACY_PEC',
      cls: 'A',
      scaleDenominator: 1000,
    });
    expect(C01.recommended).toMatchObject({
      aircraft: ['DRONE_T1'],
      sensors: ['CAM_20MP_RS'],
      vehicle: 'COMPACT_CAR',
    });
    expect(C01.minVehicle).toBe('FOOT_BIKE');
    expect([C01.basePaymentBRL, C01.xp, C01.reputationReward]).toEqual([1_200_000, 400, 8]);
    expect(C01.souvenirId).toBe('SV_CITY_KEY');
    expect(museumSlotCoords(C01.museum.slot)).toEqual({ col: 1, lin: 0 });
    expect(C01.museum.incomePerMinBRL).toBe(4_000);
    expect(C01.unlock).toEqual({ type: 'CONTRACT_DONE', contractId: 'C00' });
    expect(C01.overworldMarker).toBe('1');
    expect(C01.dialogs.briefing).toHaveLength(3);
    expect(C01.dialogs.success).toHaveLength(2);
    expect(C01.dialogs.failure).toHaveLength(2);
  });

  it('o plano de referência usa o T1 com a câmera de 20 MP, dentro do teto e das regras do drone', () => {
    const ref = C01.referencePlan;
    expect([ref.aircraftId, ref.sensorId]).toEqual(['DRONE_T1', 'CAM_20MP_RS']);
    expect(getAircraft(ref.aircraftId).compatibleSensors).toContain(getSensor(ref.sensorId).id);
    expect(ref.heightM).toBeLessThanOrEqual(C01.ceilingM);
    expect(ref.heightM).toBeLessThanOrEqual(getAircraft(ref.aircraftId).hMaxM);
    expect(ref.expected).toEqual({ gsdCm: 3.02, nLines: 10, flightTimeS: 493.7 });
  });

  it('o briefing avisa a altura máxima, e ela é a do prédio mais alto da AOI gerada', () => {
    const terrain = createTerrain(C01);
    const tallest = Math.max(
      ...terrain.objects
        .filter(
          (o) =>
            o.kind === 'BUILDING' &&
            o.u >= 0 &&
            o.u <= C01.aoi.lengthM &&
            o.v >= 0 &&
            o.v <= C01.aoi.widthM,
        )
        .map((o) => o.heightM),
    );
    expect(tallest).toBe(90);
    expect(C01.recommended.notes).toContain(`${tallest} m`);
    expect(C01.recommended.notes).toMatch(/acima dos prédios mais altos/);
  });

  it('o plano de referência passa acima do prédio mais alto, com folga, e abaixo do teto', () => {
    const terrain = createTerrain(C01);
    const planAltM = meanAoiElevation(terrain) + C01.referencePlan.heightM;
    // O topo mais alto da cena (cota do chão + altura do prédio) e a folga do plano sobre ele.
    let top = 0;
    for (const o of terrain.objects) top = Math.max(top, terrain.elevation(o.u, o.v) + o.heightM);
    expect(planAltM - top).toBeGreaterThanOrEqual(10);
    expect(C01.referencePlan.heightM).toBeLessThanOrEqual(C01.ceilingM);
  });
});

describe('C05 — Centro Histórico Colonial', () => {
  it('conforme a ficha: AOI, teto, vento, regra, requisitos, recompensa e museu', () => {
    expect(C05.title).toBe('Centro Histórico Colonial');
    expect(C05.client.name).toBe('Arq.ª Helena Vasconcelos');
    expect(C05.client.portrait).toMatchObject({ shape: 'DIAMOND', icon: 'Church', initials: 'HV' });
    expect([C05.biome, C05.seed]).toEqual(['COLONIAL_CENTER', 5005]);
    expect(C05.aoi).toEqual({ widthM: 150, lengthM: 150 });
    expect([C05.ceilingM, C05.terrainReliefM]).toEqual([120, 25]);
    expect(C05.lightingOptions).toEqual(['OVERCAST', 'SUN_HIGH', 'GOLDEN_HOUR']);
    expect(C05.wind).toEqual({ meanMs: 3, gustMs: 2, directionDeg: 45 });
    expect(C05.specialRules).toEqual(['LOW_WIRES']);
    expect(C05.requirements.map((r) => [r.severity, r.check])).toEqual([
      ['CRITICAL', { type: 'FLIGHT_MODE', value: 'OBLIQUE' }],
      ['CRITICAL', { type: 'MIN_COVERAGE_GREEN', value: 0.85 }],
      [
        'CRITICAL',
        { type: 'ACCURACY_PEC', cls: 'A', scaleDenominator: 500, contourIntervalM: 0.5 },
      ],
      ['MAJOR', { type: 'FLIGHT_MODE', value: 'CROSS_GRID' }],
      ['MAJOR', { type: 'MAX_GSD_CM', value: 1.5 }],
      ['MAJOR', { type: 'MIN_GCP', value: 5 }],
      ['MINOR', { type: 'MIN_CP', value: 3 }],
    ]);
    expect(C05.recommended).toMatchObject({
      aircraft: ['DRONE_T1', 'DRONE_T2'],
      vehicle: 'COMPACT_CAR',
    });
    expect(C05.minVehicle).toBe('FOOT_BIKE');
    expect([C05.basePaymentBRL, C05.xp, C05.reputationReward]).toEqual([1_800_000, 600, 10]);
    expect(C05.souvenirId).toBe('SV_TILE');
    expect(museumSlotCoords(C05.museum.slot)).toEqual({ col: 1, lin: 1 });
    expect(C05.museum.incomePerMinBRL).toBe(6_000);
    expect(C05.unlock).toEqual({ type: 'CONTRACT_DONE', contractId: 'C01' });
    expect(C05.overworldMarker).toBe('5');
    expect(
      [C05.dialogs.briefing, C05.dialogs.success, C05.dialogs.failure].map((d) => d.length),
    ).toEqual([3, 1, 1]);
  });

  it('o plano de referência voa oblíquo a 45° em malha cruzada e exige 2 surtidas com o T1', () => {
    const ref = C05.referencePlan;
    expect(ref).toMatchObject({
      aircraftId: 'DRONE_T1',
      sensorId: 'CAM_20MP_RS',
      heightM: 50,
      modes: ['OBLIQUE', 'CROSS_GRID'],
      obliqueDeg: 45,
      lighting: 'OVERCAST',
    });
    const plan = buildFlightPlan(referenceParams(C05), C05, CATALOG);
    expect(plan.params).toMatchObject({ obliqueDeg: 45, crossGrid: true });
    expect(plan.stats.nLines).toBe(14);
    // Uma bateria não dá: são 2 surtidas, e o T1 (1 bateria + 2 reservas) as completa.
    expect(plan.stats.batteriesNeeded).toBe(2);
    const t1 = getAircraft('DRONE_T1');
    expect(1 + t1.spareBatteries).toBeGreaterThanOrEqual(plan.stats.batteriesNeeded);
    expect(plan.stats.flightTimeS).toBeGreaterThan(t1.enduranceS * 0.8);
  });

  it('o briefing avisa da fiação a 8–14 m e do AGL mínimo, os números da regra', () => {
    const [lo, hi] = RULE_PARAMS.lowWires.wireHeightM;
    expect(C05.recommended.notes).toContain(`${lo}–${hi} m`);
    expect(C05.recommended.notes).toContain('AGL acima de 20 m');
    expect(C05.referencePlan.heightM).toBeGreaterThan(20);
  });
});

describe('C06 — Zona Costeira e Estuário', () => {
  it('conforme a ficha: AOI, vento cruzado, regras, requisitos, recompensa e museu', () => {
    expect(C06.title).toBe('Zona Costeira e Estuário');
    expect(C06.client.name).toBe('Comandante Iara Moreira');
    expect(C06.client.portrait).toMatchObject({ shape: 'CIRCLE', icon: 'Anchor', initials: 'IM' });
    expect([C06.biome, C06.seed]).toEqual(['COASTAL_ESTUARY', 6006]);
    expect(C06.aoi).toEqual({ widthM: 300, lengthM: 800 });
    expect([C06.ceilingM, C06.terrainReliefM]).toEqual([120, 20]);
    expect(C06.lightingOptions).toEqual(['SUN_HIGH', 'OVERCAST', 'GOLDEN_HOUR']);
    expect(C06.wind).toEqual({ meanMs: 9, gustMs: 4, directionDeg: 90 });
    expect(C06.specialRules).toEqual(['SPECULAR_WATER', 'STRONG_WIND']);
    expect(C06.requirements.map((r) => [r.severity, r.check])).toEqual([
      ['CRITICAL', { type: 'MIN_AIRCRAFT_TIER', value: 2 }],
      ['CRITICAL', { type: 'MIN_COVERAGE_GREEN', value: 0.8 }],
      ['CRITICAL', { type: 'ACCURACY_ASPRS', horizontalCm: 7, verticalCm: 10 }],
      ['MAJOR', { type: 'MAX_GSD_CM', value: 3 }],
      ['MAJOR', { type: 'MIN_GCP', value: 5 }],
      ['MINOR', { type: 'MIN_CP', value: 3 }],
    ]);
    expect(C06.recommended).toMatchObject({ aircraft: ['DRONE_T2'], sensors: ['CAM_45MP_FF'] });
    expect(C06.minVehicle).toBe('FOOT_BIKE');
    expect([C06.basePaymentBRL, C06.xp, C06.reputationReward]).toEqual([2_200_000, 700, 10]);
    expect(C06.souvenirId).toBe('SV_BOTTLE_MAP');
    expect(museumSlotCoords(C06.museum.slot)).toEqual({ col: 3, lin: 0 });
    expect(C06.museum.incomePerMinBRL).toBe(7_000);
    expect(C06.unlock).toEqual({
      type: 'ALL',
      of: [
        { type: 'CONTRACT_DONE', contractId: 'C01' },
        { type: 'REPUTATION', min: 40 },
      ],
    });
    expect(C06.overworldMarker).toBe('6');
    expect(
      [C06.dialogs.briefing, C06.dialogs.success, C06.dialogs.failure].map((d) => d.length),
    ).toEqual([3, 1, 1]);
  });

  it('o plano de referência voa com o T2, a câmera de 45 MP e a lente 24, sob luz nublada', () => {
    const ref = C06.referencePlan;
    expect(ref).toMatchObject({
      aircraftId: 'DRONE_T2',
      sensorId: 'CAM_45MP_FF',
      lensId: 'LENS_24',
      heightM: 110,
      speedMs: 12,
      lighting: 'OVERCAST',
    });
    expect(getAircraft(ref.aircraftId).tier).toBeGreaterThanOrEqual(2);
    expect(ref.expected).toEqual({ gsdCm: 2.01, nLines: 7, flightTimeS: 568.5 });
    // A luz nublada evita o reflexo (a regra `SPECULAR_WATER` só pesa sob `SUN_HIGH`).
    expect(ref.lighting).not.toBe('SUN_HIGH');
    // Os pontos de apoio ficam na faixa de terra garantida (v ≤ 170).
    for (const p of [...ref.gcps, ...ref.cps]) expect(p.v).toBeLessThanOrEqual(170);
  });

  it('o briefing avisa que a água não tem tie points e manda pôr os GCPs na areia', () => {
    expect(C06.recommended.notes).toContain('Água não tem tie points');
    expect(C06.recommended.notes).toContain('GCPs só na faixa de areia');
  });
});

describe('C02 — Planalto Agrícola', () => {
  it('conforme a ficha: AOI, teto especial de 200 m, vento, regra, requisitos, recompensa e museu', () => {
    expect(C02.title).toBe('Planalto Agrícola');
    expect(C02.client.name).toBe('Seu Valdemar Prado');
    expect(C02.client.portrait).toMatchObject({ shape: 'HEXAGON', icon: 'Wheat', initials: 'VP' });
    expect([C02.biome, C02.seed]).toEqual(['AGRI_PLATEAU', 2020]);
    expect(C02.aoi).toEqual({ widthM: 600, lengthM: 1500 });
    expect([C02.ceilingM, C02.terrainReliefM]).toEqual([200, 30]);
    expect(C02.lightingOptions).toEqual(['SUN_HIGH', 'OVERCAST', 'GOLDEN_HOUR']);
    expect(C02.wind).toEqual({ meanMs: 5, gustMs: 3, directionDeg: 0 });
    expect(C02.specialRules).toEqual(['HOMOGENEOUS_TEXTURE']);
    expect(C02.requirements.map((r) => [r.severity, r.check])).toEqual([
      ['CRITICAL', { type: 'SENSOR_KIND', value: 'MULTISPECTRAL' }],
      ['CRITICAL', { type: 'AIRCRAFT_KIND', value: 'FIXED_WING_VTOL' }],
      ['CRITICAL', { type: 'MIN_COVERAGE_GREEN', value: 0.75 }],
      ['MAJOR', { type: 'MAX_GSD_CM', value: 15 }],
      ['MAJOR', { type: 'MIN_FORWARD_OVERLAP', value: 80 }],
      ['MAJOR', { type: 'ACCURACY_PEC', cls: 'B', scaleDenominator: 5000 }],
      ['MINOR', { type: 'MIN_GCP', value: 5 }],
    ]);
    expect(C02.recommended).toMatchObject({
      aircraft: ['VTOL_T3'],
      sensors: ['CAM_MS5'],
      vehicle: 'PICKUP_4X4',
    });
    expect(C02.minVehicle).toBe('FOOT_BIKE');
    expect([C02.basePaymentBRL, C02.xp, C02.reputationReward]).toEqual([3_500_000, 900, 12]);
    expect(C02.souvenirId).toBe('SV_CORN_GOLD');
    expect(museumSlotCoords(C02.museum.slot)).toEqual({ col: 0, lin: 1 });
    expect(C02.museum.incomePerMinBRL).toBe(9_000);
    expect(C02.unlock).toEqual({
      type: 'ALL',
      of: [
        { type: 'CONTRACT_DONE', contractId: 'C06' },
        { type: 'REPUTATION', min: 50 },
      ],
    });
    expect(C02.overworldMarker).toBe('2');
    expect(
      [C02.dialogs.briefing, C02.dialogs.success, C02.dialogs.failure].map((d) => d.length),
    ).toEqual([3, 1, 1]);
  });

  it('o plano de referência voa a 200 m (acima do teto comum de 120 m) com a asa fixa e a multiespectral', () => {
    const ref = C02.referencePlan;
    expect(ref).toMatchObject({
      aircraftId: 'VTOL_T3',
      sensorId: 'CAM_MS5',
      heightM: 200,
      forwardOverlapPct: 80,
      speedMs: 22,
      lighting: 'SUN_HIGH',
    });
    expect(ref.heightM).toBeGreaterThan(120);
    expect(ref.heightM).toBeLessThanOrEqual(C02.ceilingM);
    expect(ref.heightM).toBeLessThanOrEqual(getAircraft(ref.aircraftId).hMaxM);
    expect(getAircraft(ref.aircraftId).kind).toBe('FIXED_WING_VTOL');
    expect(getSensor(ref.sensorId).kind).toBe('MULTISPECTRAL');
    expect(ref.expected).toEqual({ gsdCm: 12.54, nLines: 8, flightTimeS: 725.7 });
  });

  it('textura homogênea: p < 80 penaliza mais a acurácia que p ≥ 80', () => {
    const points = [...C02.referencePlan.gcps, ...C02.referencePlan.cps].map((p, i) => ({
      id: `P${i}`,
      kind: i < 5 ? ('GCP' as const) : ('CP' as const),
      u: p.u,
      v: p.v,
      elevM: 0,
      sigmaM: 0.01,
    }));
    const ctx = { catalog: CATALOG, ownsRtkKit: true, fieldEquipmentId: 'TOTAL_STATION' as const };
    const at = (forwardOverlapPct: number) => {
      const plan = buildFlightPlan({ ...referenceParams(C02), forwardOverlapPct }, C02, CATALOG);
      return estimateFromPlan(plan, C02, points, ctx);
    };
    const factor = (e: ReturnType<typeof at>) => e.multipliers.find((m) => m.key === 'texture')?.xy;
    const ok = at(80);
    const low = at(70);
    expect(factor(ok)).toBeCloseTo(1.24, 9);
    expect(factor(low)).toBeCloseTo(1.6, 9);
    expect(low.rmse.r).toBeGreaterThan(ok.rmse.r);
    // Sem a regra, o multiplicador some.
    const plan = buildFlightPlan(referenceParams(C02), C02, CATALOG);
    const plain = estimateFromPlan(plan, { ...C02, specialRules: [] }, points, ctx);
    expect(plain.multipliers.some((m) => m.key === 'texture')).toBe(false);
  });

  it('o briefing avisa do p ≥ 80 % e o requisito de sobreposição pede os mesmos 80 %', () => {
    expect(C02.recommended.notes).toContain('p ≥ 80 %');
    const req = C02.requirements.find((r) => r.check.type === 'MIN_FORWARD_OVERLAP');
    expect(req?.check).toEqual({ type: 'MIN_FORWARD_OVERLAP', value: 80 });
  });
});

describe('C04 — Mina a Céu Aberto', () => {
  it('conforme a ficha: AOI, relevo de 150 m, vento, regra, requisitos, recompensa e museu', () => {
    expect(C04.title).toBe('Mina a Céu Aberto');
    expect(C04.client.name).toBe('Eng.ª Rosa Lima');
    expect(C04.client.portrait).toMatchObject({ shape: 'SHIELD', icon: 'Pickaxe', initials: 'RL' });
    expect([C04.biome, C04.seed]).toEqual(['OPEN_PIT_MINE', 4004]);
    expect(C04.aoi).toEqual({ widthM: 320, lengthM: 480 });
    expect([C04.ceilingM, C04.terrainReliefM]).toEqual([120, 150]);
    expect(C04.lightingOptions).toEqual(['SUN_HIGH', 'OVERCAST', 'GOLDEN_HOUR']);
    expect(C04.wind).toEqual({ meanMs: 6, gustMs: 4, directionDeg: 270 });
    expect(C04.specialRules).toEqual(['STEEP_RELIEF']);
    expect(C04.requirements.map((r) => [r.severity, r.check])).toEqual([
      ['CRITICAL', { type: 'FLIGHT_MODE', value: 'TERRAIN_FOLLOWING' }],
      ['CRITICAL', { type: 'MAX_VOLUME_ERROR_PCT', value: 2 }],
      ['CRITICAL', { type: 'MIN_COVERAGE_GREEN', value: 0.85 }],
      ['MAJOR', { type: 'ACCURACY_ASPRS', horizontalCm: 5, verticalCm: 8 }],
      ['MAJOR', { type: 'MIN_GCP', value: 6 }],
      ['MINOR', { type: 'MIN_CP', value: 3 }],
    ]);
    expect(C04.recommended).toMatchObject({
      aircraft: ['DRONE_T2'],
      sensors: ['CAM_45MP_FF'],
      vehicle: 'PICKUP_4X4',
    });
    expect([C04.basePaymentBRL, C04.xp, C04.reputationReward]).toEqual([5_500_000, 1200, 12]);
    expect(C04.souvenirId).toBe('SV_ORE_NUGGET');
    expect(museumSlotCoords(C04.museum.slot)).toEqual({ col: 0, lin: 0 });
    expect(C04.museum.incomePerMinBRL).toBe(12_000);
    expect(C04.unlock).toEqual({
      type: 'ALL',
      of: [
        { type: 'CONTRACT_DONE', contractId: 'C05' },
        { type: 'REPUTATION', min: 55 },
      ],
    });
    expect(C04.overworldMarker).toBe('4');
    expect(
      [C04.dialogs.briefing, C04.dialogs.success, C04.dialogs.failure].map((d) => d.length),
    ).toEqual([3, 1, 1]);
  });

  it('o plano de referência voa com TF, a 80 m AGL, sob luz nublada e com 6 GCPs', () => {
    const ref = C04.referencePlan;
    expect(ref).toMatchObject({
      aircraftId: 'DRONE_T2',
      sensorId: 'CAM_45MP_FF',
      lensId: 'LENS_24',
      heightM: 80,
      modes: ['TERRAIN_FOLLOWING'],
      lighting: 'OVERCAST',
    });
    expect(getAircraft(ref.aircraftId).terrainFollowing).toBe(true);
    expect(ref.gcps).toHaveLength(6);
    expect(ref.cps).toHaveLength(3);
    expect(ref.expected).toEqual({ gsdCm: 1.46, nLines: 9, flightTimeS: 563.5 });
  });

  it('marcador 4 só de 4x4: a picape chega do escritório; a pé, de carro e de van não', () => {
    expect(C04.minVehicle).toBe('PICKUP_4X4');
    expect(MARKER_ACCESS[C04.overworldMarker]).toBe('PICKUP_4X4');
    const marker = WORLD_MAP.markers.find((m) => m.char === C04.overworldMarker) as {
      x: number;
      y: number;
    };
    const reach = (v: VehicleId) => isReachable(WORLD_MAP, WORLD_MAP.door, marker, v);
    expect(reach('PICKUP_4X4')).toBe(true);
    for (const v of ['FOOT_BIKE', 'COMPACT_CAR', 'LAB_VAN'] as const)
      expect(reach(v), v).toBe(false);
  });
});

describe('C03 — Floresta Amazônica', () => {
  const terrain = createTerrain(C03);
  const context = (): MissionContext => ({
    catalog: CATALOG,
    terrain,
    // O T3 vem com RTK, mas o kit GNSS é do combo do T2: aqui o jogador o tem.
    ownsRtkKit: true,
    modifiers: neutralModifiers(),
    staff: { INTERN: 0, JUNIOR_ENG: 0 },
    hardware: HARDWARE[0] as (typeof HARDWARE)[number],
    inField: false,
    firstApproval: true,
    rng: mulberry32(7),
    deps: { computePayment, computeRewards },
  });

  it('conforme a ficha: AOI, teto de 150 m, vento, regra, requisitos, recompensa e museu', () => {
    expect(C03.title).toBe('Floresta Amazônica');
    expect(C03.client.name).toBe('Dra. Jaci Tupinambá');
    expect(C03.client.portrait).toMatchObject({
      shape: 'CIRCLE',
      icon: 'TreePine',
      initials: 'JT',
    });
    expect([C03.biome, C03.seed]).toEqual(['AMAZON', 3003]);
    expect(C03.aoi).toEqual({ widthM: 500, lengthM: 1000 });
    expect([C03.ceilingM, C03.terrainReliefM]).toEqual([150, 40]);
    expect(C03.lightingOptions).toEqual(['OVERCAST', 'SUN_HIGH']);
    expect(C03.wind).toEqual({ meanMs: 3, gustMs: 2, directionDeg: 180 });
    expect(C03.specialRules).toEqual(['DENSE_CANOPY']);
    expect(C03.requirements.map((r) => [r.severity, r.check])).toEqual([
      ['CRITICAL', { type: 'SENSOR_KIND', value: 'LIDAR' }],
      ['CRITICAL', { type: 'MIN_GROUND_DENSITY', value: 8 }],
      ['MAJOR', { type: 'MIN_LIDAR_DENSITY', value: 100 }],
      ['MAJOR', { type: 'ACCURACY_ASPRS', horizontalCm: 10, verticalCm: 15 }],
      ['MAJOR', { type: 'MIN_GCP', value: 4 }],
      ['MINOR', { type: 'MIN_CP', value: 2 }],
    ]);
    expect(C03.recommended).toMatchObject({
      aircraft: ['VTOL_T3'],
      sensors: ['POD_LIDAR'],
      vehicle: 'PICKUP_4X4',
    });
    expect(C03.minVehicle).toBe('PICKUP_4X4');
    expect([C03.basePaymentBRL, C03.xp, C03.reputationReward]).toEqual([9_000_000, 1500, 15]);
    expect(C03.souvenirId).toBe('SV_BRAZIL_NUT');
    expect(museumSlotCoords(C03.museum.slot)).toEqual({ col: 2, lin: 0 });
    expect(C03.museum.incomePerMinBRL).toBe(15_000);
    expect(C03.unlock).toEqual({
      type: 'ALL',
      of: [
        { type: 'CONTRACT_DONE', contractId: 'C04' },
        { type: 'CONTRACT_DONE', contractId: 'C02' },
        { type: 'REPUTATION', min: 65 },
      ],
    });
    expect(C03.overworldMarker).toBe('3');
    expect(
      [C03.dialogs.briefing, C03.dialogs.success, C03.dialogs.failure].map((d) => d.length),
    ).toEqual([2, 1, 1]);
  });

  it('marcador 3 só de 4x4, como o 4: a picape o alcança do escritório e os outros veículos não', () => {
    expect(MARKER_ACCESS[C03.overworldMarker]).toBe('PICKUP_4X4');
    const marker = WORLD_MAP.markers.find((m) => m.char === C03.overworldMarker) as {
      x: number;
      y: number;
    };
    const reach = (v: VehicleId) => isReachable(WORLD_MAP, WORLD_MAP.door, marker, v);
    expect(reach('PICKUP_4X4')).toBe(true);
    for (const v of ['FOOT_BIKE', 'COMPACT_CAR', 'LAB_VAN'] as const)
      expect(reach(v), v).toBe(false);
  });

  it('o plano de referência voa o pod LiDAR no T3: faixa de 168,05 m, 7 linhas, 158,7 pts/m² e solo ≥ 8', () => {
    const ref = C03.referencePlan;
    expect(ref).toMatchObject({
      aircraftId: 'VTOL_T3',
      sensorId: 'POD_LIDAR',
      heightM: 120,
      forwardOverlapPct: 70,
      sideOverlapPct: 50,
      speedMs: 18,
      lighting: 'OVERCAST',
    });
    expect(ref.heightM).toBeLessThanOrEqual(C03.ceilingM);
    // Clareiras de GCP e CP: todos os pontos de apoio no centro de uma delas.
    const centers = terrain.guaranteedAccessible.map((p) => `${p.u},${p.v}`);
    for (const p of [...ref.gcps, ...ref.cps]) expect(centers).toContain(`${p.u},${p.v}`);
    expect(ref.gcps).toHaveLength(5);
    expect(ref.cps).toHaveLength(2);
    // Com o dossel de 0,97 da mata: ~17 pts/m² de solo; com a média real da AOI, mais.
    const plan = buildFlightPlan(referenceParams(C03), C03, CATALOG, { meanCanopy: 0.97 });
    expect(plan.params.primarySensor).toBe('LIDAR');
    expect(plan.stats.lidarSwathM).toBeCloseTo(168.05, 1);
    expect(plan.stats.nLines).toBe(7);
    expect(plan.stats.lidarDensity).toBeCloseTo(158.7, 1);
    expect(plan.stats.groundDensity).toBeGreaterThanOrEqual(8);
    expect(plan.stats.groundDensity).toBeCloseTo(17, 0);
    const real = buildFlightPlan(referenceParams(C03), C03, CATALOG, {
      meanCanopy: meanCanopy(terrain),
    });
    expect(real.stats.groundDensity).toBeGreaterThanOrEqual(8);
  });

  it('com o plano de referência (missão sintética), a densidade de solo medida é ≥ 8 e o relatório aprova', () => {
    const mission = syntheticMission(C03, terrain, CATALOG);
    expect(mission.lidar?.grid.pulses).toHaveLength(64 * 64);
    const stats = lidarStats(mission, []);
    expect(stats?.meanDensity).toBeCloseTo(158.7, 0);
    expect(stats?.meanGroundDensity).toBeGreaterThanOrEqual(8);
    const report = evaluateMission(mission, C03, context());
    expect(report.critical).toBe(false);
    expect(report.approved).toBe(true);
    expect(report.requirements.every((r) => r.pass)).toBe(true);
    expect(report.requirements.find((r) => r.id === 'C03-ground')?.pass).toBe(true);
    expect(report.requirements.find((r) => r.id === 'C03-sensor')?.pass).toBe(true);
    expect(report.asprs?.passH && report.asprs?.passV).toBe(true);
  });

  it('sem LiDAR (só fotos) a missão é reprovada por requisito crítico', () => {
    const photoPlan = buildFlightPlan(
      { ...referenceParams(C03), sensorId: 'CAM_MS5', primarySensor: 'RGB' },
      C03,
      CATALOG,
    );
    // A missão sintética é a do pod; tirando o laser e trocando o plano, sobram só as fotos.
    const { lidar, ...photosOnly } = syntheticMission(C03, terrain, CATALOG);
    expect(lidar).toBeDefined();
    const mission = { ...photosOnly, plan: photoPlan };
    expect('lidar' in mission).toBe(false);
    const report = evaluateMission(mission, C03, context());
    const sensor = report.requirements.find((r) => r.id === 'C03-sensor');
    expect(sensor?.pass).toBe(false);
    expect(sensor?.severity).toBe('CRITICAL');
    expect(report.critical).toBe(true);
    expect(report.approved).toBe(false);
  });

  it('o MDT sem LiDAR fica sem dados sob o dossel (hachura); com o laser, o solo aparece', () => {
    const grid = createCoverageGrid(C03.aoi);
    const base = {
      terrain,
      coverage: {
        cols: grid.cols,
        rows: grid.rows,
        counts: grid.counts.map(() => 6),
        excludedCells: [] as number[],
      },
      lighting: 'OVERCAST' as const,
      rmseZM: 0.1,
      seed: 3,
    };
    const hatchedShare = (r: { hatched: Uint8Array }) =>
      r.hatched.reduce((a, b) => a + b, 0) / r.hatched.length;
    // Só fotos: o solo da mata não é visto, e só as clareiras (e a água) têm MDT.
    expect(hatchedShare(generateProduct('DTM', base))).toBeGreaterThan(0.8);
    // Com o LiDAR do plano de referência: o laser chega ao solo em todas as células.
    const mission = syntheticMission(C03, terrain, CATALOG);
    const density = mission.lidar?.grid.ground.map(
      (g) => g / (mission.lidar?.grid.cellAreaM2 ?? 1),
    );
    expect(
      hatchedShare(generateProduct('DTM', { ...base, lidarGroundDensity: density })),
    ).toBeLessThan(0.02);
  });
});
