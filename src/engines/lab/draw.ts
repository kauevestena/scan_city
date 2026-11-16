/** Primitivas de desenho comuns aos diagramas do Laboratório (Canvas 2D). */
import { COLORS, FONTS } from '@/ui/tokens';

export interface TextOptions {
  color?: string;
  size?: number;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  mono?: boolean;
  bold?: boolean;
}

export function text(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  {
    color = COLORS.text,
    size = 12,
    align = 'center',
    baseline = 'middle',
    mono = false,
    bold = false,
  }: TextOptions = {},
): void {
  ctx.font = `${bold ? 'bold ' : ''}${size}px ${mono ? FONTS.mono : FONTS.sans}`;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillStyle = color;
  ctx.fillText(value, x, y);
}

export function line(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  width = 1,
  dash: readonly number[] = [],
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash([...dash]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.setLineDash([]);
}

export function dot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  hollow = false,
): void {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  if (hollow) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } else {
    ctx.fillStyle = color;
    ctx.fill();
  }
}

/** Linha de cota horizontal ou vertical com travessões nas pontas e o rótulo ao lado. */
export function dimension(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  label: string,
  color: string,
  labelOffset = 12,
): void {
  line(ctx, x1, y1, x2, y2, color, 1);
  const horizontal = Math.abs(y2 - y1) < Math.abs(x2 - x1);
  const tick = 4;
  if (horizontal) {
    line(ctx, x1, y1 - tick, x1, y1 + tick, color);
    line(ctx, x2, y2 - tick, x2, y2 + tick, color);
    text(ctx, label, (x1 + x2) / 2, y1 + labelOffset, { color, size: 11, mono: true });
  } else {
    line(ctx, x1 - tick, y1, x1 + tick, y1, color);
    line(ctx, x2 - tick, y2, x2 + tick, y2, color);
    // Deslocamento negativo põe o rótulo do lado esquerdo da cota.
    text(ctx, label, x1 + labelOffset, (y1 + y2) / 2, {
      color,
      size: 11,
      mono: true,
      align: labelOffset >= 0 ? 'left' : 'right',
    });
  }
}

export function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}
