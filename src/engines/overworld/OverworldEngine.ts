/**
 * Engine do mapa-múndi (world-map §5.2–§5.3): avatar, câmera, chunks estáticos,
 * camada animada e porta da sede. Não conhece React nem o store: recebe getters e callbacks.
 */
import type { AxisAction } from '@/input/actions';
import type { Facing, VehicleId } from '@/types';
import type { MarkerView } from '@/world/overworld/markers';
import { blockedHint, WORLD_MAP, type OverworldMap } from '@/world/overworld/tiles';
import { nearestWalkable } from '@/world/overworld/pathfinding';
import { COLORS } from '@/ui/tokens';
import type { CanvasSurface } from '../canvas';
import type { Simulation } from '../loop';
import { boxBlocker, stepAvatar, type AvatarState } from './avatar';
import { clampCamera, followCamera, type CameraState } from './camera';
import { CHUNK_TILES, ChunkCache, drawMarker, drawWater, TILE_PX } from './tileRenderer';

/** Zoom de câmera em 1280 px de largura (≈ 27 × 14 tiles visíveis). */
export const BASE_ZOOM = 1.5;
/** Raio de interação com a porta e os marcadores, em tiles. */
export const INTERACT_RADIUS = 0.8;
/** Intervalo mínimo entre duas dicas de bloqueio. */
export const HINT_THROTTLE_S = 3;
/** Chunks pré-renderizados mantidos em memória (os visíveis cabem com folga). */
export const MAX_CACHED_CHUNKS = 20;

export interface SkinColors {
  primary: string;
  secondary: string;
}

export interface OverworldEngineOptions {
  map?: OverworldMap;
  input: { axis(a: AxisAction): number };
  start: { x: number; y: number; facing: Facing };
  vehicle: () => VehicleId;
  speedMod: () => number;
  skin: () => SkinColors;
  /** Marcadores visíveis na aba atual, com status. */
  markers: () => readonly MarkerView[];
  onHint?: (text: string) => void;
  /** O alvo de `INTERACT` mudou (porta, marcador ou nada). */
  onTargetChange?: (target: InteractTarget | null) => void;
}

/** O que um `INTERACT` acionaria: a porta da sede ou um marcador. */
export type InteractTarget = { kind: 'DOOR' } | { kind: 'MARKER'; marker: MarkerView };

function sameTarget(a: InteractTarget | null, b: InteractTarget | null): boolean {
  if (a === null || b === null) return a === b;
  if (a.kind === 'DOOR' || b.kind === 'DOOR') return a.kind === b.kind;
  return a.marker.contractId === b.marker.contractId && a.marker.status === b.marker.status;
}

/** Zoom para a largura lógica do canvas, mantendo ≈ 27 tiles na horizontal. */
export function zoomFor(width: number): number {
  return Math.min(3, Math.max(1, (BASE_ZOOM * width) / 1280));
}

export class OverworldEngine implements Simulation {
  readonly map: OverworldMap;
  avatar: AvatarState;
  camera: CameraState;
  /** Tiles percorridos desde a última leitura de `takeDistance`. */
  private distance = 0;
  private timeS = 0;
  private lastHintS = -Infinity;
  /** Começa vazio: o primeiro `update` avisa se o avatar já nasce num alvo. */
  private target: InteractTarget | null = null;
  private moving = false;
  private surface: CanvasSurface | null = null;
  private readonly chunks: ChunkCache;

  constructor(private readonly opts: OverworldEngineOptions) {
    this.map = opts.map ?? WORLD_MAP;
    this.avatar = { ...this.validStart(opts.start), walked: 0 };
    this.camera = { x: this.avatar.x, y: this.avatar.y };
    this.chunks = new ChunkCache(this.map, MAX_CACHED_CHUNKS);
  }

  /** Save antigo em tile inválido para o modo atual: tile caminhável mais próximo (§7). */
  private validStart(start: OverworldEngineOptions['start']): Omit<AvatarState, 'walked'> {
    const vehicle = this.opts.vehicle();
    if (!boxBlocker(this.map, start.x, start.y, vehicle)) return { ...start };
    const tile = nearestWalkable(this.map, start, vehicle) ?? this.map.spawn;
    return { x: tile.x + 0.5, y: tile.y + 0.5, facing: start.facing };
  }

  attach(surface: CanvasSurface): void {
    this.surface = surface;
    const view = this.viewTiles();
    this.camera = clampCamera(this.avatar, view.w, view.h, this.map.width, this.map.height);
  }

  get zoom(): number {
    return zoomFor(this.surface?.width ?? 1280);
  }

  /** Tamanho da vista, em tiles. */
  viewTiles(): { w: number; h: number } {
    const px = TILE_PX * this.zoom;
    return { w: (this.surface?.width ?? 1280) / px, h: (this.surface?.height ?? 720) / px };
  }

  get position(): { x: number; y: number; facing: Facing } {
    return { x: this.avatar.x, y: this.avatar.y, facing: this.avatar.facing };
  }

  get isMoving(): boolean {
    return this.moving;
  }

  /** Devolve e zera a distância acumulada (para `stats.distanceTiles`). */
  takeDistance(): number {
    const d = this.distance;
    this.distance = 0;
    return d;
  }

  private distanceTo(x: number, y: number): number {
    return Math.hypot(this.avatar.x - (x + 0.5), this.avatar.y - (y + 0.5));
  }

  isNearDoor(): boolean {
    return this.distanceTo(this.map.door.x, this.map.door.y) <= INTERACT_RADIUS;
  }

  /** O alvo de `INTERACT` agora: o marcador mais próximo no raio, senão a porta. */
  currentTarget(): InteractTarget | null {
    let best: MarkerView | null = null;
    let bestD = INTERACT_RADIUS;
    for (const m of this.opts.markers()) {
      const d = this.distanceTo(m.x, m.y);
      if (d <= bestD) {
        best = m;
        bestD = d;
      }
    }
    if (best) return { kind: 'MARKER', marker: best };
    return this.isNearDoor() ? { kind: 'DOOR' } : null;
  }

  /** O que um `INTERACT` acionaria agora, se algo. */
  interact(): InteractTarget | null {
    return this.currentTarget();
  }

  /** Move o avatar para o centro do tile (depuração: "Teleportar para marcador"). */
  teleport(x: number, y: number): void {
    this.avatar = { ...this.avatar, x, y };
    this.camera = { x, y };
    const view = this.viewTiles();
    this.camera = clampCamera(this.camera, view.w, view.h, this.map.width, this.map.height);
  }

  update(dtS: number): void {
    this.timeS += dtS;
    const vehicle = this.opts.vehicle();
    const mx = this.opts.input.axis('MOVE_X');
    const my = this.opts.input.axis('MOVE_Y');
    const result = stepAvatar(this.map, this.avatar, mx, my, vehicle, this.opts.speedMod(), dtS);
    this.avatar = result.state;
    this.distance += result.moved;
    this.moving = result.moved > 0;
    if (result.blockedBy && this.timeS - this.lastHintS >= HINT_THROTTLE_S) {
      this.lastHintS = this.timeS;
      this.opts.onHint?.(blockedHint(result.blockedBy, vehicle));
    }
    const target = this.currentTarget();
    if (!sameTarget(target, this.target)) {
      this.target = target;
      this.opts.onTargetChange?.(target);
    }
    const view = this.viewTiles();
    this.camera = clampCamera(
      followCamera(this.camera, this.avatar, dtS),
      view.w,
      view.h,
      this.map.width,
      this.map.height,
    );
  }

  render(): void {
    const surface = this.surface;
    if (!surface) return;
    const { ctx, width, height, dpr } = surface;
    const zoom = this.zoom;
    const tilePx = TILE_PX * zoom;
    const view = this.viewTiles();
    const left = this.camera.x - view.w / 2;
    const top = this.camera.y - view.h / 2;

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = COLORS.bgBase;
    ctx.fillRect(0, 0, width, height);
    // Pixels inteiros na tela evitam costuras entre os chunks.
    const ox = Math.round(-left * tilePx);
    const oy = Math.round(-top * tilePx);
    ctx.translate(ox, oy);
    ctx.scale(zoom, zoom);

    // Camada estática: só os chunks visíveis.
    const chunkPx = CHUNK_TILES * TILE_PX;
    const cx0 = Math.max(0, Math.floor(left / CHUNK_TILES));
    const cy0 = Math.max(0, Math.floor(top / CHUNK_TILES));
    const cx1 = Math.min(
      Math.ceil(this.map.width / CHUNK_TILES) - 1,
      Math.floor((left + view.w) / CHUNK_TILES),
    );
    const cy1 = Math.min(
      Math.ceil(this.map.height / CHUNK_TILES) - 1,
      Math.floor((top + view.h) / CHUNK_TILES),
    );
    ctx.imageSmoothingEnabled = false;
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const chunk = this.chunks.get(cx, cy, zoom * dpr);
        ctx.drawImage(chunk.canvas, cx * chunkPx, cy * chunkPx, chunkPx, chunkPx);
      }
    }

    // Camada animada.
    const x0 = Math.max(0, Math.floor(left));
    const y0 = Math.max(0, Math.floor(top));
    const x1 = Math.min(this.map.width - 1, Math.ceil(left + view.w));
    const y1 = Math.min(this.map.height - 1, Math.ceil(top + view.h));
    drawWater(ctx, this.map, x0, y0, x1, y1, this.timeS);
    for (const m of this.opts.markers()) {
      if (m.x >= x0 - 1 && m.x <= x1 + 1 && m.y >= y0 - 1 && m.y <= y1 + 1)
        drawMarker(ctx, m, this.timeS);
    }
    drawFootAvatar(ctx, this.avatar, this.opts.skin(), this.moving);
    ctx.restore();
  }
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

  ctx.fillStyle = 'rgba(2, 6, 23, 0.35)';
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
  ctx.fillStyle = '#f2c9a0';
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
