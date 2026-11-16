/**
 * Leituras do Laboratório (infographic-lab §5, REQ-LAB-005): todos os números saem das funções de
 * `@/domain` (`photogrammetry` e `stereo`); este módulo só monta as entradas e junta os
 * resultados. Nada aqui reescreve uma fórmula.
 */
import { getPayload, getSensor } from '@/data/catalog';
import { accuracyMultipliers, type AccuracyContext } from '@/domain/accuracy';
import {
  groundDensity,
  groundReturnProbability,
  isDtmReliable,
  lidarDensity,
  lidarSwathM,
  photoGroundVisibility,
} from '@/domain/lidar';
import {
  footprint,
  gsd,
  horizontalFovRad,
  pecMaxScaleDenominator,
  pixelPitchM,
  realFocalM,
  rollingShutterShearRad,
  rollingShutterSkewPx,
} from '@/domain/photogrammetry';
import {
  baseHeightClass,
  baseHeightRatio,
  depthPrecisionM,
  heightFromParallax,
  parallaxDiffM,
  photoBaseM,
  type BaseHeightClass,
} from '@/domain/stereo';
import { SHUTTER_ROWS } from '@/engines/lab/rollingShutter';
import { degToRad, radToDeg } from '@/lib/math';
import type { CameraSensor } from '@/types';

// --- Óptica & GSD ---------------------------------------------------------------------------

/** Entradas dos sliders do painel de óptica (unidades dos sliders). */
export interface OpticsInput {
  heightM: number;
  focalMm: number;
  pixelUm: number;
  sensorWidthMm: number;
}

export interface OpticsReadings {
  gsdM: number;
  footprintWidthM: number;
  footprintHeightM: number;
  /** Ângulo de visão horizontal, rad e graus. */
  fovRad: number;
  fovDeg: number;
  /** Denominador da escala máxima pela regra prática de PEC-PCD A. */
  pecScale: number;
}

/** Câmera do laboratório: o sensor dos sliders (proporção 3:2) com a focal fixa. */
export function labSensor(input: OpticsInput): CameraSensor {
  const heightMm = (input.sensorWidthMm * 2) / 3;
  const widthPx = (input.sensorWidthMm * 1000) / input.pixelUm;
  return {
    id: 'LAB',
    name: 'Laboratório',
    kind: 'RGB',
    sensorWidthMm: input.sensorWidthMm,
    sensorHeightMm: heightMm,
    imageWidthPx: widthPx,
    imageHeightPx: (widthPx * 2) / 3,
    shutter: 'GLOBAL',
    cropFactor: 1,
    lensMount: 'FIXED',
    fixedFocalMm: input.focalMm,
    qualityPenalty: 1,
    priceBRL: 0,
    compatibleAircraft: [],
    description: '',
  };
}

export function opticsReadings(input: OpticsInput): OpticsReadings {
  const sensor = labSensor(input);
  const focalM = realFocalM(sensor);
  const pitchM = pixelPitchM(sensor);
  const fp = footprint(
    input.heightM,
    sensor.sensorWidthMm / 1000,
    sensor.sensorHeightMm / 1000,
    focalM,
  );
  const gsdM = gsd(input.heightM, pitchM, focalM);
  const fovRad = horizontalFovRad(sensor, focalM);
  return {
    gsdM,
    footprintWidthM: fp.widthM,
    footprintHeightM: fp.heightM,
    fovRad,
    fovDeg: (fovRad * 180) / Math.PI,
    pecScale: pecMaxScaleDenominator(gsdM),
  };
}

// --- Estereoscopia & Paralaxe ----------------------------------------------------------------

/** Entradas dos sliders do painel de estereoscopia. */
export interface StereoInput {
  baseM: number;
  heightM: number;
  objectM: number;
  focalMm: number;
  /** Erro de correlação das imagens, em pixels. */
  sigmaPx: number;
}

export interface StereoReadings {
  /** Base fotográfica b e paralaxe diferencial Δp, em m. */
  photoBaseM: number;
  parallaxDiffM: number;
  /** h recuperado de b e Δp (deve bater com o slider). */
  reconstructedM: number;
  ratio: number;
  ratioClass: BaseHeightClass;
  /** Precisão em profundidade σ_Z, em m. */
  depthPrecisionM: number;
}

/** Os planos-imagem do painel usam o pixel da câmera de 45 MP full frame (4,38 µm). */
export function stereoPixelPitchM(): number {
  return pixelPitchM(getSensor('CAM_45MP_FF'));
}

/** O prédio nunca passa de 0,8·H: divisão por quase zero em Δp (infographic-lab §7). */
export const MAX_OBJECT_FRACTION = 0.8;

export function stereoReadings(input: StereoInput): StereoReadings {
  const focalM = input.focalMm / 1000;
  const b = photoBaseM(input.baseM, focalM, input.heightM);
  const dp = parallaxDiffM(input.baseM, focalM, input.heightM, input.objectM);
  const ratio = baseHeightRatio(input.baseM, input.heightM);
  return {
    photoBaseM: b,
    parallaxDiffM: dp,
    reconstructedM: heightFromParallax(input.heightM, b, dp),
    ratio,
    ratioClass: baseHeightClass(ratio),
    depthPrecisionM: depthPrecisionM(
      input.heightM,
      input.baseM,
      focalM,
      input.sigmaPx * stereoPixelPitchM(),
    ),
  };
}

// --- LiDAR vs. fotogrametria no dossel --------------------------------------------------------

/** Entradas dos sliders do painel de dossel (o FOV é fixo, o do Pod LiDAR). */
export interface CanopyInput {
  /** Cobertura do dossel, em %. */
  canopyPct: number;
  maxReturns: number;
  prrKHz: number;
  heightM: number;
  speedMs: number;
}

export interface CanopyReadings {
  swathM: number;
  /** Densidade de pontos por passada (pts/m²). */
  densityPtsM2: number;
  /** P_solo: probabilidade de um pulso chegar ao solo, com a cobertura atual. */
  groundProbability: number;
  /** A mesma probabilidade sob dossel fechado (c = 1): só o que atravessa as copas. */
  closedGroundProbability: number;
  groundDensityPtsM2: number;
  /** Fração do solo visível em duas fotos, (1 − c)². */
  photoVisibility: number;
  /** Veredito: o MDT é confiável com ≥ 4 pts/m² de solo. */
  reliable: boolean;
}

/** FOV fixo do painel: o do Pod LiDAR (70°). */
export const LIDAR_FOV_DEG = getPayload('POD_LIDAR').fovDeg;

export function lidarFovRad(): number {
  return degToRad(LIDAR_FOV_DEG);
}

export function canopyReadings(input: CanopyInput): CanopyReadings {
  const fov = lidarFovRad();
  const c = input.canopyPct / 100;
  const density = lidarDensity(input.prrKHz * 1000, input.speedMs, input.heightM, fov);
  const ground = groundDensity(density, c, input.maxReturns);
  return {
    swathM: lidarSwathM(input.heightM, fov),
    densityPtsM2: density,
    groundProbability: groundReturnProbability(c, input.maxReturns),
    closedGroundProbability: groundReturnProbability(1, input.maxReturns),
    groundDensityPtsM2: ground,
    photoVisibility: photoGroundVisibility(c),
    reliable: isDtmReliable(ground),
  };
}

// --- Global shutter vs. rolling shutter -------------------------------------------------------

/** Entradas dos sliders do painel de shutter. */
export interface ShutterInput {
  speedMs: number;
  readoutMs: number;
  /** Taxa de giro da câmera, em °/s. */
  spinDegS: number;
  gsdCm: number;
  /** Sensor global: lê todas as linhas no mesmo instante. */
  global: boolean;
}

export interface ShutterReadings {
  /** Cisalhamento da imagem, em px (0 no sensor global). */
  skewPx: number;
  shearRad: number;
  shearDeg: number;
  /** Altura da imagem de demonstração no solo (m). */
  groundHeightM: number;
  /** Multiplicador de RMSE do jogo sem RTK (φ = 0) e com RTK (φ = 1). */
  rmseNoRtk: number;
  rmseRtk: number;
}

/** Contexto neutro de §6.3: só o rolling shutter pesa; o resto não altera o multiplicador. */
function shutterAccuracyContext(skewPx: number, global: boolean, phi: number): AccuracyContext {
  return {
    gcpCount: 5,
    phi,
    hullCoverage: 1,
    collinearity: 1,
    rollingShutter: !global,
    meanSkewPx: skewPx,
    rgbPhotos: true,
    lighting: 'SUN_HIGH',
    homogeneousTexture: false,
    forwardOverlapPct: 80,
    specularWater: false,
    meanCount: 6,
    redFraction: 0,
    blurFraction: 0,
    emInterference: false,
    emImmune: false,
    cameraPenalty: 1,
    atlasCalibrated: false,
    imuScore: 0,
    mods: { rmseGlobal: 1, texturePenalty: 1, rollingShutterPenalty: 1 },
  };
}

/** O multiplicador de RMSE do rolling shutter que o jogo aplicaria (1 quando não há). */
function rollingMultiplier(skewPx: number, global: boolean, phi: number): number {
  const entry = accuracyMultipliers(shutterAccuracyContext(skewPx, global, phi)).find(
    (m) => m.key === 'rollingShutter',
  );
  return entry?.xy ?? 1;
}

export function shutterReadings(input: ShutterInput): ShutterReadings {
  const gsdM = input.gsdCm / 100;
  const skewPx = rollingShutterSkewPx(
    input.speedMs,
    input.global ? undefined : input.readoutMs / 1000,
    gsdM,
  );
  const groundHeightM = SHUTTER_ROWS * gsdM;
  const shearRad = rollingShutterShearRad(skewPx, gsdM, groundHeightM);
  return {
    skewPx,
    shearRad,
    shearDeg: radToDeg(shearRad),
    groundHeightM,
    rmseNoRtk: rollingMultiplier(skewPx, input.global, 0),
    rmseRtk: rollingMultiplier(skewPx, input.global, 1),
  };
}
