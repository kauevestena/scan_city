/**
 * Rastros das pontas das asas (survey-flight §5.6, ADR-034): o caminho recente da aeronave,
 * deixado para trás na direção da câmera, em dois fios claros que somem. Em tempo real: o
 * rastro tem a mesma duração na tela em qualquer velocidade do tempo.
 */
import type { AircraftKind } from '@/types';
import { projectAbs, type FlightCamera } from './projection';

/** Quanto tempo (real) o rastro fica na tela. */
export const TRAIL_S = 0.55;
/** Pontos guardados no máximo. */
export const TRAIL_POINTS = 40;
/** O rastro não chega mais perto da câmera que isto (profundidade, m). */
export const TRAIL_MIN_DEPTH_M = 6;

/** Meia envergadura (m) de onde saem os rastros, por tipo de aeronave. */
export const HALF_SPAN_M: Readonly<Record<AircraftKind, number>> = {
  BIRD: 1.3,
  MULTIROTOR: 0.9,
  FIXED_WING_VTOL: 2.2,
};

interface TrailPoint {
  atS: number;
  s: number;
  x: number;
  alt: number;
}

export class WingTrails {
  private readonly points: TrailPoint[] = [];

  /** Guarda a posição do quadro (tempo real `atS`, posição na linha `s`). */
  push(atS: number, s: number, x: number, alt: number): void {
    const last = this.points.at(-1);
    // Uma linha nova (o `s` volta para trás) começa um rastro novo.
    if (last && s < last.s - 1) this.points.length = 0;
    this.points.push({ atS, s, x, alt });
    while (this.points.length > TRAIL_POINTS) this.points.shift();
    while (this.points.length > 0 && atS - (this.points[0] as TrailPoint).atS > TRAIL_S) {
      this.points.shift();
    }
  }

  clear(): void {
    this.points.length = 0;
  }

  /**
   * Os dois rastros projetados, do mais novo para o mais velho: por ponto, x e y de cada lado e
   * a idade (0–1). A posição relativa (`s` do ponto menos o atual) leva o rastro para trás.
   */
  build(nowS: number, sNow: number, kind: AircraftKind, cam: FlightCamera): number[] {
    const out: number[] = [];
    const half = HALF_SPAN_M[kind];
    for (let i = this.points.length - 1; i >= 0; i--) {
      const p = this.points[i] as TrailPoint;
      const Z = p.s - sNow;
      if (Z + 30 < TRAIL_MIN_DEPTH_M) break;
      const l = projectAbs(p.x - half, p.alt, Z, cam);
      const r = projectAbs(p.x + half, p.alt, Z, cam);
      if (!l || !r) break;
      out.push(l.x, l.y, r.x, r.y, Math.min(1, (nowS - p.atS) / TRAIL_S));
    }
    return out;
  }
}

/** Desenha os rastros em três trechos de transparência (do novo ao velho), um traço cada. */
export function drawWingTrails(ctx: CanvasRenderingContext2D, pts: readonly number[]): void {
  const n = pts.length / 5;
  if (n < 2) return;
  ctx.save();
  ctx.lineCap = 'round';
  const levels = [
    [0, 0.34, 0.55, 2.2],
    [0.34, 0.67, 0.3, 1.6],
    [0.67, 1.01, 0.12, 1.1],
  ] as const;
  for (const [from, to, alpha, lw] of levels) {
    ctx.strokeStyle = `rgba(241, 245, 249, ${alpha})`;
    ctx.lineWidth = lw;
    ctx.beginPath();
    for (let side = 0; side < 2; side++) {
      for (let i = 0; i + 1 < n; i++) {
        const age = pts[i * 5 + 4] as number;
        if (age < from || age >= to) continue;
        ctx.moveTo(pts[i * 5 + side * 2] as number, pts[i * 5 + side * 2 + 1] as number);
        ctx.lineTo(
          pts[(i + 1) * 5 + side * 2] as number,
          pts[(i + 1) * 5 + side * 2 + 1] as number,
        );
      }
    }
    ctx.stroke();
  }
  ctx.restore();
}
