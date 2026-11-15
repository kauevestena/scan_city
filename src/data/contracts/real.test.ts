/** Fichas dos contratos do Mundo Real conferidas contra a spec (contracts-real). */
import { CATALOG, getAircraft, getSensor } from '@/data/catalog';
import { buildFlightPlan } from '@/domain/flightPlanner';
import { referenceParams } from '@/domain/referencePlan';
import { RULE_PARAMS } from '@/domain/specialRules';
import { meanAoiElevation } from '@/engines/flight/FlightEngine';
import { createTerrain } from '@/world/terrain/createTerrain';
import { C01, C05, C06, museumSlotCoords } from '.';

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
