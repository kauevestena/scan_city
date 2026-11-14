import { expectTypeOf } from 'vitest';
import type {
  AoiPoint,
  CentsBRL,
  Contract,
  ContractProgress,
  ContractRequirement,
  LightingId,
  MissionData,
  RequirementCheck,
  RtkStatus,
  SaveGame,
  ScreenId,
  Shot,
  UnlockCondition,
} from './index';

const shot: Shot = {
  i: 0,
  t: 12.5,
  sortie: 0,
  lineIndex: 2,
  u: 40,
  v: 60,
  aglM: 60,
  altM: 110,
  speedMs: 8,
  headingRad: 0,
  crabRad: 0,
  tiltDeg: 0,
  footprintWM: 80,
  footprintHM: 60,
  blurPx: 0.3,
  skewPx: 0,
  blurred: false,
  lighting: 'SUN_HIGH',
  rtk: 'NONE',
  manual: false,
  overWater: false,
  inFog: false,
};

const contract: Contract = {
  id: 'C00',
  dimension: 'REAL',
  title: 'Sítio do Avô',
  client: {
    name: 'Tia Zefa',
    role: 'Vizinha',
    description: 'Cuida do sítio desde sempre.',
    portrait: {
      shape: 'CIRCLE',
      icon: 'Home',
      primary: '#f97316',
      secondary: '#1e293b',
      initials: 'TZ',
    },
  },
  objective: 'Mapear o sítio.',
  biome: 'RURAL_TUTORIAL',
  seed: 1,
  aoi: { widthM: 200, lengthM: 300 },
  ceilingM: 120,
  terrainReliefM: 12,
  lightingOptions: ['SUN_HIGH', 'OVERCAST'],
  wind: { meanMs: 1, gustMs: 2, directionDeg: 90 },
  specialRules: [],
  requirements: [
    {
      id: 'gsd',
      label: 'GSD ≤ 5 cm',
      severity: 'CRITICAL',
      check: { type: 'MAX_GSD_CM', value: 5 },
    },
  ],
  recommended: { aircraft: ['ATLAS'], sensors: ['CAM_PIGEON'], vehicle: 'FOOT_BIKE', notes: '' },
  minVehicle: 'FOOT_BIKE',
  basePaymentBRL: 150000,
  xp: 100,
  reputationReward: 3,
  souvenirId: 'SV_NOTEBOOK',
  museum: { wing: 'REAL', slot: 0, incomePerMinBRL: 1000 },
  unlock: { type: 'ALWAYS' },
  overworldMarker: '0',
  dialogs: { briefing: ['Oi!'], success: ['Ótimo!'], failure: ['Que pena.'] },
  referencePlan: {
    aircraftId: 'ATLAS',
    sensorId: 'CAM_PIGEON',
    heightM: 60,
    forwardOverlapPct: 80,
    sideOverlapPct: 60,
    speedMs: 8,
    modes: [],
    lighting: 'SUN_HIGH',
    gcps: [{ u: 10, v: 10 }],
    cps: [],
    expected: { gsdCm: 2.7, nLines: 6, flightTimeS: 231.45 },
  },
};

const save: SaveGame = {
  version: 1,
  createdAt: 0,
  updatedAt: 0,
  player: { name: 'Geodesta', money: 500000, xp: 0, level: 1, skillPoints: 0, reputation: 30 },
  skills: [],
  staff: { INTERN: 0, JUNIOR_ENG: 0 },
  inventory: {
    aircraft: ['ATLAS'],
    sensors: ['CAM_PIGEON'],
    lenses: [],
    payloads: [],
    vehicles: ['FOOT_BIKE'],
    fieldEquipment: ['TOTAL_STATION'],
    hardware: 'OLD_LAPTOP',
    cosmetics: ['CHAR_VEST', 'PAINT_GREY', 'ATLAS_NONE'],
    equipped: { character: 'CHAR_VEST', dronePaint: 'PAINT_GREY', atlasAccessory: 'ATLAS_NONE' },
    emblem: {
      shape: 'SHIELD',
      icon: 'Compass',
      primary: '#22d3ee',
      secondary: '#0f172a',
      initials: 'GS',
    },
    corn: { stock: 20, crop: 10 },
    atlasCalibrationFlights: 0,
  },
  contracts: { C00: { status: 'AVAILABLE', completions: 0, bestScore: 0 } },
  museum: { sectors: {}, featured: {}, lastIncomeAt: 0, totalVisitors: 0 },
  souvenirs: [],
  pendingMissions: [],
  world: {
    avatar: { x: 80, y: 50, facing: 'S' },
    vehicleMode: 'FOOT_BIKE',
    dimensionTab: 'REAL',
    discoveredRifts: [],
    lastEventAt: 0,
  },
  rival: { score: 0, history: [] },
  stats: { contractsCompleted: 0, photosTaken: 0, flightTimeS: 0, crashes: 0, distanceTiles: 0 },
  flags: { introSeen: false, finaleSeen: false, tutorialStep: 0 },
};

describe('tipos canônicos (data-model)', () => {
  it('Shot', () => {
    expectTypeOf(shot).toEqualTypeOf<Shot>();
    expectTypeOf<Shot['lighting']>().toEqualTypeOf<LightingId>();
    expectTypeOf<Shot['rtk']>().toEqualTypeOf<RtkStatus>();
    expect(shot.footprintWM).toBe(80);
  });

  it('Contract', () => {
    expectTypeOf(contract).toEqualTypeOf<Contract>();
    expectTypeOf<Contract['basePaymentBRL']>().toEqualTypeOf<CentsBRL>();
    expectTypeOf<Contract['unlock']>().toEqualTypeOf<UnlockCondition>();
    expectTypeOf<Contract['requirements']>().toEqualTypeOf<readonly ContractRequirement[]>();
    expectTypeOf<ContractRequirement['check']>().toEqualTypeOf<RequirementCheck>();
    expectTypeOf<Contract['referencePlan']['gcps']>().toEqualTypeOf<readonly AoiPoint[]>();
    expect(contract.requirements).toHaveLength(1);
  });

  it('SaveGame', () => {
    expectTypeOf(save).toEqualTypeOf<SaveGame>();
    expectTypeOf<SaveGame['version']>().toEqualTypeOf<1>();
    expectTypeOf<SaveGame['pendingMissions']>().toEqualTypeOf<MissionData[]>();
    expectTypeOf<SaveGame['contracts']>().toEqualTypeOf<Record<string, ContractProgress>>();
    expect(save.inventory.aircraft).toEqual(['ATLAS']);
  });

  it('ScreenId tem exatamente as 7 telas', () => {
    expectTypeOf<ScreenId>().toEqualTypeOf<
      | 'OFFICE'
      | 'WORLD_MAP'
      | 'FIELD_SETUP'
      | 'SURVEY_FLIGHT'
      | 'PROCESSING_RESULTS'
      | 'HOLO_TABLE_VIEW'
      | 'INFOGRAPHIC_LAB'
    >();
  });
});
