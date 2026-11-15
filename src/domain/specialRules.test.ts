import { CATALOG, getAircraft } from '@/data/catalog';
import { SPECIAL_RULES, getSpecialRule, type RuleSystem } from '@/data/specialRules';
import { drainPerSecond } from '@/domain/energy';
import { isAccessible } from '@/domain/accessibility';
import { accuracyMultipliers, type AccuracyContext } from '@/domain/accuracy';
import { isShotValid, type ShotRules } from '@/domain/coverage';
import { capturedFeatures } from '@/domain/features';
import { computePayment } from '@/domain/economy';
import { checkCollision, hitsObject, isBeamOn, motionOffset } from '@/engines/flight/collision';
import { rtkStatusAt } from '@/engines/flight/cameraSensor';
import {
  driftMultiplier,
  emActive,
  emDisturbance,
  windAboveTolerance,
} from '@/engines/flight/environment';
import {
  ElectricSchedule,
  RING_BONUS_CENTS,
  ringCollected,
  SEARCHLIGHT_DETECT_ATLAS_S,
  SEARCHLIGHT_DETECT_S,
  initialDetection,
  insideSearchlight,
  stepDetection,
} from '@/engines/flight/fieldElements';
import { thermalLiftMs } from '@/domain/flightPhysics';
import { mulberry32 } from '@/lib/rng';
import type { AoiPoint, Shot, SpecialRuleId, WorldObject } from '@/types';
import { buildTestArena } from '@/world/terrain/biomes/testArena';
import {
  lavaThermalZones,
  lowWireLine,
  rtkCanyonZones,
  trenchElevation,
} from '@/world/terrain/ruleGenerators';
import { objectIdFactory } from '@/world/terrain/objects';
import {
  EFFECT_GROUPS,
  RULE_PARAMS,
  RULE_REGISTRY,
  SYSTEM_GROUP,
  maxSlopeDeg,
  neutralRuleEffects,
  resolveRuleEffects,
  terrainReliefM,
  touchedGroups,
} from './specialRules';

const ALL: SpecialRuleId[] = [
  'URBAN_CANYON_RTK_LOSS',
  'HOMOGENEOUS_TEXTURE',
  'DENSE_CANOPY',
  'STEEP_RELIEF',
  'LOW_WIRES',
  'SPECULAR_WATER',
  'STRONG_WIND',
  'EM_INTERFERENCE',
  'BLIZZARD_DRAIN',
  'MAGIC_FOG',
  'SEARCHLIGHTS',
  'MOVING_HAZARDS',
  'ENERGY_BEAMS',
  'LAVA_THERMALS',
  'VERTICAL_CLIFFS',
  'FEATURE_TARGETS',
  'COLLECTIBLE_RINGS',
  'ELECTRIC_CREATURES',
  'NARROW_TRENCH',
  'PAINT_MARKERS',
];

describe('framework: metadados e registro (REQ-CNT-004)', () => {
  it('as 20 regras têm nome, descrição pt-BR, ícone e sistemas', () => {
    expect(SPECIAL_RULES).toHaveLength(20);
    expect(SPECIAL_RULES.map((r) => r.id).sort()).toEqual([...ALL].sort());
    for (const rule of SPECIAL_RULES) {
      expect(rule.name.length, rule.id).toBeGreaterThan(3);
      expect(rule.description.length, rule.id).toBeGreaterThan(30);
      expect(rule.icon, rule.id).toMatch(/^[A-Z][A-Za-z0-9]+$/);
      expect(rule.systems.length, rule.id).toBeGreaterThan(0);
      expect(getSpecialRule(rule.id)).toBe(rule);
    }
    expect(() => getSpecialRule('NADA' as SpecialRuleId)).toThrow(RangeError);
  });

  it('o "onde atua" de cada regra bate com a tabela da spec', () => {
    const spec: Record<SpecialRuleId, RuleSystem[]> = {
      URBAN_CANYON_RTK_LOSS: ['TERRAIN', 'FLIGHT', 'ACCURACY'],
      HOMOGENEOUS_TEXTURE: ['ACCURACY', 'PROCESSING'],
      DENSE_CANOPY: ['TERRAIN', 'FIELD', 'COVERAGE'],
      STEEP_RELIEF: ['TERRAIN', 'FLIGHT'],
      LOW_WIRES: ['TERRAIN', 'FLIGHT'],
      SPECULAR_WATER: ['FLIGHT', 'COVERAGE', 'ACCURACY'],
      STRONG_WIND: ['FLIGHT'],
      EM_INTERFERENCE: ['FLIGHT', 'ACCURACY'],
      BLIZZARD_DRAIN: ['FLIGHT', 'ENERGY'],
      MAGIC_FOG: ['FLIGHT', 'COVERAGE'],
      SEARCHLIGHTS: ['FLIGHT'],
      MOVING_HAZARDS: ['FLIGHT'],
      ENERGY_BEAMS: ['FLIGHT'],
      LAVA_THERMALS: ['TERRAIN', 'FLIGHT'],
      VERTICAL_CLIFFS: ['TERRAIN'],
      FEATURE_TARGETS: ['TERRAIN', 'FLIGHT', 'EVALUATION'],
      COLLECTIBLE_RINGS: ['FLIGHT', 'ECONOMY'],
      ELECTRIC_CREATURES: ['FLIGHT'],
      NARROW_TRENCH: ['TERRAIN'],
      PAINT_MARKERS: ['FIELD'],
    };
    for (const id of ALL)
      expect([...getSpecialRule(id).systems].sort(), id).toEqual([...spec[id]].sort());
  });

  it('todas as 20 regras têm efeito registrado em cada sistema que declaram', () => {
    expect(Object.keys(RULE_REGISTRY).sort()).toEqual([...ALL].sort());
    for (const rule of SPECIAL_RULES) {
      const touched = new Set(touchedGroups(rule.id));
      expect(touched.size, rule.id).toBeGreaterThan(0);
      for (const system of rule.systems) {
        expect(touched.has(SYSTEM_GROUP[system]), `${rule.id} → ${system}`).toBe(true);
      }
    }
    expect(EFFECT_GROUPS).toEqual(['terrain', 'flight', 'field', 'coverage', 'accuracy']);
  });

  it('resolveRuleEffects soma as regras, é memoizado e o contrato sem regras é neutro', () => {
    expect(resolveRuleEffects([])).toEqual(neutralRuleEffects());
    const both = resolveRuleEffects(['BLIZZARD_DRAIN', 'MAGIC_FOG']);
    expect(both.flight.energyDrainFactor).toBe(2);
    // Nevasca (400 m) e névoa (250 m) juntas: vale a menor visibilidade.
    expect(both.flight.visibilityM).toBe(250);
    expect(resolveRuleEffects(['MAGIC_FOG', 'BLIZZARD_DRAIN'])).toBe(both);
  });
});

// --- Uma por regra, sobre a arena de teste ---------------------------------------------

const rng = (seed = 1) => mulberry32(seed);
const BODY = { radiusM: 1 };

describe('uma regra por teste, sobre a arena (T036)', () => {
  it('URBAN_CANYON_RTK_LOSS: prédios > 60 m a < 40 m formam o cânion e o RTK vira FLOAT dentro dele', () => {
    const tower = (u: number, v: number, h: number) => ({
      kind: 'BUILDING' as const,
      u,
      v,
      widthM: 20,
      depthM: 20,
      heightM: h,
      color: [150, 150, 150] as [number, number, number],
    });
    const probe = buildTestArena({
      objects: [
        tower(100, 80, 70),
        tower(140, 80, 75), // vão de 20 m do primeiro: cânion
        tower(200, 80, 40), // baixo: fica de fora
        tower(300, 80, 80),
        tower(400, 80, 80), // vão de 80 m: não é cânion
      ],
    });
    const zones = rtkCanyonZones(probe.objects);
    expect(zones).toHaveLength(1);
    expect(zones[0]).toMatchObject({ uMin: 90, uMax: 150, vMin: 70, vMax: 90 });
    const terrain = buildTestArena({ zones });
    expect(terrain.zones).toEqual(zones);
    const effects = resolveRuleEffects(['URBAN_CANYON_RTK_LOSS']);
    expect(effects.flight.rtkFloatInCanyons).toBe(true);
    const inside: AoiPoint = { u: 120, v: 80 };
    expect(rtkStatusAt(true, true, terrain.zones, inside)).toBe('FLOAT');
    expect(rtkStatusAt(true, true, terrain.zones, { u: 250, v: 80 })).toBe('FIX');
    expect(rtkStatusAt(false, true, terrain.zones, inside)).toBe('NONE');
  });

  it('HOMOGENEOUS_TEXTURE: o multiplicador "texture" entra e a esteira mostra 40 % menos tie points', () => {
    const fx = resolveRuleEffects(['HOMOGENEOUS_TEXTURE']);
    expect(fx.accuracy.homogeneousTexture?.tiePointFactor).toBe(0.6);
    const ctx: AccuracyContext = {
      gcpCount: 5,
      phi: 1,
      hullCoverage: 0.6,
      collinearity: 0.8,
      rollingShutter: false,
      meanSkewPx: 0,
      rgbPhotos: true,
      lighting: 'SUN_HIGH',
      homogeneousTexture: fx.accuracy.homogeneousTexture !== null,
      forwardOverlapPct: 70,
      specularWater: false,
      meanCount: 8,
      redFraction: 0,
      blurFraction: 0,
      emInterference: false,
      emImmune: false,
      cameraPenalty: 1,
      atlasCalibrated: false,
      imuScore: 0,
      mods: { rmseGlobal: 1, texturePenalty: 1, rollingShutterPenalty: 1 },
    };
    expect(accuracyMultipliers(ctx).find((m) => m.key === 'texture')?.xy).toBeGreaterThan(1);
    expect(
      accuracyMultipliers({ ...ctx, homogeneousTexture: false }).some((m) => m.key === 'texture'),
    ).toBe(false);
  });

  it('DENSE_CANOPY: dossel 0,90–0,98 invalida os GCPs fora das clareiras e o solo sob as copas', () => {
    const fx = resolveRuleEffects(['DENSE_CANOPY']);
    expect(fx.terrain.denseCanopy).toMatchObject({ minCanopy: 0.9, maxCanopy: 0.98 });
    expect(fx.terrain.denseCanopy?.clearingRadiusM).toEqual([20, 35]);
    expect(fx.coverage.noGroundUnderCanopy).toBe(true);
    const forest = buildTestArena({ canopy: 0.95, cover: 'FOREST' });
    const foot = [
      CATALOG.vehicles.find((v) => v.id === 'FOOT_BIKE') as (typeof CATALOG.vehicles)[number],
    ];
    // Sob a mata fechada, nem a pé nem de picape: sem GCP fora de clareira.
    expect(isAccessible(100, 80, forest, foot, { paintMarkers: false })).toEqual({
      ok: false,
      reason: 'CANOPY',
    });
    // A clareira (dossel 0) vale, e `canopyClearingsOnly` é o que o campo aplica.
    const clearing = buildTestArena({ canopy: 0, cover: 'GRASS' });
    expect(fx.field.canopyClearingsOnly).toBe(true);
    expect(isAccessible(100, 80, clearing, foot, { paintMarkers: true }).ok).toBe(true);
  });

  it('STEEP_RELIEF: o relevo tem ≥ 60 m e taludes de 35–70°; o AGL varia em altitude constante', () => {
    const fx = resolveRuleEffects(['STEEP_RELIEF']);
    expect(fx.terrain.steepRelief).toMatchObject({ minReliefM: 60, slopeDeg: [35, 70] });
    expect(fx.flight.aglVaries).toBe(true);
    // Degraus de 20 m com taludes de ~50° (subida de 20 m em 17 m).
    const stairs = (u: number) => {
      const x = Math.max(0, u);
      return 20 * Math.floor(x / 40) + 20 * Math.max(0, Math.min(1, ((x % 40) - 23) / 17));
    };
    const steps = buildTestArena({ elevation: stairs });
    expect(terrainReliefM(steps)).toBeGreaterThanOrEqual(60);
    const slope = maxSlopeDeg(steps);
    expect(slope).toBeGreaterThanOrEqual(35);
    expect(slope).toBeLessThanOrEqual(70);
    // Em altitude constante a 60 m, o AGL numa crista é bem menor que no vale.
    const alt = 60;
    expect(alt - steps.elevation(5, 40)).toBeGreaterThan(alt - steps.elevation(235, 40) + 60);
    // Terreno plano não é STEEP_RELIEF.
    expect(terrainReliefM(buildTestArena())).toBeLessThan(60);
  });

  it('LOW_WIRES: postes a 30–40 m e fios a 8–14 m colidem a ±1 m da sua altura', () => {
    const nextId = objectIdFactory();
    const { poles, wires } = lowWireLine(
      [
        { u: 20, v: 60 },
        { u: 220, v: 60 },
      ],
      rng(7),
      nextId,
    );
    expect(poles.length).toBeGreaterThanOrEqual(6);
    for (let k = 1; k < poles.length; k++) {
      const gap = Math.hypot(
        (poles[k] as WorldObject).u - (poles[k - 1] as WorldObject).u,
        (poles[k] as WorldObject).v - (poles[k - 1] as WorldObject).v,
      );
      expect(gap).toBeGreaterThanOrEqual(30 - 1e-9);
      expect(gap).toBeLessThanOrEqual(40 + 1e-9);
    }
    expect(wires).toHaveLength(poles.length - 1);
    for (const w of wires) {
      expect(w.baseM).toBeGreaterThanOrEqual(8);
      expect(w.baseM).toBeLessThanOrEqual(14);
    }
    const terrain = buildTestArena({
      objects: [...poles, ...wires].map((o) => ({
        kind: o.kind,
        u: o.u,
        v: o.v,
        widthM: o.widthM,
        depthM: o.depthM,
        heightM: o.heightM,
        color: o.color,
        ...(o.baseM !== undefined ? { baseM: o.baseM } : {}),
        ...(o.u2 !== undefined ? { u2: o.u2, v2: o.v2 as number } : {}),
      })),
    });
    const wire = terrain.objects.find((o) => o.kind === 'WIRE') as WorldObject;
    const mid = { u: (wire.u + (wire.u2 as number)) / 2, v: wire.v };
    const ground = () => 0;
    const h = wire.baseM as number;
    const hitAt = (alt: number) => hitsObject({ ...mid, alt, ...BODY }, wire, 0, ground);
    expect(hitAt(h)).toBe(true);
    expect(hitAt(h + 1)).toBe(true);
    expect(hitAt(h - 1)).toBe(true);
    expect(hitAt(h + 3)).toBe(false);
    expect(hitAt(h - 3)).toBe(false);
    expect(resolveRuleEffects(['LOW_WIRES']).flight.wireCollisions?.hitToleranceM).toBe(1);
  });

  it('SPECULAR_WATER: sob sol alto, foto sobre água é inválida; sob nuvens, vale; a água fica fora da cobertura', () => {
    const fx = resolveRuleEffects(['SPECULAR_WATER']);
    expect(fx.coverage.specularWater && fx.flight.specularWater && fx.accuracy.specularWater).toBe(
      true,
    );
    const lake = buildTestArena({ cover: 'WATER' });
    expect(lake.landCover(120, 80)).toBe('WATER');
    const rules: ShotRules = { sensorKind: 'RGB', specularWater: fx.coverage.specularWater };
    const shot = (lighting: Shot['lighting']) =>
      ({ overWater: true, lighting, blurred: false, inFog: false }) as Shot;
    expect(isShotValid(shot('SUN_HIGH'), rules)).toBe(false);
    expect(isShotValid(shot('OVERCAST'), rules)).toBe(true);
    // Sem a regra, a mesma foto vale.
    expect(isShotValid(shot('SUN_HIGH'), { sensorKind: 'RGB', specularWater: false })).toBe(true);
  });

  it('STRONG_WIND: vento médio ≥ 8 m/s; acima da tolerância da aeronave, a deriva dobra', () => {
    expect(resolveRuleEffects(['STRONG_WIND']).flight.strongWind?.minMeanMs).toBe(8);
    const wind = { meanMs: 8, gustMs: 3, directionDeg: 90 };
    const atlas = getAircraft('ATLAS');
    const t1 = getAircraft('DRONE_T1');
    // O Atlas tolera menos que o T1: com 11 m/s de pico, só um deles passa do limite.
    expect(windAboveTolerance(wind, atlas)).toBe(wind.meanMs + wind.gustMs > atlas.windToleranceMs);
    const strong = { meanMs: atlas.windToleranceMs, gustMs: 1, directionDeg: 0 };
    expect(driftMultiplier(strong, atlas)).toBe(2);
    expect(driftMultiplier({ meanMs: 0, gustMs: 0, directionDeg: 0 }, t1)).toBe(1);
    expect(RULE_PARAMS.strongWind.minMeanMs).toBe(8);
  });

  it('EM_INTERFERENCE: tremor de ±0,8 m/s e 3°, só em aeronave não imune; RMSE × 1,2', () => {
    const fx = resolveRuleEffects(['EM_INTERFERENCE']);
    expect(fx.flight.emInterference).toEqual({ lateralMs: 0.8, headingDeg: 3 });
    expect(fx.accuracy.emRmseFactor).toBe(1.2);
    expect(emActive(['EM_INTERFERENCE'], getAircraft('DRONE_T1'))).toBe(true);
    expect(emActive(['EM_INTERFERENCE'], getAircraft('ATLAS'))).toBe(false);
    expect(emActive([], getAircraft('DRONE_T1'))).toBe(false);
    const d = emDisturbance(5, () => 1);
    expect(d.lateralMs).toBeCloseTo(0.8, 12);
    expect(d.headingRad).toBeCloseTo((3 * Math.PI) / 180, 12);
  });

  it('BLIZZARD_DRAIN: o dreno de energia dobra e a visibilidade cai para 400 m', () => {
    const fx = resolveRuleEffects(['BLIZZARD_DRAIN']);
    expect(fx.flight.visibilityM).toBe(400);
    const ctx = {
      enduranceS: 1200,
      enduranceMod: 1,
      speedMs: 10,
      vCruiseMs: 10,
      windMs: 0,
      climbing: false,
      blizzard: false,
    };
    expect(drainPerSecond({ ...ctx, blizzard: fx.flight.energyDrainFactor > 1 })).toBeCloseTo(
      2 * drainPerSecond(ctx),
      12,
    );
  });

  it('MAGIC_FOG: toda foto RGB fica inFog e não conta; o LiDAR não é afetado; visibilidade de 250 m', () => {
    const fx = resolveRuleEffects(['MAGIC_FOG']);
    expect(fx.flight.visibilityM).toBe(250);
    expect(fx.coverage.fog).toBe(true);
    const foggy = { inFog: true, blurred: false, overWater: false, lighting: 'MAGIC_FOG' } as Shot;
    expect(isShotValid(foggy, { sensorKind: 'RGB', specularWater: false })).toBe(false);
    expect(isShotValid(foggy, { sensorKind: 'LIDAR', specularWater: false })).toBe(true);
  });

  it('SEARCHLIGHTS: 1,5 s dentro do cone (Atlas: 3 s) detectam, e o voo continua', () => {
    const terrain = buildTestArena({
      zones: [{ kind: 'SEARCHLIGHT', u: 120, v: 80, radiusM: 40, sweepRad: 1, periodS: 8 }],
    });
    const fx = resolveRuleEffects(['SEARCHLIGHTS']);
    expect(fx.flight.searchlights).toEqual({ detectS: 1.5, detectAtlasS: 3 });
    expect([SEARCHLIGHT_DETECT_S, SEARCHLIGHT_DETECT_ATLAS_S]).toEqual([1.5, 3]);
    expect(insideSearchlight(terrain.zones, 140, 80, 0)).toBe(true);
    const run = (atlas: boolean, seconds: number) => {
      let s = initialDetection();
      for (let t = 0; t < seconds; t += 0.1) s = stepDetection(s, true, 0.1, atlas);
      return s.detected;
    };
    expect(run(false, 1.4)).toBe(false);
    expect(run(false, 1.7)).toBe(true);
    expect(run(true, 2.9)).toBe(false);
    expect(run(true, 3.2)).toBe(true);
  });

  it('MOVING_HAZARDS: movimento senoidal de 10–25 m de amplitude e 3–6 s de período', () => {
    const fx = resolveRuleEffects(['MOVING_HAZARDS']);
    expect(fx.flight.movingHazards).toEqual({ amplitudeM: [10, 25], periodS: [3, 6] });
    const terrain = buildTestArena({
      objects: [
        {
          kind: 'MOVING_HAZARD',
          u: 120,
          v: 80,
          widthM: 6,
          depthM: 6,
          heightM: 6,
          color: [200, 50, 50],
          motion: { axis: 'u', amplitudeM: 20, periodS: 4, phase: 0 },
        },
      ],
    });
    const hazard = terrain.objects[0] as WorldObject;
    expect(motionOffset(hazard, 0).du).toBeCloseTo(0, 12);
    expect(motionOffset(hazard, 1).du).toBeCloseTo(20, 9); // pico em T/4
    expect(motionOffset(hazard, 3).du).toBeCloseTo(-20, 9);
    expect(motionOffset(hazard, 4).du).toBeCloseTo(0, 9);
    // Na posição do pico, o perigo (esfera) acerta a aeronave; longe dela, não.
    const ground = () => 0;
    expect(hitsObject({ u: 140, v: 80, alt: 3, radiusM: 1 }, hazard, 1, ground)).toBe(true);
    expect(hitsObject({ u: 140, v: 80, alt: 3, radiusM: 1 }, hazard, 3, ground)).toBe(false);
  });

  it('ENERGY_BEAMS: 2 s ligados e 3 s desligados; só colidem ligados', () => {
    const fx = resolveRuleEffects(['ENERGY_BEAMS']);
    expect(fx.flight.energyBeams).toEqual({ onS: 2, offS: 3, warnS: 0.5 });
    const terrain = buildTestArena({
      objects: [
        {
          kind: 'ENERGY_BEAM',
          u: 120,
          v: 80,
          widthM: 4,
          depthM: 4,
          heightM: 60,
          color: [90, 200, 255],
          activePeriod: { onS: 2, offS: 3, phase: 0 },
        },
      ],
    });
    const beam = terrain.objects[0] as WorldObject;
    expect([0, 1.9, 2.1, 4.9, 5.1].map((t) => isBeamOn(beam, t))).toEqual([
      true,
      true,
      false,
      false,
      true,
    ]);
    const ground = () => 0;
    const body = { u: 120, v: 80, alt: 20, radiusM: 1 };
    expect(checkCollision(body, terrain.objects, 1, ground)).not.toBeNull();
    expect(checkCollision(body, terrain.objects, 3, ground)).toBeNull();
  });

  it('LAVA_THERMALS: cada aglomerado de lava vira uma térmica de 6 m/s (r = 40 m)', () => {
    const fx = resolveRuleEffects(['LAVA_THERMALS']);
    expect(fx.terrain.lavaThermals).toEqual({ liftMs: 6, radiusM: 40 });
    expect(fx.flight.thermalGlow).toBe(true);
    const zones = lavaThermalZones([
      { u: 100, v: 100 },
      { u: 110, v: 108 },
      { u: 90, v: 92 },
      { u: 200, v: 40 },
    ]);
    expect(zones).toHaveLength(2);
    const terrain = buildTestArena({ zones });
    expect(thermalLiftMs(terrain.zones, 100, 100, 'SUN_HIGH', 1)).toBeCloseTo(6, 6);
    expect(thermalLiftMs(terrain.zones, 100 + 40, 100, 'SUN_HIGH', 1)).toBeCloseTo(0, 6);
    // Sem sol a pino, metade.
    expect(thermalLiftMs(terrain.zones, 100, 100, 'OVERCAST', 1)).toBeCloseTo(3, 6);
  });

  it('VERTICAL_CLIFFS: paredões > 80° de 60–100 m de altura', () => {
    const fx = resolveRuleEffects(['VERTICAL_CLIFFS']);
    expect(fx.terrain.verticalCliffs).toEqual({ minSlopeDeg: 80, heightM: [60, 100] });
    // Um degrau de 80 m numa faixa de 1 m: ~89°.
    const cliff = buildTestArena({
      elevation: (_u, v) => 80 * Math.max(0, Math.min(1, v - 79.5)),
    });
    expect(maxSlopeDeg(cliff, 1)).toBeGreaterThan(80);
    expect(terrainReliefM(cliff, 1)).toBeGreaterThanOrEqual(60);
    expect(terrainReliefM(cliff, 1)).toBeLessThanOrEqual(100);
  });

  it('FEATURE_TARGETS: PHOTO pede ≥ 3 fotos válidas; LIDAR, ≥ 50 pulsos/m² na célula do centro', () => {
    const fx = resolveRuleEffects(['FEATURE_TARGETS']);
    expect(fx.terrain.featureTargets && fx.flight.featureCapture).toBe(true);
    const terrain = buildTestArena({
      features: [
        { id: 'TOCA', name: 'Toca', u: 60, v: 40, radiusM: 5, needs: 'LIDAR' },
        { id: 'TEMPLO', name: 'Templo', u: 180, v: 120, radiusM: 5, needs: 'LIDAR' },
      ],
    });
    expect(terrain.features).toHaveLength(2);
    const cols = 64;
    const rows = 64;
    const pulses = new Array<number>(cols * rows).fill(0);
    const cell = (u: number, v: number) =>
      Math.floor((v / 160) * rows) * cols + Math.floor((u / 240) * cols);
    const cellArea = (240 / cols) * (160 / rows);
    pulses[cell(60, 40)] = 50 * cellArea; // exatamente 50 pulsos/m²
    pulses[cell(180, 120)] = 49 * cellArea; // um a menos
    const mission = {
      shots: [],
      lidar: {
        grid: { cols, rows, pulses, firstAbove: pulses, ground: pulses, cellAreaM2: cellArea },
        samples: [],
      },
    };
    const found = capturedFeatures(mission, terrain, {
      aoi: { lengthM: 240, widthM: 160 },
      aircraftKind: 'FIXED_WING_VTOL',
      sensor: CATALOG.sensors[0] as (typeof CATALOG.sensors)[number],
      focalM: 0.02,
      rules: { sensorKind: 'LIDAR', specularWater: false },
    });
    expect(found).toEqual(['TOCA']);
  });

  it('COLLECTIBLE_RINGS: anéis de 3 m, coleta a < 3 m do centro e R$ 50 de bônus cada', () => {
    const fx = resolveRuleEffects(['COLLECTIBLE_RINGS']);
    expect(fx.flight.rings).toEqual({
      radiusM: 3,
      altitudeM: [10, 40],
      collectM: 3,
      bonusCents: 5000,
    });
    expect(RING_BONUS_CENTS).toBe(5000);
    const terrain = buildTestArena({
      objects: [
        {
          kind: 'RING',
          u: 120,
          v: 80,
          widthM: 6,
          depthM: 6,
          heightM: 6,
          baseM: 22,
          color: [250, 204, 21],
          solid: false,
          collectible: true,
        },
      ],
    });
    const ring = terrain.objects[0] as WorldObject;
    const ground = (u: number, v: number) => terrain.elevation(u, v);
    expect(ringCollected(ring, { u: 120, v: 80, alt: 25 }, ground)).toBe(true);
    expect(ringCollected(ring, { u: 122, v: 80, alt: 25 }, ground)).toBe(true);
    expect(ringCollected(ring, { u: 124, v: 80, alt: 25 }, ground)).toBe(false);
    // O anel não é sólido: passar por ele não é colisão.
    expect(
      checkCollision({ u: 120, v: 80, alt: 25, radiusM: 1 }, terrain.objects, 0, ground),
    ).toBeNull();
    // O bônus entra no pagamento como `ringBonusBRL` (somado em evaluateMission).
    const base = computePayment({
      baseBRL: 250_000,
      isReplay: false,
      qualityFactor: 1,
      rivalFactor: 1,
      contractPaymentMod: 1,
      staff: { INTERN: 0, JUNIOR_ENG: 0 },
      penaltiesBRL: 0,
    });
    expect(base.totalBRL + 3 * (fx.flight.rings?.bonusCents ?? 0)).toBe(250_000 + 15_000);
  });

  it('ELECTRIC_CREATURES: picos de 2 s a cada 8–12 s empurram 3 m/s; o Atlas é imune', () => {
    const fx = resolveRuleEffects(['ELECTRIC_CREATURES']);
    expect(fx.flight.electricCreatures).toEqual({ intervalS: [8, 12], spikeS: 2, forceMs: 3 });
    const schedule = new ElectricSchedule(rng(5));
    const starts: number[] = [];
    let prev = false;
    for (let t = 0; t < 120; t += 0.05) {
      const on = schedule.at(t) !== null;
      if (on && !prev) starts.push(t);
      prev = on;
    }
    expect(starts.length).toBeGreaterThanOrEqual(8);
    expect(starts[0]).toBeGreaterThanOrEqual(8 - 0.05);
    expect(starts[0]).toBeLessThanOrEqual(12 + 0.05);
    for (let k = 1; k < starts.length; k++) {
      // Do começo de um pico ao do próximo: 2 s de pico + 8–12 s de calmaria.
      const gap = (starts[k] as number) - (starts[k - 1] as number);
      expect(gap).toBeGreaterThanOrEqual(10 - 0.1);
      expect(gap).toBeLessThanOrEqual(14 + 0.1);
    }
    expect(Math.abs(schedule.lateralMs((starts[0] as number) + 0.5))).toBe(3);
    // Imunidade do Atlas: a mesma condição que o motor usa para criar o agendamento.
    const active = (id: 'ATLAS' | 'DRONE_T1') =>
      fx.flight.electricCreatures !== null && !getAircraft(id).emImmune;
    expect(active('ATLAS')).toBe(false);
    expect(active('DRONE_T1')).toBe(true);
  });

  it('NARROW_TRENCH: 50 m de largura e 40 m de profundidade, com torres sólidas nas bordas', () => {
    const fx = resolveRuleEffects(['NARROW_TRENCH']);
    expect(fx.terrain.narrowTrench).toEqual({ widthM: 50, depthM: 40 });
    const terrain = buildTestArena({
      elevation: (_u, v) => trenchElevation(v, 60),
      objects: [35, 85].flatMap((v) =>
        [40, 120, 200].map((u) => ({
          kind: 'TOWER' as const,
          u,
          v,
          widthM: 8,
          depthM: 8,
          heightM: 30,
          color: [120, 120, 130] as [number, number, number],
        })),
      ),
    });
    expect(terrain.elevation(100, 60)).toBe(-40);
    expect(terrain.elevation(100, 36)).toBe(-40);
    expect(terrain.elevation(100, 34)).toBe(0);
    expect(terrain.elevation(100, 84)).toBe(-40);
    expect(terrain.elevation(100, 86)).toBe(0);
    expect(terrainReliefM(terrain, 1)).toBeCloseTo(40, 9);
    const towers = terrain.objects.filter((o) => o.kind === 'TOWER');
    expect(towers).toHaveLength(6);
    expect(towers.every((t) => t.solid)).toBe(true);
    const ground = (u: number, v: number) => terrain.elevation(u, v);
    // Os objetos ficam ordenados por `u`: procura a torre da borda em vez de confiar no índice.
    const edge = towers.find((t) => t.u === 120 && t.v === 35) as WorldObject;
    expect(hitsObject({ u: 120, v: 35, alt: 10, radiusM: 1 }, edge, 0, ground)).toBe(true);
    // Dentro da trincheira, entre as torres, o corredor está livre.
    expect(
      checkCollision({ u: 120, v: 60, alt: 10, radiusM: 1 }, terrain.objects, 0, ground),
    ).toBeNull();
  });

  it('PAINT_MARKERS: os GCPs ignoram o alcance dos veículos; água e telhado continuam inválidos', () => {
    const fx = resolveRuleEffects(['PAINT_MARKERS']);
    expect(fx.field.paintMarkers).toBe(true);
    const foot = [
      CATALOG.vehicles.find((v) => v.id === 'FOOT_BIKE') as (typeof CATALOG.vehicles)[number],
    ];
    // A arena não tem estradas: a pé, nenhum ponto está ao alcance.
    const open = buildTestArena();
    expect(isAccessible(120, 80, open, foot, { paintMarkers: false })).toMatchObject({ ok: false });
    expect(isAccessible(120, 80, open, foot, { paintMarkers: fx.field.paintMarkers })).toEqual({
      ok: true,
    });
    // Água e telhado seguem inválidos.
    const lake = buildTestArena({ cover: 'WATER' });
    expect(isAccessible(120, 80, lake, foot, { paintMarkers: true })).toEqual({
      ok: false,
      reason: 'WATER',
    });
    const roof = buildTestArena({ cover: 'ROOF' });
    expect(isAccessible(120, 80, roof, foot, { paintMarkers: true })).toEqual({
      ok: false,
      reason: 'ROOF',
    });
  });
});
