/**
 * Fendas Dimensionais (contracts-rifts): os 11 side-quests R01–R11, um por tarefa T060–T070.
 * Paródias com nomes e descrições originais; nada aqui reproduz personagem, marca ou layout de
 * obra existente (constitution §6, guardado por `npm run check:terms`).
 */
import { Bike, Wrench, Zap } from 'lucide-react';
import type { Contract } from '@/types';
import { registerIcons } from '@/ui/iconRegistry';
import { brl } from '../catalog/money';

registerIcons({ Bike, Wrench, Zap });

/** R01 — Colinas Verdes dos Espinhos (T060): arcos de pedra, anéis dourados e o Atlas imune. */
export const R01: Contract = {
  id: 'R01',
  dimension: 'RIFT',
  title: 'Colinas Verdes dos Espinhos',
  client: {
    name: 'Sonisvaldo',
    role: 'Ouriço hiperativo',
    description: 'Ouriço marrom de tênis vermelhos gastos que fala rápido demais.',
    portrait: {
      shape: 'CIRCLE',
      icon: 'Zap',
      primary: '#2563eb',
      secondary: '#ef4444',
      initials: 'SV',
    },
  },
  objective:
    'Ortofoto da pista com GSD abaixo de 3 cm para achar os buracos antes que um cientista bigodudo construa fábricas de robôs.',
  biome: 'RIFT_GREEN_HILLS',
  seed: 9101,
  aoi: { widthM: 200, lengthM: 400 },
  ceilingM: 100,
  terrainReliefM: 35,
  lightingOptions: ['SUN_HIGH'],
  wind: { meanMs: 3, gustMs: 2, directionDeg: 90 },
  specialRules: ['EM_INTERFERENCE', 'COLLECTIBLE_RINGS'],
  requirements: [
    {
      id: 'R01-gsd',
      label: 'GSD ≤ 3 cm',
      severity: 'CRITICAL',
      check: { type: 'MAX_GSD_CM', value: 3 },
    },
    {
      id: 'R01-cov',
      label: 'Cobertura verde ≥ 80 %',
      severity: 'CRITICAL',
      check: { type: 'MIN_COVERAGE_GREEN', value: 0.8 },
    },
    {
      id: 'R01-gcp',
      label: 'Ao menos 4 GCPs',
      severity: 'MAJOR',
      check: { type: 'MIN_GCP', value: 4 },
    },
    {
      id: 'R01-pec',
      label: 'PEC-PCD classe B (1:1.000)',
      severity: 'MAJOR',
      check: { type: 'ACCURACY_PEC', cls: 'B', scaleDenominator: 1000 },
    },
  ],
  // O Atlas é imune à interferência e voa mais devagar, mas dá conta da pista.
  recommended: {
    aircraft: ['ATLAS', 'DRONE_T1'],
    sensors: ['CAM_PIGEON', 'CAM_20MP_RS'],
    vehicle: 'FOOT_BIKE',
    notes: '',
  },
  minVehicle: 'FOOT_BIKE',
  basePaymentBRL: brl(25_000),
  xp: 500,
  reputationReward: 5,
  souvenirId: 'SV_GOLD_RING',
  museum: { wing: 'RIFT', slot: 0, incomePerMinBRL: brl(80) },
  unlock: { type: 'CONTRACT_DONE', contractId: 'C01' },
  overworldMarker: 'a',
  dialogs: {
    briefing: [
      'E aí, agrimensor! Rápido, rápido, rápido!',
      'Tem buraco na pista e um doutor de bigode quer asfaltar tudo com fábrica de robô!',
      'Preciso de 3 cm de GSD — nem um pixel a mais!',
    ],
    success: ['UAU! Mapa mais rápido que eu! Fica com um anel, tenho uns mil.'],
    failure: ['Muito lento, muito borrado! Tenta de novo — mais rápido!'],
  },
  referencePlan: {
    aircraftId: 'ATLAS',
    sensorId: 'CAM_PIGEON',
    heightM: 55,
    forwardOverlapPct: 70,
    sideOverlapPct: 60,
    speedMs: 9,
    modes: [],
    lighting: 'SUN_HIGH',
    gcps: [
      { u: 30, v: 30 },
      { u: 370, v: 30 },
      { u: 30, v: 170 },
      { u: 370, v: 170 },
      { u: 200, v: 100 },
    ],
    cps: [],
    expected: { gsdCm: 2.31, nLines: 8, flightTimeS: 473.4 },
  },
};

/** R02 — Reino dos Encanamentos (T061): canos gigantes, plataformas flutuantes e cascos que oscilam. */
export const R02: Contract = {
  id: 'R02',
  dimension: 'RIFT',
  title: 'Reino dos Encanamentos',
  client: {
    name: 'Seu Márcio Bross',
    role: 'Encanador aposentado',
    description: 'Encanador aposentado e gordinho, de macacão azul e boné com a letra "M" bordada.',
    portrait: {
      shape: 'CIRCLE',
      icon: 'Wrench',
      primary: '#dc2626',
      secondary: '#1d4ed8',
      initials: 'MB',
    },
  },
  objective:
    'Cadastro planialtimétrico de bueiros contra infestações de tartarugas voadoras e plantas carnívoras.',
  biome: 'RIFT_PIPES',
  seed: 9202,
  aoi: { widthM: 240, lengthM: 300 },
  ceilingM: 120,
  terrainReliefM: 20,
  lightingOptions: ['SUN_HIGH', 'OVERCAST'],
  wind: { meanMs: 2, gustMs: 1, directionDeg: 0 },
  specialRules: ['EM_INTERFERENCE', 'MOVING_HAZARDS'],
  requirements: [
    {
      id: 'R02-pec',
      label: 'PEC-PCD classe A (1:1.000, eq. 1 m)',
      severity: 'CRITICAL',
      check: { type: 'ACCURACY_PEC', cls: 'A', scaleDenominator: 1000, contourIntervalM: 1 },
    },
    {
      id: 'R02-cov',
      label: 'Cobertura verde ≥ 80 %',
      severity: 'CRITICAL',
      check: { type: 'MIN_COVERAGE_GREEN', value: 0.8 },
    },
    {
      id: 'R02-gsd',
      label: 'GSD ≤ 3 cm',
      severity: 'MAJOR',
      check: { type: 'MAX_GSD_CM', value: 3 },
    },
    {
      id: 'R02-gcp',
      label: 'Ao menos 5 GCPs',
      severity: 'MAJOR',
      check: { type: 'MIN_GCP', value: 5 },
    },
    {
      id: 'R02-cp',
      label: 'Ao menos 2 pontos de checagem',
      severity: 'MINOR',
      check: { type: 'MIN_CP', value: 2 },
    },
  ],
  recommended: {
    aircraft: ['DRONE_T1', 'ATLAS'],
    sensors: ['CAM_20MP_RS', 'CAM_PIGEON'],
    vehicle: 'FOOT_BIKE',
    notes: '',
  },
  minVehicle: 'FOOT_BIKE',
  basePaymentBRL: brl(30_000),
  xp: 600,
  reputationReward: 5,
  souvenirId: 'SV_GREEN_PIPE',
  museum: { wing: 'RIFT', slot: 1, incomePerMinBRL: brl(90) },
  unlock: { type: 'CONTRACT_DONE', contractId: 'C01' },
  overworldMarker: 'b',
  dialogs: {
    briefing: [
      'Mamma… quer dizer, minha nossa! Os bueiros tão tudo entupido de casco!',
      'Preciso da cota de cada tampa, classe A!',
      'Cuidado com os canos — alguns são bem altos.',
    ],
    success: ['Uhuu! Agora sei onde cada cano vai dar. Leva um de lembrança!'],
    failure: ['Ih, rapaz… esse mapa tá mais torto que cano velho.'],
  },
  referencePlan: {
    aircraftId: 'DRONE_T1',
    sensorId: 'CAM_20MP_RS',
    heightM: 100,
    forwardOverlapPct: 75,
    sideOverlapPct: 70,
    speedMs: 8,
    modes: [],
    lighting: 'OVERCAST',
    gcps: [
      { u: 30, v: 30 },
      { u: 270, v: 30 },
      { u: 30, v: 210 },
      { u: 270, v: 210 },
      { u: 150, v: 120 },
    ],
    cps: [
      { u: 90, v: 80 },
      { u: 210, v: 160 },
    ],
    expected: { gsdCm: 2.74, nLines: 7, flightTimeS: 386.8 },
  },
};

/** R08 — Bairro dos Santos (T062): vielas de 4–6 m, casas coladas e fiação baixa. */
export const R08: Contract = {
  id: 'R08',
  dimension: 'RIFT',
  title: 'Bairro dos Santos',
  client: {
    name: 'Carlinhos Joilson (CJ)',
    role: 'Morador do bairro',
    description:
      'Rapaz de regata branca e bicicleta BMX que reclama de ter de mapear tudo de novo.',
    portrait: {
      shape: 'CIRCLE',
      icon: 'Bike',
      primary: '#16a34a',
      secondary: '#f8fafc',
      initials: 'CJ',
    },
  },
  objective: 'Regularização Fundiária Urbana (REURB) de vielas e becos.',
  biome: 'RIFT_SANTOS_HOOD',
  seed: 9808,
  aoi: { widthM: 240, lengthM: 300 },
  ceilingM: 120,
  terrainReliefM: 20,
  lightingOptions: ['SUN_HIGH', 'GOLDEN_HOUR', 'OVERCAST'],
  wind: { meanMs: 3, gustMs: 2, directionDeg: 0 },
  specialRules: ['EM_INTERFERENCE', 'LOW_WIRES'],
  requirements: [
    {
      id: 'R08-pec',
      label: 'PEC-PCD classe A (1:1.000)',
      severity: 'CRITICAL',
      check: { type: 'ACCURACY_PEC', cls: 'A', scaleDenominator: 1000 },
    },
    {
      id: 'R08-cov',
      label: 'Cobertura verde ≥ 85 %',
      severity: 'CRITICAL',
      check: { type: 'MIN_COVERAGE_GREEN', value: 0.85 },
    },
    {
      id: 'R08-gsd',
      label: 'GSD ≤ 2 cm',
      severity: 'MAJOR',
      check: { type: 'MAX_GSD_CM', value: 2 },
    },
    {
      id: 'R08-fwd',
      label: 'Sobreposição longitudinal ≥ 80 %',
      severity: 'MAJOR',
      check: { type: 'MIN_FORWARD_OVERLAP', value: 80 },
    },
    {
      id: 'R08-side',
      label: 'Sobreposição lateral ≥ 70 %',
      severity: 'MAJOR',
      check: { type: 'MIN_SIDE_OVERLAP', value: 70 },
    },
    {
      id: 'R08-gcp',
      label: 'Ao menos 5 GCPs',
      severity: 'MAJOR',
      check: { type: 'MIN_GCP', value: 5 },
    },
    {
      id: 'R08-cp',
      label: 'Ao menos 3 pontos de checagem',
      severity: 'MINOR',
      check: { type: 'MIN_CP', value: 3 },
    },
  ],
  recommended: {
    aircraft: ['DRONE_T2'],
    sensors: ['CAM_45MP_FF'],
    vehicle: 'FOOT_BIKE',
    notes:
      'Lente de 35 mm. O relevo estreita a faixa nos morros: dê folga ao q. Fios a 8–14 m: mantenha o AGL acima de 20 m.',
  },
  minVehicle: 'FOOT_BIKE',
  basePaymentBRL: brl(28_000),
  xp: 700,
  reputationReward: 5,
  souvenirId: 'SV_BMX',
  museum: { wing: 'RIFT', slot: 7, incomePerMinBRL: brl(85) },
  unlock: { type: 'CONTRACT_DONE', contractId: 'C05' },
  overworldMarker: 'h',
  dialogs: {
    briefing: [
      'Ah droga, lá vou eu mapear de novo.',
      'A prefeitura quer regularizar o bairro todo, cada viela, cada laje.',
      'E cuidado com os fios, mano.',
    ],
    success: ['Respeito. Agora a família tem escritura. Fica com essa BMX de miniatura.'],
    failure: ['Tudo que a gente tinha que fazer era seguir o maldito plano de voo!'],
  },
  referencePlan: {
    aircraftId: 'DRONE_T2',
    sensorId: 'CAM_45MP_FF',
    lensId: 'LENS_35',
    heightM: 80,
    forwardOverlapPct: 80,
    sideOverlapPct: 70,
    speedMs: 8,
    modes: [],
    lighting: 'SUN_HIGH',
    gcps: [
      { u: 20, v: 20 },
      { u: 280, v: 20 },
      { u: 20, v: 220 },
      { u: 280, v: 220 },
      { u: 150, v: 120 },
    ],
    cps: [
      { u: 80, v: 60 },
      { u: 220, v: 180 },
      { u: 150, v: 30 },
    ],
    expected: { gsdCm: 1.0, nLines: 11, flightTimeS: 575.8 },
  },
};

/** Fendas do catálogo, na ordem das tarefas (T060–T070). */
export const RIFT_CONTRACTS: readonly Contract[] = [R01, R02, R08];
