/** Campanha principal: contratos do Mundo Real (contracts-real). */
import { Landmark, Tractor } from 'lucide-react';
import type { Contract } from '@/types';
import { registerIcons } from '@/ui/iconRegistry';
import { brl } from '../catalog/money';
import { museumSlot } from './museum';

registerIcons({ Landmark, Tractor });

/** C00 — Sítio do Avô (tutorial). */
export const C00: Contract = {
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
  objective:
    'Levantamento planialtimétrico do sítio do avô para o inventário da família. É o primeiro setor do Museu.',
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
  museum: { wing: 'REAL', slot: museumSlot(2, 1), incomePerMinBRL: brl(10) },
  unlock: { type: 'ALWAYS' },
  overworldMarker: '0',
  dialogs: {
    briefing: [
      'Seu avô mediu essas cercas com teodolito e paciência.',
      'Agora é sua vez — e com um pombo, quem diria!',
      'Coloque uns alvos no chão antes de soltar o Atlas, viu?',
    ],
    success: [
      'Tá tudo aqui, tintim por tintim. Ele ia ficar orgulhoso.',
      'Guarde a caderneta dele. Ela é sua agora.',
    ],
    failure: ['Uai, faltou pedaço do sítio no mapa…', 'Tenta de novo, sem pressa.'],
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

/** C01 — Metrópole Vertical (T053). O prédio mais alto da AOI tem 90 m (`URBAN_VERTICAL`). */
export const C01: Contract = {
  id: 'C01',
  dimension: 'REAL',
  title: 'Metrópole Vertical',
  client: {
    name: 'Prefeito Dr. Aurélio Bastos',
    role: 'Prefeitura de Vila Nova',
    description: 'Prefeito de Vila Nova, às voltas com um cadastro de IPTU desatualizado.',
    portrait: {
      shape: 'SHIELD',
      icon: 'Landmark',
      primary: '#0ea5e9',
      secondary: '#0f172a',
      initials: 'AB',
    },
  },
  objective:
    'Atualização cadastral do IPTU com True-Ortho do centro, sem tombamento de arranha-céus.',
  biome: 'URBAN_VERTICAL',
  seed: 2002,
  aoi: { widthM: 240, lengthM: 360 },
  ceilingM: 120,
  terrainReliefM: 10,
  lightingOptions: ['SUN_HIGH', 'OVERCAST', 'GOLDEN_HOUR'],
  wind: { meanMs: 4, gustMs: 3, directionDeg: 90 },
  specialRules: ['URBAN_CANYON_RTK_LOSS'],
  requirements: [
    {
      id: 'C01-side',
      label: 'Sobreposição lateral ≥ 80 %',
      severity: 'CRITICAL',
      check: { type: 'MIN_SIDE_OVERLAP', value: 80 },
    },
    {
      id: 'C01-cov',
      label: 'Cobertura verde ≥ 80 %',
      severity: 'CRITICAL',
      check: { type: 'MIN_COVERAGE_GREEN', value: 0.8 },
    },
    {
      id: 'C01-pec',
      label: 'PEC-PCD classe A (1:1.000)',
      severity: 'CRITICAL',
      check: { type: 'ACCURACY_PEC', cls: 'A', scaleDenominator: 1000 },
    },
    {
      id: 'C01-p',
      label: 'Sobreposição longitudinal ≥ 80 %',
      severity: 'MAJOR',
      check: { type: 'MIN_FORWARD_OVERLAP', value: 80 },
    },
    {
      id: 'C01-gsd',
      label: 'GSD ≤ 3,5 cm',
      severity: 'MAJOR',
      check: { type: 'MAX_GSD_CM', value: 3.5 },
    },
    {
      id: 'C01-gcp',
      label: 'Ao menos 5 GCPs',
      severity: 'MAJOR',
      check: { type: 'MIN_GCP', value: 5 },
    },
    {
      id: 'C01-cp',
      label: 'Ao menos 2 pontos de checagem',
      severity: 'MINOR',
      check: { type: 'MIN_CP', value: 2 },
    },
  ],
  recommended: {
    aircraft: ['DRONE_T1'],
    sensors: ['CAM_20MP_RS'],
    vehicle: 'COMPACT_CAR',
    notes: 'Voe acima dos prédios mais altos (90 m)!',
  },
  minVehicle: 'FOOT_BIKE',
  basePaymentBRL: brl(12_000),
  xp: 400,
  reputationReward: 8,
  souvenirId: 'SV_CITY_KEY',
  museum: { wing: 'REAL', slot: museumSlot(1, 0), incomePerMinBRL: brl(40) },
  unlock: { type: 'CONTRACT_DONE', contractId: 'C00' },
  overworldMarker: '1',
  dialogs: {
    briefing: [
      'Metade dos prédios não existe no cadastro, e a outra metade aparece deitada no mapa velho!',
      'Quero True-Ortho: sobreposição lateral de 80 %, nada menos.',
      'E cuidado: o GPS enlouquece entre os arranha-céus.',
    ],
    success: ['Impecável! Cada telhado no lugar.', 'Leve a chave da cidade — simbólica, viu?'],
    failure: [
      'Com prédios tombados assim, não dá para cobrar IPTU de ninguém.',
      'A MegaMap disse que faria melhor…',
    ],
  },
  referencePlan: {
    aircraftId: 'DRONE_T1',
    sensorId: 'CAM_20MP_RS',
    heightM: 110,
    forwardOverlapPct: 80,
    sideOverlapPct: 82,
    speedMs: 10,
    modes: [],
    lighting: 'SUN_HIGH',
    gcps: [
      { u: 30, v: 30 },
      { u: 330, v: 30 },
      { u: 30, v: 210 },
      { u: 330, v: 210 },
      { u: 180, v: 120 },
    ],
    cps: [
      { u: 100, v: 80 },
      { u: 260, v: 160 },
    ],
    expected: { gsdCm: 3.02, nLines: 10, flightTimeS: 493.7 },
  },
};

/** Ordem da campanha (contracts-real). Os demais contratos entram nas tarefas de conteúdo. */
export const REAL_CONTRACTS: readonly Contract[] = [C00, C01];
