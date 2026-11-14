/** Volumetria — domain-math §11. */
import type { Rng } from '@/lib/rng';
import type { Contract } from '@/types';

type Elevation = { elevation(u: number, v: number): number };

export interface VolumeReference {
  /** Volume abaixo do plano de referência (cava). */
  cutM3: number;
  /** Volume acima do plano (pilhas). */
  fillM3: number;
  /** Área (m²) onde o terreno se afasta do plano. */
  affectedAreaM2: number;
}

/** Plano de referência: média da elevação na borda da AOI (amostrada a cada ~1 % do perímetro). */
export function borderMeanElevation(
  terrain: Elevation,
  aoi: Contract['aoi'],
  samplesPerSide = 64,
): number {
  let sum = 0;
  let n = 0;
  for (let k = 0; k < samplesPerSide; k++) {
    const f = (k + 0.5) / samplesPerSide;
    for (const [u, v] of [
      [f * aoi.lengthM, 0],
      [f * aoi.lengthM, aoi.widthM],
      [0, f * aoi.widthM],
      [aoi.lengthM, f * aoi.widthM],
    ] as const) {
      sum += terrain.elevation(u, v);
      n++;
    }
  }
  return sum / n;
}

/** Integração em grade (`resolution²` células) do volume de corte e de aterro. */
export function referenceVolumeM3(
  terrain: Elevation,
  aoi: Contract['aoi'],
  refPlaneM: number,
  resolution = 256,
): VolumeReference {
  const du = aoi.lengthM / resolution;
  const dv = aoi.widthM / resolution;
  const cellArea = du * dv;
  let cut = 0;
  let fill = 0;
  let affected = 0;
  for (let i = 0; i < resolution; i++) {
    for (let j = 0; j < resolution; j++) {
      const d = terrain.elevation((i + 0.5) * du, (j + 0.5) * dv) - refPlaneM;
      if (d < 0) cut -= d * cellArea;
      else fill += d * cellArea;
      if (Math.abs(d) > 1e-6) affected += cellArea;
    }
  }
  return { cutM3: cut, fillM3: fill, affectedAreaM2: affected };
}

/** Volume medido: (corte + aterro)·(1 + ε), ε = −0,5·vermelho + N(0, 0,5·rmseZ/profundidade média). */
export function measuredVolumeM3(
  reference: VolumeReference,
  rmseZ: number,
  meanDepthM: number,
  redFraction: number,
  rng: Rng,
): number {
  const sigma = meanDepthM > 0 ? (0.5 * rmseZ) / meanDepthM : 0;
  const eps = -0.5 * redFraction + sigma * rng.normal();
  return (reference.cutM3 + reference.fillM3) * (1 + eps);
}

export function volumeErrorPct(reference: VolumeReference, measuredM3: number): number {
  const total = reference.cutM3 + reference.fillM3;
  return total > 0 ? (Math.abs(measuredM3 - total) / total) * 100 : 0;
}

/** Profundidade média do material movimentado. */
export function meanDepthM(reference: VolumeReference): number {
  return reference.affectedAreaM2 > 0
    ? (reference.cutM3 + reference.fillM3) / reference.affectedAreaM2
    : 0;
}
