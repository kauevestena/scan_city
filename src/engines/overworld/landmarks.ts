/**
 * Marcos do mapa-múndi (world-map §5.2): a **sede da GeoSurvey**, desenhada por cima do
 * quarteirão onde fica a porta para que ela se destaque da cidade (prédio de vidro com a faixa
 * do nome, a antena GNSS no telhado, o mastro com a luz piscando e a porta acesa), e a **seta
 * da navegação GNSS** em volta do avatar. Coordenadas de mundo em px (1 tile = `TILE_PX`).
 */
import { STRINGS } from '@/data/strings';
import { TILE_PX } from './tileRenderer';

type Ctx = CanvasRenderingContext2D;

/** Pegada da sede em tiles, em relação à porta: 4 tiles para cada lado e 3 para cima. */
export const HQ_HALF_TILES = 4;
export const HQ_HEIGHT_TILES = 3;

/** Retângulo da sede em px de mundo (o prédio; a porta fica no meio da borda de baixo). */
export function hqRect(door: { x: number; y: number }): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  const T = TILE_PX;
  return {
    x: (door.x - HQ_HALF_TILES) * T + T / 2,
    y: (door.y - HQ_HEIGHT_TILES) * T + 4,
    w: HQ_HALF_TILES * 2 * T,
    h: HQ_HEIGHT_TILES * T - 4,
  };
}

/** A sede. `animate` falso (reduzir flashes): a luz do mastro fica acesa e a porta não pulsa. */
export function drawHeadquarters(
  ctx: Ctx,
  door: { x: number; y: number },
  timeS: number,
  animate: boolean,
): void {
  const T = TILE_PX;
  const r = hqRect(door);
  ctx.save();
  // Sombra no chão.
  ctx.fillStyle = 'rgba(2, 6, 23, 0.35)';
  ctx.fillRect(r.x + 6, r.y + 8, r.w, r.h);
  // Corpo de vidro e as janelas acesas.
  ctx.fillStyle = '#0f3d4a';
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = '#155e75';
  ctx.fillRect(r.x, r.y, r.w, 6);
  ctx.fillStyle = 'rgba(103, 232, 249, 0.55)';
  for (let wy = r.y + 30; wy < r.y + r.h - 12; wy += 12) {
    for (let wx = r.x + 6; wx < r.x + r.w - 8; wx += 14) {
      // A coluna da porta fica livre.
      if (Math.abs(wx + 4 - (door.x * T + T / 2)) < 14) continue;
      ctx.fillRect(wx, wy, 8, 6);
    }
  }
  // Faixa do nome.
  ctx.fillStyle = '#22d3ee';
  ctx.fillRect(r.x + 8, r.y + 10, r.w - 16, 14);
  ctx.fillStyle = '#082f49';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(STRINGS.world.hqSign, r.x + r.w / 2, r.y + 17.5);
  // Antena GNSS no telhado (o prato e o mastro) e o mastro com a luz.
  const dishX = r.x + 22;
  const dishY = r.y - 2;
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(dishX, r.y);
  ctx.lineTo(dishX, dishY - 6);
  ctx.stroke();
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.ellipse(dishX, dishY - 10, 11, 6, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#94a3b8';
  ctx.beginPath();
  ctx.arc(dishX + 2, dishY - 11, 2, 0, Math.PI * 2);
  ctx.fill();
  const mastX = r.x + r.w - 18;
  ctx.strokeStyle = '#cbd5e1';
  ctx.beginPath();
  ctx.moveTo(mastX, r.y);
  ctx.lineTo(mastX, r.y - 22);
  ctx.stroke();
  const on = !animate || Math.floor(timeS * 1.5) % 2 === 0;
  ctx.fillStyle = on ? '#f43f5e' : '#7f1d1d';
  ctx.beginPath();
  ctx.arc(mastX, r.y - 23, 3, 0, Math.PI * 2);
  ctx.fill();
  // A porta acesa, com um anel que pulsa.
  const dx = door.x * T + T / 2;
  const dy = door.y * T + T / 2;
  ctx.fillStyle = '#fbbf24';
  ctx.fillRect(dx - 7, r.y + r.h - 16, 14, 16);
  const k = animate ? (timeS * 0.8) % 1 : 0.5;
  ctx.strokeStyle = `rgba(251, 191, 36, ${(0.8 * (1 - k)).toFixed(3)})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(dx, dy, 8 + 14 * k, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** Raio (px de mundo) da seta GNSS em volta do avatar. */
export const NAV_RING_PX = 30;

/**
 * Seta da navegação GNSS: um chevron ciano a `NAV_RING_PX` do avatar, apontando para o
 * destino (`angleRad`: 0 = leste, π/2 = sul), que respira devagar (parado com `animate` falso).
 */
export function drawNavArrow(
  ctx: Ctx,
  avatarPx: { x: number; y: number },
  angleRad: number,
  timeS: number,
  animate: boolean,
): void {
  const pulse = animate ? 3 * Math.sin(timeS * 4) : 0;
  const r = NAV_RING_PX + pulse;
  const cx = avatarPx.x + Math.cos(angleRad) * r;
  const cy = avatarPx.y + Math.sin(angleRad) * r;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angleRad);
  ctx.fillStyle = '#22d3ee';
  ctx.strokeStyle = '#082f49';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(10, 0);
  ctx.lineTo(-6, -8);
  ctx.lineTo(-2, 0);
  ctx.lineTo(-6, 8);
  ctx.closePath();
  ctx.stroke();
  ctx.fill();
  ctx.restore();
}
