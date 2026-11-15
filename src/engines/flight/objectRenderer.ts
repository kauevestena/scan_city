/**
 * Objetos 2.5D por tipo (terrain §4, survey-flight §5.4): caixa com 3 faces, árvore, cilindros,
 * fio com catenária leve, arco, anel, feixe, perigo móvel e holofote.
 */
import type { Rgb, WorldObjectKind } from '@/types';
import { quantizedColor } from './terrainRenderer';
import { projectAbs, type FlightCamera } from './projection';

/** Menor projeção visível (px): objetos menores são omitidos. */
export const MIN_PROJECTED_PX = 1;

export interface SceneObject {
  id: number;
  kind: WorldObjectKind;
  /** Coordenadas do *run* relativas à aeronave. */
  X: number;
  Z: number;
  widthM: number;
  depthM?: number;
  heightM: number;
  baseM: number;
  color: Rgb;
  /** Extremidade 2 do fio, também no frame do *run*. */
  X2?: number;
  Z2?: number;
  /** Feixe ligado agora. */
  on?: boolean;
  /** Em 0..1, para o pulso antes de ligar. */
  pulse?: number;
  /** Anéis: já coletado (não desenhar). */
  collected?: boolean;
}

export interface ObjectContext {
  cam: FlightCamera;
  elevation: (X: number, Z: number) => number;
  fog: number;
  fogColor: Rgb;
  timeS: number;
}

const mixRgb = (a: Rgb, b: Rgb, t: number): [number, number, number] => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

function shaded(c: readonly number[], k: number): string {
  return quantizedColor((c[0] as number) * k, (c[1] as number) * k, (c[2] as number) * k);
}

/** Desenha um objeto da cena; os que não têm representação 2.5D (anel coletado etc.) são ignorados. */
export function drawSceneObject(
  ctx: CanvasRenderingContext2D,
  o: SceneObject,
  c: ObjectContext,
): void {
  if (o.collected) return;
  const ground = c.elevation(o.X, o.Z);
  const base = projectAbs(o.X, ground + o.baseM, o.Z, c.cam);
  const top = projectAbs(o.X, ground + o.baseM + o.heightM, o.Z, c.cam);
  if (!base || !top) return;
  const w = o.widthM * base.scale;
  const h = base.y - top.y;
  if (w < MIN_PROJECTED_PX && h < MIN_PROJECTED_PX) return;
  const rgb = mixRgb(o.color, c.fogColor, c.fog);
  switch (o.kind) {
    case 'TREE': {
      const trunkW = Math.max(1, w * 0.15);
      ctx.fillStyle = quantizedColor(90 * (1 - c.fog) + c.fogColor[0] * c.fog, 64, 40);
      ctx.fillRect(base.x - trunkW / 2, top.y + h * 0.5, trunkW, h * 0.5);
      ctx.fillStyle = shaded(rgb, 1);
      ctx.beginPath();
      ctx.arc(base.x, top.y + h * 0.35, Math.max(1, w / 2), 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    case 'PIPE': {
      ctx.fillStyle = shaded(rgb, 0.85);
      ctx.fillRect(base.x - w / 2, top.y, w, h);
      ctx.fillStyle = shaded(rgb, 1);
      ctx.beginPath();
      ctx.ellipse(base.x, top.y, w / 2, Math.max(1, w * 0.18), 0, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    case 'POLE': {
      ctx.strokeStyle = shaded(rgb, 0.8);
      ctx.lineWidth = Math.max(1, w);
      ctx.beginPath();
      ctx.moveTo(base.x, base.y);
      ctx.lineTo(top.x, top.y);
      ctx.stroke();
      return;
    }
    case 'WIRE': {
      if (o.X2 === undefined || o.Z2 === undefined) return;
      const ga = c.elevation(o.X, o.Z) + o.baseM;
      const gb = c.elevation(o.X2, o.Z2) + o.baseM;
      ctx.strokeStyle = shaded(rgb, 0.7);
      ctx.lineWidth = 1;
      ctx.beginPath();
      // Catenária leve: afunda 3 % do comprimento no meio.
      const steps = 8;
      const len = Math.hypot(o.X2 - o.X, o.Z2 - o.Z);
      for (let k = 0; k <= steps; k++) {
        const t = k / steps;
        const sag = 4 * t * (1 - t) * 0.03 * len;
        const p = projectAbs(
          o.X + (o.X2 - o.X) * t,
          ga + (gb - ga) * t - sag,
          o.Z + (o.Z2 - o.Z) * t,
          c.cam,
        );
        if (!p) continue;
        if (k === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      return;
    }
    case 'STONE_ARCH': {
      const col = Math.max(1, w * 0.2);
      ctx.fillStyle = shaded(rgb, 0.85);
      ctx.fillRect(base.x - w / 2, top.y, col, h);
      ctx.fillRect(base.x + w / 2 - col, top.y, col, h);
      ctx.fillStyle = shaded(rgb, 1);
      ctx.fillRect(base.x - w / 2, top.y, w, Math.max(1, h * 0.2));
      return;
    }
    case 'RING': {
      const mid = projectAbs(o.X, ground + o.baseM + o.heightM / 2, o.Z, c.cam);
      if (!mid) return;
      ctx.strokeStyle = 'rgb(251, 191, 36)';
      ctx.lineWidth = Math.max(2, 2 * mid.scale * 0.2);
      ctx.beginPath();
      ctx.ellipse(mid.x, mid.y, Math.max(2, w / 2), Math.max(2, w / 2) * 1.2, 0, 0, Math.PI * 2);
      ctx.stroke();
      return;
    }
    case 'ENERGY_BEAM': {
      const on = o.on !== false;
      const alpha = on ? 0.45 + 0.15 * Math.sin(c.timeS * 12) : 0.12 + 0.3 * (o.pulse ?? 0);
      ctx.fillStyle = `rgba(244, 114, 182, ${alpha})`;
      ctx.fillRect(base.x - w / 2, top.y, w, h);
      return;
    }
    case 'MOVING_HAZARD': {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.3)';
      ctx.beginPath();
      ctx.ellipse(base.x, base.y, w / 2, Math.max(1, w * 0.15), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = shaded(rgb, 1);
      ctx.beginPath();
      ctx.arc(base.x, top.y + h / 2, Math.max(1, w / 2), 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    case 'SEARCHLIGHT': {
      ctx.fillStyle = 'rgba(250, 204, 21, 0.25)';
      ctx.beginPath();
      ctx.ellipse(base.x, base.y, Math.max(2, w / 2), Math.max(1, w * 0.25), 0, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    default: {
      // Caixa (BUILDING, CUBE_BLOCK, TOWER…): frente ×0,85, lateral ×0,7, topo ×1,0.
      const side = Math.max(1, w * 0.18);
      ctx.fillStyle = shaded(rgb, 0.85);
      ctx.fillRect(base.x - w / 2, top.y, w, h);
      ctx.fillStyle = shaded(rgb, 0.7);
      ctx.fillRect(base.x + w / 2 - side, top.y, side, h);
      ctx.fillStyle = shaded(rgb, 1);
      ctx.fillRect(base.x - w / 2, top.y - Math.max(1, w * 0.12), w, Math.max(1, w * 0.12));
    }
  }
}
