/**
 * Leituras do Laboratório (infographic-lab §5, REQ-LAB-005): todos os números saem das funções de
 * `@/domain` (`photogrammetry` e `stereo`); este módulo só monta as entradas e junta os
 * resultados. Nada aqui reescreve uma fórmula.
 */
import { getSensor } from '@/data/catalog';
import {
  footprint,
  gsd,
  horizontalFovRad,
  pecMaxScaleDenominator,
  pixelPitchM,
  realFocalM,
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
