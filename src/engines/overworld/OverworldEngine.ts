/**
 * Engine do mapa-múndi (world-map §5.2–§5.3): avatar, câmera, chunks estáticos,
 * camada animada e porta da sede. Não conhece React nem o store: recebe getters e callbacks.
 */
import type { AxisAction } from '@/input/actions';
import { hash2 } from '@/lib/rng';
import type { Dimension, Facing, TileType, VehicleId } from '@/types';
import type { MarkerView } from '@/world/overworld/markers';
import { blockedHint, tileAt, WORLD_MAP, type OverworldMap } from '@/world/overworld/tiles';
import { nearestWalkable } from '@/world/overworld/pathfinding';
import { COLORS } from '@/ui/tokens';
import type { CanvasSurface } from '../canvas';
import type { Simulation } from '../loop';
import { boxBlocker, stepAvatar, type AvatarState } from './avatar';
import { clampCamera, followCamera, type CameraState } from './camera';
import {
  CHUNK_TILES,
  ChunkCache,
  drawMarker,
  drawRiftAtmosphere,
  drawWater,
  TILE_PX,
} from './tileRenderer';
import { drawAvatar, type SkinColors } from './vehicleSprites';

/** Zoom de câmera em 1280 px de largura (≈ 27 × 14 tiles visíveis). */
export const BASE_ZOOM = 1.5;
/** Raio de interação com a porta e os marcadores, em tiles. */
export const INTERACT_RADIUS = 0.8;
/** Intervalo mínimo entre duas dicas de bloqueio. */
export const HINT_THROTTLE_S = 3;
/** Chunks pré-renderizados mantidos em memória (os visíveis cabem com folga). */
export const MAX_CACHED_CHUNKS = 20;

export type { SkinColors };

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
  /** O avatar completou mais um tile de percurso; `tile` é o tipo sob ele (world-map §5.5). */
  onTile?: (tile: TileType) => void;
  /** Movimento travado (evento de campo em curso). */
  blocked?: () => boolean;
  /** Chuva ativa (evento `SUDDEN_RAIN`): desenha as partículas. */
  rain?: () => boolean;
  /** Aba atual: na das Fendas o mapa ganha o véu violeta e as partículas (contracts-rifts §1). */
  dimension?: () => Dimension;
  /** Reduz o movimento do véu e dos portais (acessibilidade). */
  reduceFlashes?: () => boolean;
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
  /** Percurso acumulado desde o último tile inteiro, em tiles. */
  private tileProgress = 0;
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

  /** Tiles percorridos que ainda não foram lidos por `takeDistance`. */
  get pendingDistance(): number {
    return this.distance;
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

  /**
   * Recusa de troca de veículo (world-map §5.3): se o novo modo não cabe no tile atual,
   * devolve a dica correspondente; `null` se pode trocar.
   */
  switchRefusal(next: VehicleId): string | null {
    const blocker = boxBlocker(this.map, this.avatar.x, this.avatar.y, next);
    return blocker ? blockedHint(blocker, next) : null;
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
    const frozen = this.opts.blocked?.() ?? false;
    const result = frozen
      ? { state: this.avatar, moved: 0, blockedBy: null }
      : stepAvatar(this.map, this.avatar, mx, my, vehicle, this.opts.speedMod(), dtS);
    this.avatar = result.state;
    this.distance += result.moved;
    this.moving = result.moved > 0;
    // Um sorteio de evento por tile inteiro percorrido.
    this.tileProgress += result.moved;
    while (this.tileProgress >= 1) {
      this.tileProgress -= 1;
      this.opts.onTile?.(tileAt(this.map, this.avatar.x, this.avatar.y));
    }
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
    const calm = this.opts.reduceFlashes?.() ?? false;
    for (const m of this.opts.markers()) {
      if (m.x >= x0 - 1 && m.x <= x1 + 1 && m.y >= y0 - 1 && m.y <= y1 + 1)
        drawMarker(ctx, m, this.timeS, !calm);
    }
    drawAvatar(ctx, {
      avatar: this.avatar,
      vehicle: this.opts.vehicle(),
      tile: tileAt(this.map, this.avatar.x, this.avatar.y),
      skin: this.opts.skin(),
      moving: this.moving,
    });
    ctx.restore();
    if (this.opts.dimension?.() === 'RIFT') {
      drawRiftAtmosphere(ctx, width, height, dpr, this.timeS, calm);
    }
    if (this.opts.rain?.()) drawRain(ctx, width, height, dpr, this.timeS);
  }
}

const RAIN_DROPS = 140;
const RAIN_SEED = 0x7a1e;

/** Chuva em coordenadas de tela: riscos inclinados e determinísticos pelo tempo. */
export function drawRain(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  dpr: number,
  timeS: number,
): void {
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.18)';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = 'rgba(186, 230, 253, 0.55)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < RAIN_DROPS; i++) {
    const speed = 520 + hash2(i, 2, RAIN_SEED) * 320;
    const x = hash2(i, 0, RAIN_SEED) * width;
    const y = (hash2(i, 1, RAIN_SEED) * height + timeS * speed) % height;
    ctx.moveTo(x, y);
    ctx.lineTo(x - 3, y + 12);
  }
  ctx.stroke();
  ctx.restore();
}
