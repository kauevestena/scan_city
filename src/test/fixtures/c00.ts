import { brl } from '@/data/catalog';
import type { Contract } from '@/types';

/**
 * C00 "Sítio do Avô" (contracts-real, C00) para os testes do domínio.
 * O objeto de dados do jogo nasce em `src/data/contracts/real.ts` (T022).
 */
export const C00_FIXTURE: Contract = {
  id: 'C00',
  dimension: 'REAL',
  title: 'Sítio do Avô',
  client: {
    name: 'Seu Zé Bento',
    role: 'Caseiro do sítio',
    description: 'Senhor de chapéu de palha que conheceu o avô por 40 anos.',
    portrait: {
      shape: 'CIRCLE',
      icon: 'Tractor',
      primary: '#a16207',
      secondary: '#fde68a',
      initials: 'ZB',
    },
  },
  objective: 'Levantamento planialtimétrico do sítio do avô para o inventário da família.',
  biome: 'RURAL_TUTORIAL',
  seed: 1001,
  aoi: { widthM: 160, lengthM: 240 },
  ceilingM: 80,
  terrainReliefM: 15,
  lightingOptions: ['SUN_HIGH', 'OVERCAST'],
  wind: { meanMs: 2, gustMs: 1, directionDeg: 90 },
  specialRules: [],
  requirements: [
    {
      id: 'C00-cov',
      label: 'Cobertura verde ≥ 70 %',
      severity: 'CRITICAL',
      check: { type: 'MIN_COVERAGE_GREEN', value: 0.7 },
    },
    {
      id: 'C00-gsd',
      label: 'GSD ≤ 5 cm',
      severity: 'MAJOR',
      check: { type: 'MAX_GSD_CM', value: 5 },
    },
    {
      id: 'C00-gcp',
      label: 'Ao menos 3 GCPs',
      severity: 'MAJOR',
      check: { type: 'MIN_GCP', value: 3 },
    },
    {
      id: 'C00-pec',
      label: 'PEC-PCD classe C (1:2.000)',
      severity: 'MAJOR',
      check: { type: 'ACCURACY_PEC', cls: 'C', scaleDenominator: 2000 },
    },
    {
      id: 'C00-p',
      label: 'Sobreposição longitudinal ≥ 65 %',
      severity: 'MINOR',
      check: { type: 'MIN_FORWARD_OVERLAP', value: 65 },
    },
    {
      id: 'C00-q',
      label: 'Sobreposição lateral ≥ 55 %',
      severity: 'MINOR',
      check: { type: 'MIN_SIDE_OVERLAP', value: 55 },
    },
  ],
  recommended: { aircraft: ['ATLAS'], sensors: ['CAM_PIGEON'], vehicle: 'FOOT_BIKE', notes: '' },
  minVehicle: 'FOOT_BIKE',
  basePaymentBRL: brl(2_500),
  xp: 150,
  reputationReward: 5,
  souvenirId: 'SV_NOTEBOOK',
  museum: { wing: 'REAL', slot: 0, incomePerMinBRL: brl(10) },
  unlock: { type: 'ALWAYS' },
  overworldMarker: '0',
  dialogs: {
    briefing: ['Seu avô mediu essas cercas com teodolito e paciência.'],
    success: ['Tá tudo aqui, tintim por tintim. Ele ia ficar orgulhoso.'],
    failure: ['Uai, faltou pedaço do sítio no mapa…'],
  },
  referencePlan: {
    aircraftId: 'ATLAS',
    sensorId: 'CAM_PIGEON',
    heightM: 60,
    forwardOverlapPct: 70,
    sideOverlapPct: 60,
    speedMs: 10,
    modes: [],
    lighting: 'SUN_HIGH',
    gcps: [
      { u: 25, v: 20 },
      { u: 215, v: 20 },
      { u: 25, v: 140 },
      { u: 215, v: 140 },
      { u: 120, v: 80 },
    ],
    cps: [
      { u: 70, v: 50 },
      { u: 170, v: 110 },
    ],
    expected: { gsdCm: 2.52, nLines: 6, flightTimeS: 231.5 },
  },
};
