import { CATALOG } from '@/data/catalog';
import { brl } from '@/data/catalog/money';
import { C00 } from '@/data/contracts';
import { SKILLS } from '@/data/skills';
import { stepAvatar } from '@/engines/overworld/avatar';
import { mulberry32 } from '@/lib/rng';
import { selectModifiers } from '@/state/selectors';
import { useGameStore } from '@/state/store';
import { resetGameStore } from '@/test/resetStore';
import { referenceParams } from '@/test/fixtures/syntheticMission';
import type { MuseumSector, PlanParams, SpecialZone } from '@/types';
import { parseMap } from '@/world/overworld/tiles';
import { accuracyMultipliers, type AccuracyContext } from './accuracy';
import { shopPrice, computePayment, computeRewards } from './economy';
import { drainPerSecond } from './energy';
import { buildFlightPlan } from './flightPlanner';
import { driftVelocityMs, thermalLiftMs } from './flightPhysics';
import { lidarRmseZ } from './lidar';
import { applyModifiers, MODIFIER_KEYS, neutralModifiers } from './modifiers';
import { museumIncomePerMin } from './museum';
import { rollCounterOffer } from './rival';

describe('applyModifiers', () => {
  it('sem habilidades, todos os 13 modificadores valem 1', () => {
    const m = applyModifiers([]);
    expect(MODIFIER_KEYS).toHaveLength(13);
    for (const k of MODIFIER_KEYS) expect(m[k], k).toBe(1);
    expect(m).toEqual(neutralModifiers());
  });

  it('PIL_1 dá windDrift 0,8; efeitos de nós diferentes na mesma chave se multiplicam', () => {
    expect(applyModifiers(['PIL_1']).windDrift).toBeCloseTo(0.8, 12);
    // Duas habilidades que mexem na mesma chave: o produto.
    const sameKey = SKILLS.filter((n) => n.effects.some((e) => e.key === 'rmseGlobal'));
    if (sameKey.length > 1) {
      const product = sameKey.reduce(
        (p, n) => p * (n.effects.find((e) => e.key === 'rmseGlobal')?.value ?? 1),
        1,
      );
      expect(applyModifiers(sameKey.map((n) => n.id)).rmseGlobal).toBeCloseTo(product, 12);
    }
    expect(applyModifiers(['NAO_EXISTE'])).toEqual(neutralModifiers());
  });

  it('as 12 habilidades cobrem as 13 chaves, e só chaves conhecidas', () => {
    const keys = new Set(SKILLS.flatMap((n) => n.effects.map((e) => e.key)));
    expect([...keys].sort()).toEqual([...MODIFIER_KEYS].sort());
  });
});

// --- Um teste por consumidor (progression §6) -----------------------------------------

describe('consumidores dos 13 modificadores', () => {
  it('windDrift → driftVelocityMs', () => {
    const base = driftVelocityMs(5, 0.6, 1);
    expect(driftVelocityMs(5, 0.6, 0.8)).toBeCloseTo(0.8 * base, 12);
  });

  it('endurance → drainPerSecond e o número de baterias do plano', () => {
    const ctx = {
      enduranceS: 1200,
      enduranceMod: 1,
      speedMs: 10,
      vCruiseMs: 10,
      windMs: 0,
      climbing: false,
      blizzard: false,
    };
    expect(drainPerSecond({ ...ctx, enduranceMod: 1.15 })).toBeCloseTo(
      drainPerSecond(ctx) / 1.15,
      12,
    );
    // O plano usa a mesma autonomia: uma missão longa precisa de menos baterias com +15 %.
    const params: PlanParams = {
      ...referenceParams(C00),
      aircraftId: 'DRONE_T1',
      sensorId: 'CAM_20MP_RS',
      heightM: 40,
    };
    const long = { ...C00, aoi: { widthM: 900, lengthM: 1400 } };
    const plain = buildFlightPlan(params, long, CATALOG);
    const boosted = buildFlightPlan(params, long, CATALOG, { enduranceMod: 1.5 });
    expect(plain.stats.batteriesNeeded).toBeGreaterThan(1);
    expect(boosted.stats.batteriesNeeded).toBeLessThan(plain.stats.batteriesNeeded);
  });

  it('overworldSpeed → velocidade do avatar no mapa', () => {
    const map = parseMap(Array.from({ length: 4 }, () => '.'.repeat(20)));
    const at = { x: 2.5, y: 2, facing: 'E' as const, walked: 0 };
    const base = stepAvatar(map, at, 1, 0, 'FOOT_BIKE', 1, 0.5).moved;
    const fast = stepAvatar(map, at, 1, 0, 'FOOT_BIKE', 1.2, 0.5).moved;
    expect(fast).toBeCloseTo(1.2 * base, 12);
  });

  it('thermalEffect → sustentação das térmicas', () => {
    const zone: SpecialZone = { kind: 'THERMAL', u: 50, v: 50, radiusM: 40, liftMs: 3 };
    const base = thermalLiftMs([zone], 50, 50, 'SUN_HIGH', 1);
    expect(base).toBeGreaterThan(0);
    expect(thermalLiftMs([zone], 50, 50, 'SUN_HIGH', 1.25)).toBeCloseTo(1.25 * base, 12);
  });

  const ACC: AccuracyContext = {
    gcpCount: 5,
    phi: 1,
    hullCoverage: 0.6,
    collinearity: 0.8,
    rollingShutter: false,
    meanSkewPx: 0,
    rgbPhotos: true,
    lighting: 'SUN_HIGH',
    homogeneousTexture: false,
    forwardOverlapPct: 75,
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
  const find = (over: Partial<AccuracyContext>, key: string) =>
    accuracyMultipliers({ ...ACC, ...over }).find((m) => m.key === key);

  it('rmseGlobal → multiplicador "skills" da acurácia', () => {
    expect(find({}, 'skills')).toBeUndefined();
    expect(find({ mods: { ...ACC.mods, rmseGlobal: 0.9 } }, 'skills')).toMatchObject({
      xy: 0.9,
      z: 0.9,
    });
  });

  it('texturePenalty → multiplicador "texture" (textura homogênea)', () => {
    const base = find({ homogeneousTexture: true }, 'texture');
    const reduced = find(
      { homogeneousTexture: true, mods: { ...ACC.mods, texturePenalty: 0.5 } },
      'texture',
    );
    expect(base?.xy).toBeGreaterThan(1);
    expect((reduced?.xy ?? 1) - 1).toBeCloseTo(0.5 * ((base?.xy ?? 1) - 1), 12);
  });

  it('rollingShutterPenalty → multiplicador "rollingShutter"', () => {
    const rs = { rollingShutter: true, meanSkewPx: 10, phi: 0.2 };
    const base = find(rs, 'rollingShutter');
    const reduced = find(
      { ...rs, mods: { ...ACC.mods, rollingShutterPenalty: 0.5 } },
      'rollingShutter',
    );
    expect((reduced?.xy ?? 1) - 1).toBeCloseTo(0.5 * ((base?.xy ?? 1) - 1), 12);
  });

  it('lidarNoise → σ vertical do LiDAR', () => {
    const base = lidarRmseZ(0.02, 80, 0, 1, 1, 1);
    expect(lidarRmseZ(0.02, 80, 0, 0.85, 1, 1)).toBeCloseTo(0.85 * base, 12);
  });

  it('contractPayment → fator G do pagamento', () => {
    const input = {
      baseBRL: brl(12_000),
      isReplay: false,
      qualityFactor: 1,
      rivalFactor: 1,
      contractPaymentMod: 1,
      staff: { INTERN: 0, JUNIOR_ENG: 0 },
      penaltiesBRL: 0,
    };
    const base = computePayment(input);
    const boosted = computePayment({ ...input, contractPaymentMod: 1.25 });
    expect(boosted.totalBRL).toBe(Math.round(base.totalBRL * 1.25));
    expect(boosted.managementBonus).toBe(1.25);
  });

  it('museumVisitors → renda por minuto do museu', () => {
    const sectors: Record<string, MuseumSector> = {
      C00: {
        contractId: 'C00',
        qualityScore: 0.9,
        mappedAt: 0,
        incomePerMinBRL: 900,
        className: 'A',
      },
    };
    expect(museumIncomePerMin(sectors, {}, 1.3)).toBeCloseTo(
      1.3 * museumIncomePerMin(sectors, {}, 1),
      9,
    );
  });

  it('shopPrice → preço de loja (o mesmo valor que o canBuy cobra)', () => {
    expect(shopPrice(brl(6_000), 0.85)).toBe(brl(5_100));
    expect(shopPrice(brl(6_000), 1)).toBe(brl(6_000));
  });

  it('reputationGain → só os ganhos de reputação do contrato crescem; perdas, não', () => {
    const input = {
      xp: 100,
      reputationReward: 4,
      isReplay: false,
      score: 0.9,
      critical: false,
      reputationGainMod: 1,
    };
    const base = computeRewards(input);
    const boosted = computeRewards({ ...input, reputationGainMod: 1.5 });
    expect(boosted.reputationDelta).toBeGreaterThan(base.reputationDelta);
    expect(
      computeRewards({ ...input, critical: true, reputationGainMod: 1.5 }).reputationDelta,
    ).toBe(computeRewards({ ...input, critical: true }).reputationDelta);
  });

  it('rivalChance → chance da contraproposta (0,20 × mod)', () => {
    const rate = (mod: number) => {
      const rng = mulberry32(99);
      let n = 0;
      for (let i = 0; i < 20_000; i++) if (rollCounterOffer(rng, mod)) n++;
      return n / 20_000;
    };
    expect(rate(1)).toBeCloseTo(0.2, 1);
    expect(rate(0.5)).toBeCloseTo(0.1, 1);
    expect(rate(0)).toBe(0);
  });
});

describe('selectModifiers (a ponte dos nós até os consumidores)', () => {
  beforeEach(() => resetGameStore());

  it('reflete as habilidades da store e é memoizado por referência dos nós adquiridos', () => {
    expect(selectModifiers(useGameStore.getState()).windDrift).toBe(1);
    useGameStore.setState({ skills: ['PIL_1'] });
    const a = selectModifiers(useGameStore.getState());
    expect(a.windDrift).toBeCloseTo(0.8, 12);
    expect(selectModifiers(useGameStore.getState())).toBe(a);
  });
});
