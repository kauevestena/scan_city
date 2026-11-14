/** Movimento do avatar no mapa (world-map §5.3): velocidade por tile e colisão por eixo. */
import type { Facing, TileType, VehicleId } from '@/types';
import { canEnter, speedOn, tileAt, type OverworldMap } from '@/world/overworld/tiles';

/** Caixa de colisão do avatar, em tiles. */
export const AVATAR_BOX = 0.6;

export interface AvatarState {
  /** Centro do avatar, em tiles. */
  x: number;
  y: number;
  facing: Facing;
  /** Distância percorrida (tiles), para o "bob" de caminhada. */
  walked: number;
}

export interface MoveResult {
  state: AvatarState;
  /** Deslocamento efetivo neste passo (tiles). */
  moved: number;
  /** Tile que barrou o movimento, se algum. */
  blockedBy: TileType | null;
}

/** A caixa centrada em (x, y) cabe inteira em tiles transponíveis? Devolve o tile que barra. */
export function boxBlocker(
  map: OverworldMap,
  x: number,
  y: number,
  vehicle: VehicleId,
): TileType | null {
  const h = AVATAR_BOX / 2;
  for (const [cx, cy] of [
    [x - h, y - h],
    [x + h - 1e-6, y - h],
    [x - h, y + h - 1e-6],
    [x + h - 1e-6, y + h - 1e-6],
  ] as const) {
    const tile = tileAt(map, cx, cy);
    if (!canEnter(tile, vehicle)) return tile;
  }
  return null;
}

function facingOf(dx: number, dy: number, current: Facing): Facing {
  if (dx === 0 && dy === 0) return current;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'E' : 'W';
  return dy > 0 ? 'S' : 'N';
}

/**
 * `vel = normalize(MOVE) · speed(tile do centro) · speedMod`; tenta X e depois Y,
 * cancelando o eixo que colidir (desliza nas paredes). `moveY > 0` é para o norte.
 */
export function stepAvatar(
  map: OverworldMap,
  state: AvatarState,
  moveX: number,
  moveY: number,
  vehicle: VehicleId,
  speedMod: number,
  dtS: number,
): MoveResult {
  const len = Math.hypot(moveX, moveY);
  if (len < 1e-6) return { state, moved: 0, blockedBy: null };
  const scale = Math.min(1, len) / len;
  const dirX = moveX * scale;
  // Tela: y cresce para o sul; MOVE_Y = +1 é para o norte.
  const dirY = -moveY * scale;
  const speed = (speedOn(tileAt(map, state.x, state.y), vehicle) ?? 0) * speedMod;

  let { x, y } = state;
  let blockedBy: TileType | null = null;
  const nx = x + dirX * speed * dtS;
  const blockX = boxBlocker(map, nx, y, vehicle);
  if (blockX) blockedBy = blockX;
  else x = nx;
  const ny = y + dirY * speed * dtS;
  const blockY = boxBlocker(map, x, ny, vehicle);
  if (blockY) blockedBy = blockY;
  else y = ny;

  const moved = Math.hypot(x - state.x, y - state.y);
  return {
    state: { x, y, facing: facingOf(dirX, dirY, state.facing), walked: state.walked + moved },
    moved,
    blockedBy,
  };
}
