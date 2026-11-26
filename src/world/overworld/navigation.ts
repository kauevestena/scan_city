/**
 * Navegação GNSS do mapa-múndi (world-map §5.6): o destino é a próxima missão — o primeiro
 * contrato disponível da aba, na ordem da campanha — e o rumo até ele, em tiles e em pontos
 * cardeais. Puro: o engine desenha a seta e o HUD escreve a leitura.
 */
import type { MarkerView } from './markers';

/** Pontos cardeais, de 45° em 45°, a partir do norte, no sentido horário. */
export const COMPASS = ['N', 'NE', 'L', 'SE', 'S', 'SO', 'O', 'NO'] as const;
export type CompassPoint = (typeof COMPASS)[number];

/** Abaixo desta distância (tiles) o jogador já chegou: a seta some. */
export const ARRIVED_TILES = 1.5;

/**
 * A próxima missão: o primeiro marcador disponível (`AVAILABLE` ou `STOLEN`, que ainda pode
 * ser refeito) na ordem de `order` (a da campanha); `null` se não há nenhum.
 */
export function nextMissionMarker(
  markers: readonly MarkerView[],
  order: readonly string[],
): MarkerView | null {
  const open = markers.filter((m) => m.status === 'AVAILABLE' || m.status === 'STOLEN');
  if (open.length === 0) return null;
  const rank = (m: MarkerView) => {
    const i = order.indexOf(m.contractId);
    return i < 0 ? Number.MAX_SAFE_INTEGER : i;
  };
  return [...open].sort((a, b) => rank(a) - rank(b))[0] ?? null;
}

export interface Bearing {
  /** Distância em tiles até o centro do tile de destino. */
  distanceTiles: number;
  /** Ângulo na tela (rad): 0 = leste, π/2 = sul (y cresce para baixo). */
  angleRad: number;
  compass: CompassPoint;
  arrived: boolean;
}

/** Rumo do avatar até o centro do tile (x, y). */
export function bearingTo(from: { x: number; y: number }, to: { x: number; y: number }): Bearing {
  const dx = to.x + 0.5 - from.x;
  const dy = to.y + 0.5 - from.y;
  const distanceTiles = Math.hypot(dx, dy);
  const angleRad = Math.atan2(dy, dx);
  // Azimute a partir do norte, no sentido horário: norte é y negativo.
  const az = (Math.atan2(dx, -dy) * 180) / Math.PI;
  const idx = (Math.round((((az % 360) + 360) % 360) / 45) % 8) as number;
  return {
    distanceTiles,
    angleRad,
    compass: COMPASS[idx] as CompassPoint,
    arrived: distanceTiles < ARRIVED_TILES,
  };
}
