/** Estereoscopia — domain-math §3 (Laboratório: paralaxe e precisão em profundidade). */

/** Base no plano-imagem: b = B·f/H. */
export function photoBaseM(baseM: number, focalM: number, heightM: number): number {
  return (baseM * focalM) / heightM;
}

/** Diferença de paralaxe de um objeto de altura h: Δp = B·f·h / (H·(H − h)). */
export function parallaxDiffM(
  baseM: number,
  focalM: number,
  heightM: number,
  objectM: number,
): number {
  return (baseM * focalM * objectM) / (heightM * (heightM - objectM));
}

/** Altura a partir da paralaxe: h = H·Δp / (b + Δp). */
export function heightFromParallax(heightM: number, photoBase: number, dp: number): number {
  return (heightM * dp) / (photoBase + dp);
}

/** Razão base/altura. */
export function baseHeightRatio(baseM: number, heightM: number): number {
  return baseM / heightM;
}

/** Precisão em profundidade: σ_Z = H² / (B·f) · σ_px, com σ_px em metros no sensor. */
export function depthPrecisionM(
  heightM: number,
  baseM: number,
  focalM: number,
  sigmaPxM: number,
): number {
  return ((heightM * heightM) / (baseM * focalM)) * sigmaPxM;
}
