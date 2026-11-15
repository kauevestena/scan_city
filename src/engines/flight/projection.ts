/** Câmera e projeção do voo (survey-flight §5.1). */

export type Quality = 'LOW' | 'MEDIUM' | 'HIGH';

/** Faixas (N), colunas (M) e alcance por qualidade (§5.3). */
export const QUALITY: Readonly<Record<Quality, { bands: number; cols: number; zFar: number }>> = {
  HIGH: { bands: 72, cols: 48, zFar: 1200 },
  MEDIUM: { bands: 56, cols: 36, zFar: 900 },
  LOW: { bands: 40, cols: 28, zFar: 700 },
};

export const FOV_H_DEG = 70;
export const CAMERA_OFFSET_M = 30;
export const CAM_UP_M = 12;
export const Z_NEAR_M = 1;
export const HORIZON_CRUISE = 0.35;
export const HORIZON_TAKEOFF = 0.62;

export interface FlightCamera {
  width: number;
  height: number;
  focalPx: number;
  horizonX: number;
  horizonY: number;
  /** X da câmera (segue o da aeronave). */
  camX: number;
  /** Altitude absoluta da câmera: aeronave + camUp. */
  camAlt: number;
  zNear: number;
  zFar: number;
}

export function makeCamera(
  width: number,
  height: number,
  camX: number,
  aircraftAlt: number,
  quality: Quality = 'HIGH',
  horizonFrac: number = HORIZON_CRUISE,
): FlightCamera {
  return {
    width,
    height,
    focalPx: width / 2 / Math.tan(((FOV_H_DEG / 2) * Math.PI) / 180),
    horizonX: width / 2,
    horizonY: horizonFrac * height,
    camX,
    camAlt: aircraftAlt + CAM_UP_M,
    zNear: Z_NEAR_M,
    zFar: QUALITY[quality].zFar,
  };
}

export interface Projected {
  x: number;
  y: number;
  scale: number;
}

/**
 * Projeta o ponto do *run* (X, Z) à altura absoluta `h` (m). `Z` é a distância à frente
 * da aeronave; `null` se `Z + cameraOffset < zNear`.
 */
export function projectAbs(X: number, h: number, Z: number, cam: FlightCamera): Projected | null {
  const depth = Z + CAMERA_OFFSET_M;
  if (depth < cam.zNear) return null;
  const scale = cam.focalPx / depth;
  return {
    x: cam.horizonX + (X - cam.camX) * scale,
    y: cam.horizonY + (cam.camAlt - h) * scale,
    scale,
  };
}

/** `project(X, Y, Z)` da spec: `Y` é a altura acima do solo `elev(X, Z)`. */
export function project(
  X: number,
  Y: number,
  Z: number,
  cam: FlightCamera,
  elev: (X: number, Z: number) => number,
): Projected | null {
  return projectAbs(X, elev(X, Z) + Y, Z, cam);
}

/** Meia-largura do terreno visível na distância Z (com 40 px de folga em cada lado). */
export function halfWidthAt(Z: number, cam: FlightCamera): number {
  return (cam.width / 2 + 40) / (cam.focalPx / (Z + CAMERA_OFFSET_M));
}

/**
 * Ponto do chão sob o pixel (xs, ys), por busca binária em Z (testes e picking).
 * `null` acima do horizonte ou fora do alcance.
 */
export function unprojectGround(
  xs: number,
  ys: number,
  cam: FlightCamera,
  elev: (X: number, Z: number) => number,
): { X: number; Z: number } | null {
  let lo = cam.zNear - CAMERA_OFFSET_M;
  let hi = cam.zFar;
  const groundY = (Z: number) => {
    const scale = cam.focalPx / (Z + CAMERA_OFFSET_M);
    const X = cam.camX + (xs - cam.horizonX) / scale;
    return projectAbs(X, elev(X, Z), Z, cam)?.y ?? Infinity;
  };
  // O chão sobe na tela com a distância: y(Z) decresce.
  if (ys > groundY(lo) || ys < groundY(hi)) return null;
  for (let k = 0; k < 50; k++) {
    const mid = (lo + hi) / 2;
    if (groundY(mid) > ys) lo = mid;
    else hi = mid;
  }
  const Z = (lo + hi) / 2;
  const scale = cam.focalPx / (Z + CAMERA_OFFSET_M);
  return { X: cam.camX + (xs - cam.horizonX) / scale, Z };
}
