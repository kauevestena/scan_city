/** Câmera e projeção do voo (survey-flight §5.1). */

export type Quality = 'LOW' | 'MEDIUM' | 'HIGH';

/** Faixas (N), colunas (M) e alcance por qualidade (§5.3). */
export const QUALITY: Readonly<Record<Quality, { bands: number; cols: number; zFar: number }>> = {
  HIGH: { bands: 72, cols: 48, zFar: 1200 },
  MEDIUM: { bands: 56, cols: 36, zFar: 900 },
  LOW: { bands: 40, cols: 28, zFar: 700 },
};

export const FOV_H_DEG = 70;
/** Proporção de referência do enquadramento (16:9); telas mais largas não ampliam a cena. */
export const REFERENCE_ASPECT = 16 / 9;
export const CAMERA_OFFSET_M = 30;
export const CAM_UP_M = 12;
export const Z_NEAR_M = 1;
export const HORIZON_CRUISE = 0.35;
export const HORIZON_TAKEOFF = 0.62;
/**
 * A câmera segue a altitude da aeronave com este tempo de resposta (s reais): a subida e a
 * descida aparecem na tela (a aeronave sobe e desce no quadro), e não só no chão que se afasta.
 */
export const CAM_ALT_TAU_S = 0.35;
/** ...e nunca fica mais longe que isto da aeronave (m): a decolagem e as rajadas sobem rápido. */
export const CAM_ALT_MAX_LAG_M = 4;

/**
 * A altitude que a câmera persegue (a da aeronave), um passo de `dtS` segundos reais depois de
 * `prev`, com atraso limitado (survey-flight §5.1, ADR-035). Sem anterior, a da aeronave.
 */
export function followCameraAlt(prev: number | null, aircraftAlt: number, dtS: number): number {
  if (prev === null) return aircraftAlt;
  const next = prev + (aircraftAlt - prev) * (1 - Math.exp(-Math.max(0, dtS) / CAM_ALT_TAU_S));
  return Math.min(aircraftAlt + CAM_ALT_MAX_LAG_M, Math.max(aircraftAlt - CAM_ALT_MAX_LAG_M, next));
}

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
    // O FOV horizontal vale para telas até 16:9. Em telas mais largas (ultrawide 21:9) o foco
    // fica limitado pela altura: o enquadramento vertical é o mesmo do 16:9 (a aeronave continua
    // na tela) e o que sobra de largura mostra mais cenário dos lados.
    focalPx:
      Math.min(width, height * REFERENCE_ASPECT) / 2 / Math.tan(((FOV_H_DEG / 2) * Math.PI) / 180),
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
