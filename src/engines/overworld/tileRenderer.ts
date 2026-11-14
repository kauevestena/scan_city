/**
 * Render do mapa (world-map §5.2): camada estática em chunks de 16 × 16 tiles,
 * pré-renderizados uma vez com variações por hash, e camada animada (água, marcadores).
 * As cores do mapa são do engine (REQ-UI-001 permite hex nos engines).
 */
import { hash2 } from '@/lib/rng';
import type { TileType } from '@/types';
import { COLORS, withAlpha } from '@/ui/tokens';
import { tileAt, type MapMarker, type OverworldMap } from '@/world/overworld/tiles';

export const TILE_PX = 32;
export const CHUNK_TILES = 16;

/** Cor-base de cada tipo de tile (também a cor do minimapa). */
export const TILE_COLORS: Readonly<Record<TileType, string>> = {
  ROAD_PAVED: '#4b5563',
  ROAD_DIRT: '#a07850',
  TRAIL: '#8fae5d',
  GRASS: '#6fa34a',
  FOREST: '#2f6b35',
  WATER: '#2f6fa5',
  SWAMP: '#56704a',
  SAND: '#dcc68f',
  HILL: '#8d9a52',
  HILL_STEEP: '#7d6a4c',
  MOUNTAIN: '#6b6f78',
  URBAN: '#9a958c',
  BUILDING: '#b0745a',
  BRIDGE: '#8a5a32',
  SNOW: '#e5edf3',
};

type Ctx = CanvasRenderingContext2D;

/** Desenha um tile em (px, py) com o detalhe procedural do tipo. */
export function drawTile(
  ctx: Ctx,
  map: OverworldMap,
  tx: number,
  ty: number,
  px: number,
  py: number,
): void {
  const tile = tileAt(map, tx, ty);
  const T = TILE_PX;
  const r = (k: number) => hash2(tx, ty, 31 + k);
  ctx.fillStyle = TILE_COLORS[tile];
  ctx.fillRect(px, py, T, T);
  switch (tile) {
    case 'GRASS':
      ctx.fillStyle = '#5e9140';
      for (let k = 0; k < 3; k++) ctx.fillRect(px + r(k) * 26 + 2, py + r(k + 3) * 26 + 2, 2, 4);
      break;
    case 'FOREST':
      for (let k = 0; k < 3; k++) {
        const cx = px + 8 + r(k) * 16;
        const cy = py + 8 + r(k + 5) * 16;
        ctx.fillStyle = '#1f4d26';
        ctx.beginPath();
        ctx.arc(cx + 2, cy + 3, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#3f8a45';
        ctx.beginPath();
        ctx.arc(cx, cy, 7, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case 'ROAD_PAVED':
      ctx.fillStyle = '#e5e7eb';
      if ((tx + ty) % 2 === 0) ctx.fillRect(px + T / 2 - 1, py + 6, 2, T - 12);
      break;
    case 'ROAD_DIRT':
      ctx.fillStyle = '#8a6440';
      ctx.fillRect(px + 8, py, 3, T);
      ctx.fillRect(px + T - 11, py, 3, T);
      break;
    case 'TRAIL':
      ctx.fillStyle = '#b89a6a';
      for (let k = 0; k < 4; k++) ctx.fillRect(px + 6 + k * 6, py + 14 + (k % 2) * 3, 3, 3);
      break;
    case 'HILL':
      ctx.fillStyle = '#76844a';
      ctx.beginPath();
      ctx.moveTo(px + 4, py + T - 6);
      ctx.lineTo(px + T / 2, py + 8);
      ctx.lineTo(px + T - 4, py + T - 6);
      ctx.fill();
      break;
    case 'HILL_STEEP':
      ctx.strokeStyle = '#5b4a33';
      ctx.lineWidth = 2;
      for (let k = -T; k < T; k += 8) {
        ctx.beginPath();
        ctx.moveTo(px + k, py + T);
        ctx.lineTo(px + k + T, py);
        ctx.stroke();
      }
      break;
    case 'MOUNTAIN':
      ctx.fillStyle = '#4b4f57';
      ctx.beginPath();
      ctx.moveTo(px, py + T);
      ctx.lineTo(px + T / 2, py + 2);
      ctx.lineTo(px + T, py + T);
      ctx.fill();
      ctx.fillStyle = '#e5edf3';
      ctx.beginPath();
      ctx.moveTo(px + T / 2 - 5, py + 10);
      ctx.lineTo(px + T / 2, py + 2);
      ctx.lineTo(px + T / 2 + 5, py + 10);
      ctx.fill();
      break;
    case 'SWAMP':
      ctx.fillStyle = '#3f6b78';
      ctx.fillRect(px + 4 + r(1) * 10, py + 6 + r(2) * 14, 12, 6);
      ctx.fillStyle = '#3d5a2c';
      for (let k = 0; k < 3; k++)
        ctx.fillRect(px + 4 + r(k + 4) * 24, py + 4 + r(k + 7) * 20, 2, 8);
      break;
    case 'SAND':
      ctx.fillStyle = '#c9b27a';
      for (let k = 0; k < 4; k++) ctx.fillRect(px + r(k) * 30, py + r(k + 4) * 30, 2, 2);
      break;
    case 'BUILDING':
      ctx.fillStyle = '#8b5a45';
      ctx.fillRect(px + 2, py + 2, T - 4, T - 4);
      ctx.fillStyle = '#fde68a';
      for (let k = 0; k < 4; k++)
        if (r(k) > 0.4) ctx.fillRect(px + 6 + (k % 2) * 14, py + 6 + Math.floor(k / 2) * 12, 6, 6);
      break;
    case 'URBAN':
      ctx.fillStyle = '#878278';
      ctx.fillRect(px, py + T - 2, T, 2);
      break;
    case 'BRIDGE':
      ctx.fillStyle = '#6b4424';
      for (let k = 0; k < T; k += 6) ctx.fillRect(px, py + k, T, 2);
      break;
    case 'SNOW':
      ctx.fillStyle = '#ffffff';
      for (let k = 0; k < 3; k++) ctx.fillRect(px + r(k) * 28, py + r(k + 3) * 28, 3, 3);
      break;
    case 'WATER':
      break;
  }
}

export interface ChunkCanvas {
  canvas: HTMLCanvasElement;
  cx: number;
  cy: number;
}

/** Pré-renderiza o chunk (cx, cy) num canvas oculto, na resolução `scale` px por px lógico. */
export function renderChunk(map: OverworldMap, cx: number, cy: number, scale: number): ChunkCanvas {
  const canvas = document.createElement('canvas');
  const size = CHUNK_TILES * TILE_PX;
  canvas.width = Math.ceil(size * scale);
  canvas.height = Math.ceil(size * scale);
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    for (let ty = 0; ty < CHUNK_TILES; ty++) {
      for (let tx = 0; tx < CHUNK_TILES; tx++) {
        drawTile(
          ctx,
          map,
          cx * CHUNK_TILES + tx,
          cy * CHUNK_TILES + ty,
          tx * TILE_PX,
          ty * TILE_PX,
        );
      }
    }
  }
  return { canvas, cx, cy };
}

/**
 * Cache de chunks, refeito quando a resolução muda (zoom ou DPR). Guarda no máximo
 * `capacity` chunks e descarta o usado há mais tempo: cada um ocupa alguns MB.
 */
export class ChunkCache {
  private readonly chunks = new Map<string, ChunkCanvas>();
  private scale = 0;

  constructor(
    private readonly map: OverworldMap,
    private readonly capacity: number = Infinity,
  ) {}

  get(cx: number, cy: number, scale: number): ChunkCanvas {
    if (scale !== this.scale) {
      this.chunks.clear();
      this.scale = scale;
    }
    const key = `${cx},${cy}`;
    let chunk = this.chunks.get(key);
    if (chunk) {
      // Reinsere para marcar como usado agora (a ordem do Map é a de inserção).
      this.chunks.delete(key);
    } else {
      chunk = renderChunk(this.map, cx, cy, scale);
    }
    this.chunks.set(key, chunk);
    while (this.chunks.size > this.capacity) {
      const oldest = this.chunks.keys().next().value;
      if (oldest === undefined) break;
      this.chunks.delete(oldest);
    }
    return chunk;
  }

  get size(): number {
    return this.chunks.size;
  }
}

/** Ondas sobre a água visível (camada animada). */
export function drawWater(
  ctx: Ctx,
  map: OverworldMap,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  timeS: number,
): void {
  ctx.strokeStyle = 'rgba(191, 219, 254, 0.45)';
  ctx.lineWidth = 1.5;
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (tileAt(map, tx, ty) !== 'WATER') continue;
      const px = tx * TILE_PX;
      const py = ty * TILE_PX + 12 + 4 * Math.sin(timeS * 2 + tx * 0.9 + ty * 0.6);
      ctx.beginPath();
      ctx.moveTo(px + 4, py);
      ctx.quadraticCurveTo(px + 12, py - 4, px + 20, py);
      ctx.stroke();
    }
  }
}

/** Marcador ◆ pulsante (contratos). A cor por status entra com os contratos (T022). */
export function drawMarker(
  ctx: Ctx,
  marker: MapMarker,
  timeS: number,
  color: string = COLORS.radar,
): void {
  const cx = marker.x * TILE_PX + TILE_PX / 2;
  const cy = marker.y * TILE_PX + TILE_PX / 2;
  const pulse = 1 + 0.15 * Math.sin(timeS * 4);
  const s = 10 * pulse;
  ctx.fillStyle = withAlpha(color, 0.25);
  ctx.beginPath();
  ctx.arc(cx, cy, 18 * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.strokeStyle = COLORS.bgBase;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy - s);
  ctx.lineTo(cx + s, cy);
  ctx.lineTo(cx, cy + s);
  ctx.lineTo(cx - s, cy);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}
