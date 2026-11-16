/**
 * Fotogrametria — domain-math §1 e §2. Funções puras, entradas e saídas em SI;
 * percentuais de sobreposição de 0 a 100. Única implementação destas fórmulas
 * (constitution §2.6): planejamento, voo, relatório e laboratório reusam daqui.
 */
import type { Aircraft, CameraSensor, Lens, LightingId } from '@/types';

const DEG = Math.PI / 180;

// --- §1 Geometria do sensor --------------------------------------------------

/** Tamanho do pixel no sensor (m). */
export function pixelPitchM(sensor: CameraSensor): number {
  return sensor.sensorWidthMm / sensor.imageWidthPx / 1000;
}

/** Focal real (m): fixa, ou `equivalente / crop` para lentes intercambiáveis (ADR-005). */
export function realFocalM(sensor: CameraSensor, lens?: Lens): number {
  if (sensor.lensMount === 'FIXED') return (sensor.fixedFocalMm as number) / 1000;
  if (!lens) throw new RangeError(`A câmera ${sensor.id} exige uma lente`);
  return lens.equivFocalMm / sensor.cropFactor / 1000;
}

/** FOV ao longo do voo (lado curto do sensor). */
export function verticalFovRad(sensor: CameraSensor, focalM: number): number {
  return 2 * Math.atan(sensor.sensorHeightMm / 1000 / (2 * focalM));
}

/** FOV transversal ao voo (lado largo do sensor). */
export function horizontalFovRad(sensor: CameraSensor, focalM: number): number {
  return 2 * Math.atan(sensor.sensorWidthMm / 1000 / (2 * focalM));
}

// --- §2.1–2.5 ----------------------------------------------------------------

/** Ground Sampling Distance (m/px). */
export function gsd(heightM: number, pixelPitchM: number, focalM: number): number {
  return (heightM * pixelPitchM) / focalM;
}

/** Pegada de uma foto no solo: `widthM` transversal e `heightM` ao longo do voo. */
export function footprint(
  heightM: number,
  sensorWidthM: number,
  sensorHeightM: number,
  focalM: number,
): { widthM: number; heightM: number } {
  return { widthM: (heightM * sensorWidthM) / focalM, heightM: (heightM * sensorHeightM) / focalM };
}

/**
 * Regra prática exibida no Laboratório (heurística, não norma): o denominador da escala mais
 * detalhada que o GSD sustenta com PEC-PCD classe A, 1 : (GSD · 4000), com o GSD em metros.
 */
export function pecMaxScaleDenominator(gsdM: number): number {
  return gsdM * 4000;
}

/** Base aérea: distância entre disparos consecutivos. */
export function airBase(footprintHeightM: number, forwardOverlapPct: number): number {
  return footprintHeightM * (1 - forwardOverlapPct / 100);
}

/** Espaçamento entre linhas de voo. */
export function lineSpacing(footprintWidthM: number, sideOverlapPct: number): number {
  return footprintWidthM * (1 - sideOverlapPct / 100);
}

/** Intervalo de disparo Δt = B/v (ADR-004: disparo por tempo). */
export function shotInterval(baseM: number, speedMs: number): number {
  return baseM / speedMs;
}

// --- §2.6 Linhas, fotos e tempo de voo ----------------------------------------

/** Número de linhas: `ceil(across / S) + 1`, no mínimo 2. */
export function planLineCount(acrossM: number, spacingM: number): number {
  return Math.max(2, Math.ceil(acrossM / spacingM) + 1);
}

/** Posições transversais das linhas, centradas na AOI. */
export function linePositions(acrossM: number, spacingM: number, n: number): number[] {
  const v0 = (acrossM - (n - 1) * spacingM) / 2;
  return Array.from({ length: n }, (_, k) => v0 + k * spacingM);
}

/** Fotos por linha: a janela da câmera cobre a AOI ± 1 base. */
export function photosPerLine(alongM: number, baseM: number): number {
  return Math.floor(alongM / baseM) + 3;
}

/** Trecho de entrada e saída de cada linha (lead-in/out). */
export function leadM(aircraft: Pick<Aircraft, 'turnRadiusM'>): number {
  return Math.max(30, aircraft.turnRadiusM);
}

/** Tempo de curva entre linhas: pivô (+3 s) ou curva em gota de raio R. */
export function turnTimeS(
  aircraft: Pick<Aircraft, 'turnRadiusM'>,
  spacingM: number,
  speedMs: number,
): number {
  const r = aircraft.turnRadiusM;
  if (r === 0) return spacingM / speedMs + 3;
  return (Math.PI * r + Math.abs(spacingM - 2 * r)) / speedMs;
}

/** Tempo total: linhas + curvas + 20 s de decolagem e pouso. */
export function flightTimeS(
  nLines: number,
  lineLengthM: number,
  speedMs: number,
  turnS: number,
): number {
  return (nLines * lineLengthM) / speedMs + (nLines - 1) * turnS + 20;
}

/** Baterias necessárias, com reserva de 20 %. */
export function batteriesNeeded(flightS: number, enduranceS: number): number {
  return Math.ceil(flightS / (0.8 * enduranceS));
}

// --- §2.7 Exposição, motion blur e rolling shutter ------------------------------

export type ShadowType = 'SHORT' | 'LONG' | 'DIFFUSE';

export interface LightingSpec {
  exposureS: number;
  /** `null` = luz difusa, sem sol direto. */
  sunElevationDeg: number | null;
  shadow: ShadowType;
}

export const LIGHTING: Readonly<Record<LightingId, LightingSpec>> = {
  SUN_HIGH: { exposureS: 1 / 2000, sunElevationDeg: 70, shadow: 'SHORT' },
  OVERCAST: { exposureS: 1 / 800, sunElevationDeg: null, shadow: 'DIFFUSE' },
  GOLDEN_HOUR: { exposureS: 1 / 250, sunElevationDeg: 8, shadow: 'LONG' },
  BLIZZARD: { exposureS: 1 / 500, sunElevationDeg: null, shadow: 'DIFFUSE' },
  MAGIC_FOG: { exposureS: 1 / 400, sunElevationDeg: null, shadow: 'DIFFUSE' },
};

export function exposureTimeS(lighting: LightingId): number {
  return LIGHTING[lighting].exposureS;
}

/** Arrasto durante a exposição, em pixels: v · t_exp / GSD. */
export function motionBlurPx(speedMs: number, exposureS: number, gsdM: number): number {
  return (speedMs * exposureS) / gsdM;
}

/** Cisalhamento do rolling shutter, em pixels: v · t_readout / GSD (0 sem leitura por linha). */
export function rollingShutterSkewPx(
  speedMs: number,
  readoutS: number | undefined,
  gsdM: number,
): number {
  return readoutS ? (speedMs * readoutS) / gsdM : 0;
}

export type BlurClass = 'OK' | 'WARN' | 'BLURRED';

export function blurClass(px: number): BlurClass {
  if (px < 0.5) return 'OK';
  return px <= 1 ? 'WARN' : 'BLURRED';
}

// --- §2.8 Pegada oblíqua --------------------------------------------------------

const MAX_FAR_ANGLE_RAD = 85 * DEG;

export interface ObliqueFootprint {
  /** Distância horizontal à frente da aeronave até a borda próxima (negativa = atrás). */
  nearM: number;
  farM: number;
  lengthM: number;
  centerOffsetM: number;
  /** Largura no centro da pegada. */
  widthCenterM: number;
}

/** Pegada com câmera inclinada θ a partir do nadir; `θ + α_v/2` limitado a 85°. */
export function obliqueFootprint(
  heightM: number,
  tiltRad: number,
  sensorWidthM: number,
  focalM: number,
  vFovRad: number,
): ObliqueFootprint {
  const nearM = heightM * Math.tan(tiltRad - vFovRad / 2);
  const farM = heightM * Math.tan(Math.min(tiltRad + vFovRad / 2, MAX_FAR_ANGLE_RAD));
  return {
    nearM,
    farM,
    lengthM: farM - nearM,
    centerOffsetM: (nearM + farM) / 2,
    widthCenterM: (heightM / Math.cos(tiltRad)) * (sensorWidthM / focalM),
  };
}

/** GSD no centro da foto oblíqua. */
export function obliqueGsdM(gsdNadirM: number, tiltRad: number): number {
  return gsdNadirM / Math.cos(tiltRad) ** 2;
}

// --- §2.9 Sobreposição real em voo ------------------------------------------------

/** Fração de sobreposição longitudinal entre dois disparos (negativa = buraco). */
export function realForwardOverlap(distanceM: number, footprintHeightM: number): number {
  return 1 - distanceM / footprintHeightM;
}

/** Fração de sobreposição lateral com erro transversal `e`. */
export function realSideOverlap(
  crossTrackErrorM: number,
  spacingM: number,
  footprintWidthM: number,
): number {
  return 1 - (spacingM + Math.abs(crossTrackErrorM)) / footprintWidthM;
}
