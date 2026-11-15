/**
 * Sprites das aeronaves (survey-flight §5.6), desenhados em Z = 0, vistos de trás.
 * Atlas: corpo oval, asas batendo (frequência ∝ v), cabeça com bico e acessório.
 */
import type { AircraftKind } from '@/types';

export interface SpriteColors {
  primary: string;
  secondary: string;
}

export interface SpriteParams {
  kind: AircraftKind;
  x: number;
  y: number;
  /** px por metro na distância da aeronave. */
  scale: number;
  timeS: number;
  speedMs: number;
  /** Inclinação visual: `MOVE_X × 20°`. */
  bankRad: number;
  colors: SpriteColors;
  /** Acessório do Atlas (cores), se houver. */
  accessory?: SpriteColors | null;
  /** Translúcida (invulnerável com `reduceFlashes`). */
  alpha?: number;
  /** Tamanho da unidade do desenho em px (miniaturas); por padrão, pela escala. */
  unitPx?: number;
}

/** Sombra no chão, menor quanto maior o AGL. */
export function drawGroundShadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  aglM: number,
): void {
  const r = Math.max(2, (scale * 1.6) / (1 + aglM / 40));
  ctx.fillStyle = 'rgba(2, 6, 23, 0.3)';
  ctx.beginPath();
  ctx.ellipse(x, y, r * 1.6, r * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawAtlas(ctx: CanvasRenderingContext2D, p: SpriteParams, u: number): void {
  // Asas: batida com frequência proporcional à velocidade.
  const flap = Math.sin(p.timeS * (4 + p.speedMs * 0.8)) * 0.5;
  ctx.fillStyle = p.colors.secondary;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * u * 0.3, 0);
    ctx.quadraticCurveTo(side * u * 1.3, -u * (0.4 + flap), side * u * 1.9, u * (0.1 - flap * 0.6));
    ctx.quadraticCurveTo(side * u * 1.1, u * 0.3, side * u * 0.3, u * 0.25);
    ctx.closePath();
    ctx.fill();
  }
  // Corpo oval e cabeça com bico.
  ctx.fillStyle = p.colors.primary;
  ctx.beginPath();
  ctx.ellipse(0, u * 0.1, u * 0.45, u * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, -u * 0.55, u * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.moveTo(-u * 0.08, -u * 0.6);
  ctx.lineTo(u * 0.08, -u * 0.6);
  ctx.lineTo(0, -u * 0.85);
  ctx.closePath();
  ctx.fill();
  if (p.accessory) {
    // Cachecol/óculos simplificados: uma faixa no pescoço.
    ctx.fillStyle = p.accessory.primary;
    ctx.fillRect(-u * 0.32, -u * 0.32, u * 0.64, u * 0.14);
  }
}

function drawMultirotor(ctx: CanvasRenderingContext2D, p: SpriteParams, u: number): void {
  ctx.strokeStyle = p.colors.secondary;
  ctx.lineWidth = Math.max(1, u * 0.12);
  ctx.beginPath();
  ctx.moveTo(-u, -u * 0.5);
  ctx.lineTo(u, u * 0.5);
  ctx.moveTo(u, -u * 0.5);
  ctx.lineTo(-u, u * 0.5);
  ctx.stroke();
  const spin = p.timeS * 40;
  for (const [hx, hy] of [
    [-u, -u * 0.5],
    [u, -u * 0.5],
    [-u, u * 0.5],
    [u, u * 0.5],
  ] as const) {
    ctx.fillStyle = `rgba(226, 232, 240, ${0.25 + 0.1 * Math.sin(spin + hx)})`;
    ctx.beginPath();
    ctx.ellipse(hx, hy, u * 0.55, u * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = p.colors.primary;
  ctx.fillRect(-u * 0.35, -u * 0.25, u * 0.7, u * 0.5);
}

function drawVtol(ctx: CanvasRenderingContext2D, p: SpriteParams, u: number): void {
  ctx.fillStyle = p.colors.primary;
  ctx.fillRect(-u * 2.4, -u * 0.08, u * 4.8, u * 0.22);
  ctx.beginPath();
  ctx.ellipse(0, 0, u * 0.3, u * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = p.colors.secondary;
  ctx.lineWidth = Math.max(1, u * 0.12);
  ctx.beginPath();
  ctx.moveTo(0, -u * 0.2);
  ctx.lineTo(-u * 0.6, -u * 0.8);
  ctx.moveTo(0, -u * 0.2);
  ctx.lineTo(u * 0.6, -u * 0.8);
  ctx.stroke();
}

export function drawAircraft(ctx: CanvasRenderingContext2D, p: SpriteParams): void {
  // Unidade do desenho: ~0,6 m de envergadura por "u", com um mínimo legível.
  const u = p.unitPx ?? Math.max(10, p.scale * 0.6);
  ctx.save();
  ctx.globalAlpha = p.alpha ?? 1;
  ctx.translate(p.x, p.y);
  ctx.rotate(p.bankRad);
  if (p.kind === 'BIRD') drawAtlas(ctx, p, u);
  else if (p.kind === 'MULTIROTOR') drawMultirotor(ctx, p, u);
  else drawVtol(ctx, p, u);
  ctx.restore();
}
