/**
 * Campo de distâncias por *chamfer distance* (terrain §2): raster de `cellM` metros,
 * pré-computado uma vez. Pesos 3-4 (≈ distância euclidiana, erro < 8 %).
 */
export interface Bounds {
  uMin: number;
  uMax: number;
  vMin: number;
  vMax: number;
}

export interface DistanceField {
  /** Distância (m) até a semente mais próxima, interpolada bilinearmente. */
  sample(u: number, v: number): number;
  readonly cellM: number;
  readonly cols: number;
  readonly rows: number;
}

export function createDistanceField(
  bounds: Bounds,
  cellM: number,
  isSeed: (u: number, v: number) => boolean,
): DistanceField {
  const cols = Math.max(2, Math.ceil((bounds.uMax - bounds.uMin) / cellM) + 1);
  const rows = Math.max(2, Math.ceil((bounds.vMax - bounds.vMin) / cellM) + 1);
  const big = 1e9;
  const d = new Float64Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      d[r * cols + c] = isSeed(bounds.uMin + c * cellM, bounds.vMin + r * cellM) ? 0 : big;
    }
  }
  const straight = cellM;
  const diagonal = cellM * Math.SQRT2;
  const relax = (i: number, j: number, w: number) => {
    const candidate = (d[j] as number) + w;
    if (candidate < (d[i] as number)) d[i] = candidate;
  };
  // Passada direta (de cima para baixo) e reversa.
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (c > 0) relax(i, i - 1, straight);
      if (r > 0) {
        relax(i, i - cols, straight);
        if (c > 0) relax(i, i - cols - 1, diagonal);
        if (c < cols - 1) relax(i, i - cols + 1, diagonal);
      }
    }
  }
  for (let r = rows - 1; r >= 0; r--) {
    for (let c = cols - 1; c >= 0; c--) {
      const i = r * cols + c;
      if (c < cols - 1) relax(i, i + 1, straight);
      if (r < rows - 1) {
        relax(i, i + cols, straight);
        if (c < cols - 1) relax(i, i + cols + 1, diagonal);
        if (c > 0) relax(i, i + cols - 1, diagonal);
      }
    }
  }

  return {
    cellM,
    cols,
    rows,
    sample(u, v) {
      const x = Math.min(cols - 1, Math.max(0, (u - bounds.uMin) / cellM));
      const y = Math.min(rows - 1, Math.max(0, (v - bounds.vMin) / cellM));
      const c0 = Math.min(cols - 2, Math.floor(x));
      const r0 = Math.min(rows - 2, Math.floor(y));
      const fx = x - c0;
      const fy = y - r0;
      const at = (c: number, r: number) => d[r * cols + c] as number;
      const top = at(c0, r0) + (at(c0 + 1, r0) - at(c0, r0)) * fx;
      const bottom = at(c0, r0 + 1) + (at(c0 + 1, r0 + 1) - at(c0, r0 + 1)) * fx;
      // Fora do raster, soma a distância até a borda.
      const outside = Math.hypot(
        Math.max(0, bounds.uMin - u, u - (bounds.uMin + (cols - 1) * cellM)),
        Math.max(0, bounds.vMin - v, v - (bounds.vMin + (rows - 1) * cellM)),
      );
      return top + (bottom - top) * fy + outside;
    },
  };
}
