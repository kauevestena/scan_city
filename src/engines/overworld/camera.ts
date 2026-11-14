/** Câmera do mapa (world-map §5.2): lerp de 0,15 por frame até o avatar, presa aos limites. */
export const CAMERA_LERP = 0.15;

export interface CameraState {
  /** Centro da câmera, em tiles. */
  x: number;
  y: number;
}

/** Centro dentro dos limites, para a vista (em tiles) não sair do mapa. */
export function clampCamera(
  cam: CameraState,
  viewW: number,
  viewH: number,
  mapW: number,
  mapH: number,
): CameraState {
  const clampAxis = (c: number, view: number, size: number) =>
    view >= size ? size / 2 : Math.min(size - view / 2, Math.max(view / 2, c));
  return { x: clampAxis(cam.x, viewW, mapW), y: clampAxis(cam.y, viewH, mapH) };
}

/** Lerp independente da taxa de quadros: equivale a 0,15 por quadro a 60 FPS. */
export function followCamera(cam: CameraState, target: CameraState, dtS: number): CameraState {
  const k = 1 - (1 - CAMERA_LERP) ** (dtS * 60);
  return { x: cam.x + (target.x - cam.x) * k, y: cam.y + (target.y - cam.y) * k };
}
