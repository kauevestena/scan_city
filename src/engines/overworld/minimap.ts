/** Minimapa 160 × 100 px (world-map §5.2): 1 px = 1 tile, cor média por tipo. */
import { COLORS } from '@/ui/tokens';
import type { MarkerView } from '@/world/overworld/markers';
import type { OverworldMap } from '@/world/overworld/tiles';
import { MARKER_COLORS, TILE_COLORS } from './tileRenderer';

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
  markers: readonly MarkerView[],
  avatar: { x: number; y: number },
  door: { x: number; y: number },
  timeS: number,
  /** Destino da navegação GNSS: uma linha do avatar até ele. */
  navTarget: { x: number; y: number } | null = null,
): void {
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(base, 0, 0);
  if (navTarget) {
    ctx.strokeStyle = COLORS.radar;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(avatar.x, avatar.y);
    ctx.lineTo(navTarget.x + 0.5, navTarget.y + 0.5);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // A sede: um quadrado âmbar de 5 px com o miolo escuro (diferente dos marcadores de 3 px).
  ctx.fillStyle = COLORS.warn;
  ctx.fillRect(door.x - 2, door.y - 3, 5, 5);
  ctx.fillStyle = COLORS.bgBase;
  ctx.fillRect(door.x - 1, door.y - 2, 3, 3);
  ctx.fillStyle = COLORS.warn;
  ctx.fillRect(door.x, door.y - 1, 1, 1);
  for (const m of markers) {
    // Fendas: violeta (verde depois de concluídas), como o portal.
    ctx.fillStyle =
      m.kind === 'RIFT'
        ? m.status === 'COMPLETED'
          ? COLORS.ok
          : COLORS.rift
        : MARKER_COLORS[m.status];
    ctx.fillRect(m.x - 1, m.y - 1, 3, 3);
  }
  ctx.fillStyle = Math.floor(timeS * 3) % 2 === 0 ? COLORS.text : COLORS.danger;
  ctx.fillRect(Math.floor(avatar.x) - 1, Math.floor(avatar.y) - 1, 3, 3);
}
