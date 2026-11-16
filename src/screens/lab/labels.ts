/**
 * Textos do Laboratório: rótulos dos diagramas e as fórmulas ao vivo, com os valores
 * substituídos (infographic-lab §4). Só formata o que as leituras do domínio já calcularam.
 */
import { STRINGS } from '@/data/strings';
import type { CanopyLabels } from '@/engines/lab/canopyRenderer';
import type { OpticsLabels } from '@/engines/lab/opticsRenderer';
import type { ShutterLabels } from '@/engines/lab/shutterRenderer';
import type { StereoLabels } from '@/engines/lab/stereoRenderer';
import { formatCm, formatMm, formatNumber, formatPct, formatUm } from '@/lib/format';
import type {
  CanopyInput,
  CanopyReadings,
  OpticsInput,
  OpticsReadings,
  ShutterInput,
  ShutterReadings,
  StereoInput,
  StereoReadings,
} from './readings';

const L = STRINGS.lab;

const metres = (v: number, decimals = 0) => `${formatNumber(v, decimals)} m`;

/** GSD em cm/px, com 2 casas (a leitura dos golden values: 1,25 cm/px). */
export const gsdText = (gsdM: number) => `${formatCm(gsdM, 2)}/px`;

export function opticsLabels(input: OpticsInput, r: OpticsReadings): OpticsLabels {
  return {
    height: L.optics.canvas.height(metres(input.heightM)),
    focal: L.optics.canvas.focal(`${formatNumber(input.focalMm, 1)} mm`),
    sensor: L.optics.canvas.sensor(`${formatNumber(input.sensorWidthMm, 1)} mm`),
    pixel: L.optics.canvas.pixel(`${formatNumber(input.pixelUm, 2)} µm`),
    ground: L.optics.canvas.ground(metres(r.footprintWidthM, 1)),
    gsd: L.optics.canvas.gsd(gsdText(r.gsdM)),
    lupa: L.optics.canvas.lupa,
  };
}

/** As fórmulas do painel de óptica, com os valores atuais substituídos. */
export function opticsFormulas(input: OpticsInput, r: OpticsReadings): string[] {
  const h = metres(input.heightM);
  const f = `${formatNumber(input.focalMm, 1)} mm`;
  const s = `${formatNumber(input.pixelUm, 2)} µm`;
  const sensor = `${formatNumber(input.sensorWidthMm, 1)} mm`;
  return [
    `GSD = (H × s) / f = (${h} × ${s}) / ${f} = ${gsdText(r.gsdM)}`,
    `W_g = (H × L) / f = (${h} × ${sensor}) / ${f} = ${metres(r.footprintWidthM, 1)}`,
    `FOV = 2·atan(L / 2f) = ${formatNumber(r.fovDeg, 1)}°`,
  ];
}

export function stereoLabels(
  input: StereoInput,
  r: StereoReadings,
  decimals: { photoBase: number; parallax: number } = { photoBase: 2, parallax: 3 },
): StereoLabels {
  return {
    base: L.stereo.canvas.base(metres(input.baseM)),
    height: L.stereo.canvas.height(metres(input.heightM)),
    object: L.stereo.canvas.object(metres(input.objectM, 1)),
    photoBase: L.stereo.canvas.photoBase(formatMm(r.photoBaseM, decimals.photoBase)),
    parallax: L.stereo.canvas.parallax(formatMm(r.parallaxDiffM, decimals.parallax)),
    photo1: L.stereo.canvas.photo1,
    photo2: L.stereo.canvas.photo2,
    overlay: L.stereo.canvas.overlay,
    top: L.stereo.canvas.top,
    ground: L.stereo.canvas.ground,
  };
}

/** As fórmulas do painel de estereoscopia, com os valores atuais substituídos. */
export function stereoFormulas(input: StereoInput, r: StereoReadings): string[] {
  const B = metres(input.baseM);
  const H = metres(input.heightM);
  const f = `${formatNumber(input.focalMm, 1)} mm`;
  return [
    `b = B·f / H = (${B} × ${f}) / ${H} = ${formatMm(r.photoBaseM, 2)}`,
    `Δp = B·f·h / (H·(H − h)) = ${formatMm(r.parallaxDiffM, 3)}`,
    `h = H·Δp / (b + Δp) = ${metres(r.reconstructedM, 2)}`,
    `σ_Z = H² / (B·f) · σ = ${formatCm(r.depthPrecisionM, 2)}`,
  ];
}

// --- Dossel ------------------------------------------------------------------------------------

export function canopyLabels(): CanopyLabels {
  return { ...L.canopy.canvas };
}

/** Densidade em pts/m², com uma casa. */
export const densityText = (n: number) => `${formatNumber(n, 1)} pts/m²`;

/** As fórmulas do painel de dossel, com os valores atuais substituídos. */
export function canopyFormulas(input: CanopyInput, r: CanopyReadings): string[] {
  const c = formatNumber(input.canopyPct, 0);
  return [
    `P_solo = (1 − c) + c · 0,02 · (n − 1) = ${formatPct(r.groundProbability, 2)}  (c = ${c} %, n = ${input.maxReturns})`,
    `faixa = 2·H·tan(FOV / 2) = ${metres(r.swathM, 1)}`,
    `ρ = PRR / (v · faixa) = ${densityText(r.densityPtsM2)}`,
    `ρ_solo = ρ · P_solo = ${densityText(r.groundDensityPtsM2)}`,
    `fotos: (1 − c)² = ${formatPct(r.photoVisibility, 2)}`,
  ];
}

// --- Shutter -----------------------------------------------------------------------------------

export function shutterLabels(input: ShutterInput, r: ShutterReadings): ShutterLabels {
  return {
    scene: L.shutter.canvas.scene,
    rolling: L.shutter.canvas.rolling,
    global: L.shutter.canvas.global,
    slowMotion: L.shutter.canvas.slowMotion,
    skew: L.shutter.canvas.skew(`${formatNumber(r.skewPx, 2)} px`),
    reference: L.shutter.canvas.reference,
    sweep: input.global ? '' : L.shutter.canvas.sweep,
  };
}

/** As fórmulas do painel de shutter, com os valores atuais substituídos. */
export function shutterFormulas(input: ShutterInput, r: ShutterReadings): string[] {
  const readout = input.global ? '0 ms' : `${formatNumber(input.readoutMs, 0)} ms`;
  return [
    `skew = v · t_readout / GSD = (${formatNumber(input.speedMs, 1)} m/s × ${readout}) / ${formatNumber(input.gsdCm, 2)} cm = ${formatNumber(r.skewPx, 2)} px`,
    `ângulo = atan(skew · GSD / altura no solo) = atan(${formatNumber(r.skewPx * (input.gsdCm / 100), 2)} m / ${formatNumber(r.groundHeightM, 1)} m) = ${formatNumber(r.shearDeg, 2)}°`,
  ];
}

export { formatCm, formatMm, formatUm };
