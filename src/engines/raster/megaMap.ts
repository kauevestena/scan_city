/**
 * O "mapa MegaMap" do comparativo (REQ-PRG-011c, processing-results §5.5): a mesma orto
 * deformada por uma distorção de barril e um deslocamento de 2 a 6 m, sem pontos de controle.
 * Puro e determinístico pela seed da missão.
 */
import { hash2 } from '@/lib/rng';

/** Faixa do deslocamento, m. */
export const MEGAMAP_OFFSET_MIN_M = 2;
export const MEGAMAP_OFFSET_MAX_M = 6;
/** Coeficiente da distorção de barril (raio normalizado 0–1 até o canto). */
export const MEGAMAP_BARREL_K = 0.28;
/** RMSE que a MegaMap declara, m. */
export const MEGAMAP_DECLARED_RMSE_M = 1.5;

export interface MegaMapParams {
  /** Módulo do deslocamento, m, em [2, 6]. */
  offsetM: number;
  /** Direção do deslocamento, rad (0 = leste, π/2 = sul). */
  angleRad: number;
  k: number;
}

export function megaMapParams(seed: number): MegaMapParams {
  const h1 = hash2(1, 2, seed);
  const h2 = hash2(3, 4, seed);
  return {
    offsetM: MEGAMAP_OFFSET_MIN_M + h1 * (MEGAMAP_OFFSET_MAX_M - MEGAMAP_OFFSET_MIN_M),
    angleRad: h2 * Math.PI * 2,
    k: MEGAMAP_BARREL_K,
  };
}

/** Cor dos pixels que caem fora da orto original. */
const OUTSIDE: readonly [number, number, number] = [15, 23, 42];

/**
 * Deforma o RGBA da orto: barril (raio normalizado pelo canto) mais o deslocamento, convertido
 * em pixels pela escala `mPerPx` da imagem. Reamostragem bilinear.
 */
export function distortOrtho(
  src: Uint8ClampedArray,
  width: number,
  height: number,
  params: MegaMapParams,
  mPerPx: { x: number; y: number },
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(src.length);
  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;
  const rMax = Math.hypot(cx, cy);
  const ox = (params.offsetM * Math.cos(params.angleRad)) / mPerPx.x;
  const oy = (params.offsetM * Math.sin(params.angleRad)) / mPerPx.y;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const r2 = (dx * dx + dy * dy) / (rMax * rMax);
      // Barril: o destino lê de mais longe do centro, comprimindo as bordas; depois, o deslocamento.
      const sx = cx + dx * (1 + params.k * r2) - ox;
      const sy = cy + dy * (1 + params.k * r2) - oy;
      const o = (y * width + x) * 4;
      if (sx < 0 || sy < 0 || sx > width - 1 || sy > height - 1) {
        out[o] = OUTSIDE[0];
        out[o + 1] = OUTSIDE[1];
        out[o + 2] = OUTSIDE[2];
        out[o + 3] = 255;
        continue;
      }
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const x1 = Math.min(width - 1, x0 + 1);
      const y1 = Math.min(height - 1, y0 + 1);
      const fx = sx - x0;
      const fy = sy - y0;
      for (let c = 0; c < 3; c++) {
        const a = src[(y0 * width + x0) * 4 + c] as number;
        const b = src[(y0 * width + x1) * 4 + c] as number;
        const d = src[(y1 * width + x0) * 4 + c] as number;
        const e = src[(y1 * width + x1) * 4 + c] as number;
        out[o + c] = (a * (1 - fx) + b * fx) * (1 - fy) + (d * (1 - fx) + e * fx) * fy;
      }
      out[o + 3] = 255;
    }
  }
  return out;
}
