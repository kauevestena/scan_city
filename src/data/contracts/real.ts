/** Campanha principal: contratos do Mundo Real (contracts-real). */
import { Anchor, Church, Landmark, Tractor } from 'lucide-react';
import type { Contract } from '@/types';
import { registerIcons } from '@/ui/iconRegistry';
import { brl } from '../catalog/money';
import { museumSlot } from './museum';

registerIcons({ Anchor, Church, Landmark, Tractor });

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

/** C05 — Centro Histórico Colonial (T054): fachadas e fios baixos (`COLONIAL_CENTER`). */
export const C05: Contract = {
  id: 'C05',
  dimension: 'REAL',
  title: 'Centro Histórico Colonial',
  client: {
    name: 'Arq.ª Helena Vasconcelos',
    role: 'Instituto do Patrimônio Histórico',
    description:
      'Arquiteta do Instituto do Patrimônio Histórico, às voltas com casarões de 250 anos.',
    portrait: {
      shape: 'DIAMOND',
      icon: 'Church',
      primary: '#3b82f6',
      secondary: '#f8fafc',
      initials: 'HV',
    },
  },
  objective: 'Modelo 3D de fachadas de casarões e da igreja matriz para o projeto de restauração.',
  biome: 'COLONIAL_CENTER',
  seed: 5005,
  aoi: { widthM: 150, lengthM: 150 },
  ceilingM: 120,
  terrainReliefM: 25,
  lightingOptions: ['OVERCAST', 'SUN_HIGH', 'GOLDEN_HOUR'],
  wind: { meanMs: 3, gustMs: 2, directionDeg: 45 },
  specialRules: ['LOW_WIRES'],
  requirements: [
    {
      id: 'C05-oblique',
      label: 'Voo oblíquo (câmera inclinada)',
      severity: 'CRITICAL',
      check: { type: 'FLIGHT_MODE', value: 'OBLIQUE' },
    },
    {
      id: 'C05-cov',
      label: 'Cobertura verde ≥ 85 %',
      severity: 'CRITICAL',
      check: { type: 'MIN_COVERAGE_GREEN', value: 0.85 },
    },
    {
      id: 'C05-pec',
      label: 'PEC-PCD classe A (1:500, eq. 0,5 m)',
      severity: 'CRITICAL',
      check: { type: 'ACCURACY_PEC', cls: 'A', scaleDenominator: 500, contourIntervalM: 0.5 },
    },
    {
      id: 'C05-grid',
      label: 'Voo em malha cruzada',
      severity: 'MAJOR',
      check: { type: 'FLIGHT_MODE', value: 'CROSS_GRID' },
    },
    {
      id: 'C05-gsd',
      label: 'GSD ≤ 1,5 cm',
      severity: 'MAJOR',
      check: { type: 'MAX_GSD_CM', value: 1.5 },
    },
    {
      id: 'C05-gcp',
      label: 'Ao menos 5 GCPs',
      severity: 'MAJOR',
      check: { type: 'MIN_GCP', value: 5 },
    },
    {
      id: 'C05-cp',
      label: 'Ao menos 3 pontos de checagem',
      severity: 'MINOR',
      check: { type: 'MIN_CP', value: 3 },
    },
  ],
  recommended: {
    aircraft: ['DRONE_T1', 'DRONE_T2'],
    sensors: ['CAM_20MP_RS', 'CAM_45MP_FF'],
    vehicle: 'COMPACT_CAR',
    notes: 'Fiação a 8–14 m: mantenha o AGL acima de 20 m.',
  },
  minVehicle: 'FOOT_BIKE',
  basePaymentBRL: brl(18_000),
  xp: 600,
  reputationReward: 10,
  souvenirId: 'SV_TILE',
  museum: { wing: 'REAL', slot: museumSlot(1, 1), incomePerMinBRL: brl(60) },
  unlock: { type: 'CONTRACT_DONE', contractId: 'C01' },
  overworldMarker: '5',
  dialogs: {
    briefing: [
      'Esses casarões têm 250 anos e fachadas que nenhum mapa vertical enxerga.',
      'Preciso de câmera inclinada e voo em malha cruzada.',
      'E pelo amor de Deus, não encoste na fiação!',
    ],
    success: ['Cada azulejo, cada cornija. Vamos restaurar com precisão milimétrica.'],
    failure: ['As fachadas ficaram borradas e deformadas. O patrimônio merece mais.'],
  },
  referencePlan: {
    aircraftId: 'DRONE_T1',
    sensorId: 'CAM_20MP_RS',
    heightM: 50,
    forwardOverlapPct: 75,
    sideOverlapPct: 65,
    speedMs: 6,
    modes: ['OBLIQUE', 'CROSS_GRID'],
    obliqueDeg: 45,
    lighting: 'OVERCAST',
    gcps: [
      { u: 15, v: 15 },
      { u: 135, v: 15 },
      { u: 15, v: 135 },
      { u: 135, v: 135 },
      { u: 75, v: 75 },
    ],
    cps: [
      { u: 45, v: 105 },
      { u: 105, v: 45 },
      { u: 75, v: 20 },
    ],
    expected: { gsdCm: 1.37, nLines: 14, flightTimeS: 605.9 },
  },
};

/** C06 — Zona Costeira e Estuário (T055): água, vento cruzado forte (`COASTAL_ESTUARY`). */
export const C06: Contract = {
  id: 'C06',
  dimension: 'REAL',
  title: 'Zona Costeira e Estuário',
  client: {
    name: 'Comandante Iara Moreira',
    role: 'Agência Marítima',
    description: 'Comandante da Agência Marítima, de olho na erosão da costa.',
    portrait: {
      shape: 'CIRCLE',
      icon: 'Anchor',
      primary: '#0891b2',
      secondary: '#f8fafc',
      initials: 'IM',
    },
  },
  objective: 'Monitoramento da erosão costeira e do assoreamento do estuário.',
  biome: 'COASTAL_ESTUARY',
  seed: 6006,
  aoi: { widthM: 300, lengthM: 800 },
  ceilingM: 120,
  terrainReliefM: 20,
  lightingOptions: ['SUN_HIGH', 'OVERCAST', 'GOLDEN_HOUR'],
  wind: { meanMs: 9, gustMs: 4, directionDeg: 90 },
  specialRules: ['SPECULAR_WATER', 'STRONG_WIND'],
  requirements: [
    {
      id: 'C06-tier',
      label: 'Aeronave de nível ≥ 2',
      severity: 'CRITICAL',
      check: { type: 'MIN_AIRCRAFT_TIER', value: 2 },
    },
    {
      id: 'C06-cov',
      label: 'Cobertura verde ≥ 80 %',
      severity: 'CRITICAL',
      check: { type: 'MIN_COVERAGE_GREEN', value: 0.8 },
    },
    {
      id: 'C06-asprs',
      label: 'ASPRS: 7 cm (H) e 10 cm (V)',
      severity: 'CRITICAL',
      check: { type: 'ACCURACY_ASPRS', horizontalCm: 7, verticalCm: 10 },
    },
    {
      id: 'C06-gsd',
      label: 'GSD ≤ 3 cm',
      severity: 'MAJOR',
      check: { type: 'MAX_GSD_CM', value: 3 },
    },
    {
      id: 'C06-gcp',
      label: 'Ao menos 5 GCPs',
      severity: 'MAJOR',
      check: { type: 'MIN_GCP', value: 5 },
    },
    {
      id: 'C06-cp',
      label: 'Ao menos 3 pontos de checagem',
      severity: 'MINOR',
      check: { type: 'MIN_CP', value: 3 },
    },
  ],
  recommended: {
    aircraft: ['DRONE_T2'],
    sensors: ['CAM_45MP_FF'],
    vehicle: 'FOOT_BIKE',
    notes: 'Água não tem tie points: GCPs só na faixa de areia.',
  },
  minVehicle: 'FOOT_BIKE',
  basePaymentBRL: brl(22_000),
  xp: 700,
  reputationReward: 10,
  souvenirId: 'SV_BOTTLE_MAP',
  museum: { wing: 'REAL', slot: museumSlot(3, 0), incomePerMinBRL: brl(70) },
  unlock: {
    type: 'ALL',
    of: [
      { type: 'CONTRACT_DONE', contractId: 'C01' },
      { type: 'REPUTATION', min: 40 },
    ],
  },
  overworldMarker: '6',
  dialogs: {
    briefing: [
      'O mar avança dois metros por ano aqui.',
      'Vento cruzado forte — seu drone aguenta?',
      'E água espelhada não serve para fotogrametria: escolha bem a hora do voo.',
    ],
    success: [
      'Agora temos a linha de costa com precisão de centímetros. Bom trabalho, marinheiro.',
    ],
    failure: ['Metade do mapa é reflexo de sol. Isso não mede erosão nenhuma.'],
  },
  referencePlan: {
    aircraftId: 'DRONE_T2',
    sensorId: 'CAM_45MP_FF',
    lensId: 'LENS_24',
    heightM: 110,
    forwardOverlapPct: 75,
    sideOverlapPct: 65,
    speedMs: 12,
    modes: [],
    lighting: 'OVERCAST',
    gcps: [
      { u: 40, v: 40 },
      { u: 760, v: 40 },
      { u: 40, v: 140 },
      { u: 760, v: 140 },
      { u: 400, v: 90 },
    ],
    cps: [
      { u: 200, v: 70 },
      { u: 600, v: 110 },
      { u: 400, v: 30 },
    ],
    expected: { gsdCm: 2.01, nLines: 7, flightTimeS: 568.5 },
  },
};

/** Ordem da campanha (contracts-real). Os demais contratos entram nas tarefas de conteúdo. */
export const REAL_CONTRACTS: readonly Contract[] = [C00, C01, C05, C06];
