/**
 * Sprites do avatar do mapa-múndi por modo de locomoção (world-map §5.2): a pé, bicicleta,
 * carro, picape e van, nas cores da skin e nas 4 direções. Desenho puro sobre o contexto.
 */
import type { Facing, TileType, VehicleId } from '@/types';
import type { AvatarState } from './avatar';
import { TILE_PX } from './tileRenderer';

export interface SkinColors {
  primary: string;
  secondary: string;
}

const GLASS = '#bae6fd';
const TIRE = '#0f172a';
const SHADOW = 'rgba(2, 6, 23, 0.35)';
const SKIN_TONE = '#f2c9a0';

/** Tiles de via em que a bicicleta aparece (fora deles o modo "A Pé / Bike" anda a pé). */
const ROAD_TILES: ReadonlySet<TileType> = new Set<TileType>(['ROAD_PAVED', 'ROAD_DIRT', 'BRIDGE']);

/** Ângulo do sprite desenhado de frente para leste. */
const HEADING: Readonly<Record<Facing, number>> = {
  E: 0,
  S: Math.PI / 2,
  W: Math.PI,
  N: -Math.PI / 2,
};

export interface AvatarDrawArgs {
  avatar: AvatarState;
  vehicle: VehicleId;
  /** Tile sob o centro do avatar. */
  tile: TileType;
  skin: SkinColors;
  moving: boolean;
}

/** Desenha o avatar do modo ativo. */
export function drawAvatar(ctx: CanvasRenderingContext2D, a: AvatarDrawArgs): void {
  switch (a.vehicle) {
    case 'COMPACT_CAR':
      return drawMotor(ctx, a, CAR);
    case 'PICKUP_4X4':
      return drawMotor(ctx, a, PICKUP);
    case 'LAB_VAN':
      return drawMotor(ctx, a, VAN);
    case 'FOOT_BIKE':
      return ROAD_TILES.has(a.tile) && a.moving
        ? drawBikeAvatar(ctx, a.avatar, a.skin)
        : drawFootAvatar(ctx, a.avatar, a.skin, a.moving);
  }
}

function shadow(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number): void {
  ctx.fillStyle = SHADOW;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 9, rx, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Roda o sistema de coordenadas para o rumo do avatar, com a origem no seu centro. */
function heading(ctx: CanvasRenderingContext2D, avatar: AvatarState, draw: () => void): void {
  ctx.save();
  ctx.translate(avatar.x * TILE_PX, avatar.y * TILE_PX);
  ctx.rotate(HEADING[avatar.facing]);
  draw();
  ctx.restore();
}

interface MotorShape {
  /** Comprimento e largura do casco, px. */
  length: number;
  width: number;
  /** Para-brisa: posição do início (a partir do centro) e comprimento. */
  glassAt: number;
  glassLen: number;
  /** Comprimento da caçamba aberta, atrás da cabine (picape). */
  bed?: number;
  /** Janelas laterais ao longo do teto (van). */
  windows?: boolean;
  antenna?: boolean;
}

const CAR: MotorShape = { length: 24, width: 14, glassAt: 2, glassLen: 5 };
const PICKUP: MotorShape = { length: 30, width: 16, glassAt: 3, glassLen: 5, bed: 13 };
const VAN: MotorShape = {
  length: 34,
  width: 14,
  glassAt: 11,
  glassLen: 4,
  windows: true,
  antenna: true,
};

function drawMotor(ctx: CanvasRenderingContext2D, a: AvatarDrawArgs, shape: MotorShape): void {
  const { avatar, skin } = a;
  const half = shape.length / 2;
  const w = shape.width / 2;
  shadow(ctx, avatar.x * TILE_PX, avatar.y * TILE_PX, half * 0.8);
  heading(ctx, avatar, () => {
    // Rodas, aparecendo nas pontas dos eixos.
    ctx.fillStyle = TIRE;
    for (const x of [-half * 0.55, half * 0.55]) {
      ctx.fillRect(x - 3, -w - 1.5, 6, 3);
      ctx.fillRect(x - 3, w - 1.5, 6, 3);
    }
    // Casco.
    ctx.fillStyle = skin.primary;
    ctx.strokeStyle = skin.secondary;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(-half, -w, shape.length, shape.width, 3);
    ctx.fill();
    ctx.stroke();
    if (shape.bed) {
      // Caçamba: um retângulo rebaixado atrás da cabine.
      ctx.fillStyle = skin.secondary;
      ctx.fillRect(-half + 1.5, -w + 2, shape.bed, shape.width - 4);
    }
    // Para-brisa.
    ctx.fillStyle = GLASS;
    ctx.fillRect(shape.glassAt, -w + 2, shape.glassLen, shape.width - 4);
    if (shape.windows) {
      ctx.fillRect(-half + 4, -w + 1, shape.length * 0.5, 2);
      ctx.fillRect(-half + 4, w - 3, shape.length * 0.5, 2);
    }
    if (shape.antenna) {
      ctx.strokeStyle = skin.secondary;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-half + 6, 0);
      ctx.lineTo(-half + 6, -w - 5);
      ctx.stroke();
      ctx.fillStyle = skin.secondary;
      ctx.beginPath();
      ctx.arc(-half + 6, -w - 5, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

/** Bicicleta: corpo do ciclista entre duas rodas. */
export function drawBikeAvatar(
  ctx: CanvasRenderingContext2D,
  avatar: AvatarState,
  skin: SkinColors,
): void {
  shadow(ctx, avatar.x * TILE_PX, avatar.y * TILE_PX, 11);
  heading(ctx, avatar, () => {
    ctx.strokeStyle = TIRE;
    ctx.lineWidth = 2;
    for (const x of [-8, 8]) {
      ctx.beginPath();
      ctx.arc(x, 0, 4.5, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.strokeStyle = skin.secondary;
    ctx.beginPath();
    ctx.moveTo(-8, 0);
    ctx.lineTo(8, 0);
    ctx.stroke();
    // Ciclista visto de cima: tronco e cabeça.
    ctx.fillStyle = skin.primary;
    ctx.beginPath();
    ctx.ellipse(-1, 0, 6, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = SKIN_TONE;
    ctx.beginPath();
    ctx.arc(4, 0, 3.5, 0, Math.PI * 2);
    ctx.fill();
  });
}

/** Avatar a pé (círculo + corpo) nas cores da skin, com 4 direções e "bob" de caminhada. */
export function drawFootAvatar(
  ctx: CanvasRenderingContext2D,
  avatar: AvatarState,
  skin: SkinColors,
  moving: boolean,
): void {
  const cx = avatar.x * TILE_PX;
  const cy = avatar.y * TILE_PX;
  const bob = moving ? Math.abs(Math.sin(avatar.walked * Math.PI * 2)) * 2 : 0;
  const dir: Record<Facing, [number, number]> = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
  const [fx, fy] = dir[avatar.facing];

  ctx.fillStyle = SHADOW;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 9, 8, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();

  const by = cy - bob;
  // Corpo.
  ctx.fillStyle = skin.primary;
  ctx.strokeStyle = skin.secondary;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(cx - 6, by - 3, 12, 12, 4);
  ctx.fill();
  ctx.stroke();
  // Cabeça.
  ctx.fillStyle = SKIN_TONE;
  ctx.beginPath();
  ctx.arc(cx, by - 7, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Olhar: olhos para o sul/leste/oeste; de costas, só o cabelo.
  if (avatar.facing === 'N') {
    ctx.fillStyle = skin.secondary;
    ctx.beginPath();
    ctx.arc(cx, by - 8, 4, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = '#0f172a';
    const ex = cx + fx * 2.5;
    const ey = by - 7 + fy * 1.5;
    if (avatar.facing === 'S') {
      ctx.fillRect(ex - 2.5, ey - 1, 1.5, 1.5);
      ctx.fillRect(ex + 1, ey - 1, 1.5, 1.5);
    } else {
      ctx.fillRect(ex - 0.75, ey - 1, 1.5, 1.5);
    }
  }
}
