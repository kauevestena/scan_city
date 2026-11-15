/**
 * Vista de satélite do Field Setup (field-setup §5.1): raster gerado uma vez por terreno,
 * objetos vistos de cima com sombra conforme a iluminação escolhida e overlays por frame.
 * As cores do engine podem ser hex (REQ-UI-001 permite nos engines).
 */
import { convexHull } from '@/domain/geometry';
import { shadowLengthM } from '@/domain/flightPhysics';
import type { Contract, FlightPlan, GroundPoint, LightingId, WorldObject } from '@/types';
import { COLORS, FONTS, withAlpha } from '@/ui/tokens';
import type { TerrainSampler } from '@/world/terrain/TerrainSampler';
import {
  ACCESS_GRID,
  buildRaster,
  HILLSHADE,
  rasterSize,
  scaleBarMeters,
  shotPositions,
  toScreen,
  viewTransform,
  type SatView,
  type ViewTransform,
} from './satellite';

export interface SatOverlay {
  view: SatView;
  lighting: LightingId;
  plan: FlightPlan | null;
  points: readonly GroundPoint[];
  /** Máscara de acessibilidade (1 = inválido), `ACCESS_GRID²` células. */
  mask: Uint8Array | null;
  /** Célula sob o cursor recusada (pisca em vermelho). */
  flash?: { u: number; v: number } | null;
  hoverId?: string | null;
}

export interface RenderStats {
  linesDrawn: number;
  pointsDrawn: number;
}

const rasterCache = new WeakMap<TerrainSampler, HTMLCanvasElement>();

/** Raster em canvas, um por terreno (o sampler é memoizado por contrato). */
function rasterCanvas(terrain: TerrainSampler): HTMLCanvasElement {
  const cached = rasterCache.get(terrain);
  if (cached) return cached;
  const size = rasterSize(terrain);
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const image = ctx.createImageData(size.width, size.height);
    image.data.set(buildRaster(terrain, size));
    ctx.putImageData(image, 0, 0);
  }
  rasterCache.set(terrain, canvas);
  return canvas;
}

/** Direção da sombra (oposta ao sol de NO): para SE, em (u, v). */
const SHADOW_DIR = (() => {
  const az = (HILLSHADE.azimuthDeg * Math.PI) / 180;
  return { u: -Math.sin(az), v: Math.cos(az) };
})();

const rgb = (c: readonly [number, number, number], k = 1) =>
  `rgb(${Math.round(c[0] * k)}, ${Math.round(c[1] * k)}, ${Math.round(c[2] * k)})`;

export class SatelliteRenderer {
  private readonly lit = new Map<LightingId, HTMLCanvasElement>();
  private readonly base: HTMLCanvasElement;

  constructor(
    readonly terrain: TerrainSampler,
    private readonly contract: Pick<Contract, 'aoi' | 'wind'>,
  ) {
    this.base = rasterCanvas(terrain);
  }

  /** Raster + objetos com sombra para a iluminação; refeito ao trocar a iluminação. */
  litCanvas(lighting: LightingId): HTMLCanvasElement {
    const cached = this.lit.get(lighting);
    if (cached) return cached;
    const { width, height } = this.base;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(this.base, 0, 0);
      const { uMin, uMax, vMin, vMax } = this.terrain.bounds;
      const k = width / (uMax - uMin);
      ctx.setTransform(
        k,
        0,
        0,
        height / (vMax - vMin),
        -uMin * k,
        (-vMin * height) / (vMax - vMin),
      );
      this.drawTrails(ctx);
      for (const o of this.terrain.objects) this.drawShadow(ctx, o, lighting);
      for (const o of this.terrain.objects) this.drawObject(ctx, o);
    }
    this.lit.set(lighting, canvas);
    return canvas;
  }

  private drawTrails(ctx: CanvasRenderingContext2D): void {
    ctx.strokeStyle = 'rgba(200, 170, 120, 0.9)';
    ctx.setLineDash([3, 2]);
    for (const road of this.terrain.roads) {
      if (road.kind !== 'TRAIL') continue;
      ctx.lineWidth = road.widthM;
      ctx.beginPath();
      road.points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.u, p.v) : ctx.lineTo(p.u, p.v)));
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  private drawShadow(ctx: CanvasRenderingContext2D, o: WorldObject, lighting: LightingId): void {
    const len = shadowLengthM(o.heightM + (o.baseM ?? 0), lighting);
    if (len <= 0 || o.kind === 'WIRE') return;
    // Luz difusa não projeta sombra; com sol, a sombra é a pegada deslocada para SE.
    ctx.fillStyle = 'rgba(15, 23, 42, 0.35)';
    const du = SHADOW_DIR.u * len;
    const dv = SHADOW_DIR.v * len;
    if (o.kind === 'TREE') {
      ctx.beginPath();
      ctx.ellipse(
        o.u + du / 2,
        o.v + dv / 2,
        o.widthM / 2 + Math.abs(du) / 2,
        o.depthM / 2 + Math.abs(dv) / 2,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      return;
    }
    ctx.save();
    ctx.translate(o.u, o.v);
    ctx.rotate(o.rotationRad ?? 0);
    const hw = o.widthM / 2;
    const hd = o.depthM / 2;
    ctx.beginPath();
    ctx.moveTo(-hw, -hd);
    ctx.lineTo(hw, -hd);
    ctx.lineTo(hw + du, -hd + dv);
    ctx.lineTo(hw + du, hd + dv);
    ctx.lineTo(-hw + du, hd + dv);
    ctx.lineTo(-hw, hd);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawObject(ctx: CanvasRenderingContext2D, o: WorldObject): void {
    if (o.kind === 'WIRE') return;
    if (o.kind === 'TREE') {
      ctx.fillStyle = rgb(o.color, 0.85);
      ctx.beginPath();
      ctx.arc(o.u, o.v, o.widthM / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = rgb(o.color, 1.15);
      ctx.beginPath();
      ctx.arc(o.u - o.widthM * 0.12, o.v - o.depthM * 0.12, o.widthM * 0.3, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    ctx.save();
    ctx.translate(o.u, o.v);
    ctx.rotate(o.rotationRad ?? 0);
    ctx.fillStyle = rgb(o.color);
    ctx.fillRect(-o.widthM / 2, -o.depthM / 2, o.widthM, o.depthM);
    // Cumeeira do telhado.
    ctx.strokeStyle = rgb(o.color, 0.7);
    ctx.lineWidth = 0.4;
    ctx.beginPath();
    ctx.moveTo(-o.widthM / 2, 0);
    ctx.lineTo(o.widthM / 2, 0);
    ctx.stroke();
    ctx.restore();
  }

  render(ctx: CanvasRenderingContext2D, width: number, height: number, o: SatOverlay): RenderStats {
    const t = viewTransform(this.terrain, o.view, width, height);
    const { uMin, uMax, vMin, vMax } = this.terrain.bounds;
    ctx.fillStyle = COLORS.bgBase;
    ctx.fillRect(0, 0, width, height);
    const tl = toScreen(t, uMin, vMin);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(
      this.litCanvas(o.lighting),
      tl.x,
      tl.y,
      (uMax - uMin) * t.scale,
      (vMax - vMin) * t.scale,
    );

    if (o.mask) this.drawMask(ctx, t, o.mask);
    this.drawAoi(ctx, t);
    const linesDrawn = o.plan ? this.drawPlan(ctx, t, o.plan) : 0;
    this.drawHull(ctx, t, o.points);
    for (const p of o.points) this.drawPoint(ctx, t, p, p.id === o.hoverId);
    if (o.flash) {
      const s = toScreen(t, o.flash.u, o.flash.v);
      ctx.strokeStyle = COLORS.danger;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 10, 0, Math.PI * 2);
      ctx.stroke();
    }
    this.drawScaleBar(ctx, t, height);
    this.drawCompass(ctx, width);
    return { linesDrawn, pointsDrawn: o.points.length };
  }

  private drawMask(ctx: CanvasRenderingContext2D, t: ViewTransform, mask: Uint8Array): void {
    const { uMin, uMax, vMin, vMax } = this.terrain.bounds;
    const n = ACCESS_GRID;
    const cw = ((uMax - uMin) / n) * t.scale;
    const ch = ((vMax - vMin) / n) * t.scale;
    ctx.save();
    ctx.fillStyle = withAlpha(COLORS.danger, 0.4);
    ctx.strokeStyle = withAlpha(COLORS.danger, 0.4);
    ctx.lineWidth = 1;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        if (!mask[j * n + i]) continue;
        const p = toScreen(t, uMin + ((uMax - uMin) * i) / n, vMin + ((vMax - vMin) * j) / n);
        // Hachura diagonal na célula.
        ctx.beginPath();
        ctx.moveTo(p.x, p.y + ch);
        ctx.lineTo(p.x + cw, p.y);
        ctx.moveTo(p.x, p.y + ch / 2);
        ctx.lineTo(p.x + cw / 2, p.y);
        ctx.moveTo(p.x + cw / 2, p.y + ch);
        ctx.lineTo(p.x + cw, p.y + ch / 2);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  private drawAoi(ctx: CanvasRenderingContext2D, t: ViewTransform): void {
    const a = toScreen(t, 0, 0);
    const { lengthM, widthM } = this.contract.aoi;
    ctx.save();
    ctx.strokeStyle = COLORS.radar;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.strokeRect(a.x, a.y, lengthM * t.scale, widthM * t.scale);
    ctx.restore();
  }

  private drawPlan(ctx: CanvasRenderingContext2D, t: ViewTransform, plan: FlightPlan): number {
    ctx.save();
    let drawn = 0;
    for (const line of plan.lines) {
      const a = toScreen(t, line.start.u, line.start.v);
      const b = toScreen(t, line.end.u, line.end.v);
      const cross = line.pass === 'CROSS';
      ctx.strokeStyle = cross ? withAlpha(COLORS.warn, 0.9) : withAlpha(COLORS.radar, 0.9);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      // Seta no meio da linha.
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      ctx.fillStyle = ctx.strokeStyle;
      ctx.beginPath();
      ctx.moveTo(mx + 7 * Math.cos(ang), my + 7 * Math.sin(ang));
      ctx.lineTo(mx + 6 * Math.cos(ang + 2.5), my + 6 * Math.sin(ang + 2.5));
      ctx.lineTo(mx + 6 * Math.cos(ang - 2.5), my + 6 * Math.sin(ang - 2.5));
      ctx.closePath();
      ctx.fill();
      // Disparos estimados.
      for (const s of shotPositions(line, plan)) {
        const p = toScreen(t, s.u, s.v);
        ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
      }
      // Número da linha no início.
      ctx.font = `bold 11px ${FONTS.mono}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = COLORS.text;
      ctx.fillText(String(line.index + 1), a.x - 10 * Math.cos(ang), a.y - 10 * Math.sin(ang));
      drawn += 1;
    }
    // Pegada de exemplo: a primeira foto da linha 1.
    const first = plan.lines[0];
    const shot = first ? shotPositions(first, plan)[0] : undefined;
    if (first && shot) {
      const ang = Math.atan2(first.end.v - first.start.v, first.end.u - first.start.u);
      const c = toScreen(t, shot.u, shot.v);
      ctx.translate(c.x, c.y);
      ctx.rotate(ang);
      const along = plan.stats.footprintHM * t.scale;
      const across = plan.stats.footprintWM * t.scale;
      ctx.fillStyle = withAlpha(COLORS.radar, 0.3);
      ctx.strokeStyle = COLORS.radar;
      ctx.lineWidth = 1;
      ctx.fillRect(-along / 2, -across / 2, along, across);
      ctx.strokeRect(-along / 2, -across / 2, along, across);
    }
    ctx.restore();
    return drawn;
  }

  private drawHull(
    ctx: CanvasRenderingContext2D,
    t: ViewTransform,
    points: readonly GroundPoint[],
  ): void {
    const gcps = points.filter((p) => p.kind === 'GCP');
    if (gcps.length < 3) return;
    const hull = convexHull(gcps);
    ctx.save();
    ctx.fillStyle = withAlpha(COLORS.radar, 0.1);
    ctx.strokeStyle = withAlpha(COLORS.radar, 0.6);
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    hull.forEach((p, i) => {
      const s = toScreen(t, p.u, p.v);
      if (i === 0) ctx.moveTo(s.x, s.y);
      else ctx.lineTo(s.x, s.y);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  private drawPoint(
    ctx: CanvasRenderingContext2D,
    t: ViewTransform,
    p: GroundPoint,
    hover: boolean,
  ): void {
    const s = toScreen(t, p.u, p.v);
    const r = hover ? 9 : 7;
    ctx.save();
    if (p.kind === 'GCP') {
      // Alvo xadrez.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(s.x - r, s.y - r, 2 * r, 2 * r);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(s.x - r, s.y - r, r, r);
      ctx.fillRect(s.x, s.y, r, r);
      ctx.strokeStyle = COLORS.radar;
    } else {
      // Alvo triangular.
      ctx.fillStyle = COLORS.warn;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y - r);
      ctx.lineTo(s.x + r, s.y + r * 0.8);
      ctx.lineTo(s.x - r, s.y + r * 0.8);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = COLORS.bgBase;
    }
    ctx.lineWidth = hover ? 2 : 1;
    if (p.kind === 'GCP') ctx.strokeRect(s.x - r, s.y - r, 2 * r, 2 * r);
    else ctx.stroke();
    ctx.font = `10px ${FONTS.mono}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = COLORS.text;
    ctx.fillText(p.id, s.x + r + 3, s.y);
    ctx.restore();
  }

  private drawScaleBar(ctx: CanvasRenderingContext2D, t: ViewTransform, height: number): void {
    const meters = scaleBarMeters(t.scale);
    const px = meters * t.scale;
    const x = 16;
    const y = height - 20;
    ctx.save();
    ctx.fillStyle = withAlpha(COLORS.bgBase, 0.7);
    ctx.fillRect(x - 6, y - 16, px + 12, 26);
    ctx.strokeStyle = COLORS.text;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y - 4);
    ctx.lineTo(x, y);
    ctx.lineTo(x + px, y);
    ctx.lineTo(x + px, y - 4);
    ctx.stroke();
    ctx.font = `10px ${FONTS.mono}`;
    ctx.fillStyle = COLORS.text;
    ctx.textAlign = 'center';
    ctx.fillText(`${meters} m`, x + px / 2, y - 8);
    ctx.restore();
  }

  /** Norte e seta do vento (de onde sopra → para onde vai). */
  private drawCompass(ctx: CanvasRenderingContext2D, width: number): void {
    const cx = width - 40;
    const cy = 40;
    ctx.save();
    ctx.fillStyle = withAlpha(COLORS.bgBase, 0.7);
    ctx.beginPath();
    ctx.arc(cx, cy, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.text;
    ctx.font = `bold 10px ${FONTS.mono}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', cx, cy - 18);
    const { meanMs, directionDeg } = this.contract.wind;
    // O vento vem de `directionDeg`; a seta aponta para onde ele vai.
    const to = ((directionDeg + 180) * Math.PI) / 180;
    const dx = Math.sin(to);
    const dy = -Math.cos(to);
    ctx.strokeStyle = COLORS.warn;
    ctx.fillStyle = COLORS.warn;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - dx * 12, cy - dy * 12);
    ctx.lineTo(cx + dx * 12, cy + dy * 12);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + dx * 12, cy + dy * 12, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.text;
    ctx.fillText(`${meanMs} m/s`, cx, cy + 18);
    ctx.restore();
  }
}
