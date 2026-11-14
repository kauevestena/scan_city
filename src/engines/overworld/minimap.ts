/** Minimapa 160 × 100 px (world-map §5.2): 1 px = 1 tile, cor média por tipo. */
import { COLORS } from '@/ui/tokens';
import type { MapMarker, OverworldMap } from '@/world/overworld/tiles';
import { TILE_COLORS } from './tileRenderer';

/** Fundo do minimapa, pré-desenhado uma vez. */
export function renderMinimapBase(map: OverworldMap): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = map.width;
  canvas.height = map.height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        ctx.fillStyle = TILE_COLORS[map.tiles[y * map.width + x] as keyof typeof TILE_COLORS];
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
  return canvas;
}

export function drawMinimap(
  ctx: CanvasRenderingContext2D,
  base: CanvasImageSource,
  markers: readonly MapMarker[],
  avatar: { x: number; y: number },
  door: { x: number; y: number },
  timeS: number,
): void {
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(base, 0, 0);
  ctx.fillStyle = COLORS.warn;
  ctx.fillRect(door.x - 1, door.y - 1, 3, 3);
  ctx.fillStyle = COLORS.radar;
  for (const m of markers) ctx.fillRect(m.x - 1, m.y - 1, 3, 3);
  ctx.fillStyle = Math.floor(timeS * 3) % 2 === 0 ? COLORS.text : COLORS.danger;
  ctx.fillRect(Math.floor(avatar.x) - 1, Math.floor(avatar.y) - 1, 3, 3);
}
