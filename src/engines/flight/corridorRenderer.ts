/**
 * Portais do corredor (survey-flight §5.19, REQ-FLT-025): retângulos à frente da aeronave, na
 * altitude do corredor, com a zona da nota Perfeita no centro e um trilho ligando os
 * vizinhos. A draw list é pura (testável sem pixels); o desenho só a executa.
 */
import {
  corridorAltAt,
  GATE_HALF_HEIGHT,
  GATE_HALF_WIDTH,
  type CorridorProfile,
} from '@/domain/corridor';
import { LATERAL_LIMITS, VERTICAL_LIMITS } from '@/domain/execution';
import type { ShotGrade } from '@/types';
import { projectAbs, type FlightCamera } from './projection';

/** Só os portais até esta distância à frente aparecem. */
export const GATE_VIEW_M = 400;
/** No máximo tantos portais na tela. */
export const MAX_GATES = 16;
/** O portal cruzado pisca na cor da nota por este tempo. */
export const GATE_FLASH_S = 0.25;

/** Cores das notas (survey-flight §5.21). */
export const GRADE_RGB: Readonly<Record<ShotGrade, string>> = {
  PERFECT: '52, 211, 153',
  GOOD: '103, 232, 249',
  WEAK: '251, 191, 36',
  REJECTED: '244, 63, 94',
};
const GATE_RGB = '103, 232, 249';
const GATE_RGB_RIFT = '196, 181, 253';

export interface CorridorDrawInput {
  /** `s` de cada portal (frame do run). */
  gates: readonly number[];
  profile: CorridorProfile;
  /** Posição da aeronave ao longo da linha. */
  s: number;
  spacingM: number;
  heightM: number;
  cam: FlightCamera;
  rift: boolean;
  /** O portal cruzado por último, para o piscar (nada com `reduceFlashes`). */
  flash: { gateS: number; grade: ShotGrade; ageS: number } | null;
  reduceFlashes: boolean;
}

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface GateDraw {
  gateS: number;
  /** Distância à frente da aeronave. */
  Z: number;
  outer: Rect;
  /** A zona da nota Perfeita (meia largura de 0,05·S e meia altura de 0,05·H). */
  inner: Rect;
  alpha: number;
  rgb: string;
  /** O portal seguinte (o mais perto à frente) é o mais forte. */
  next: boolean;
}

function rect(
  X: number,
  halfW: number,
  alt: number,
  halfH: number,
  Z: number,
  cam: FlightCamera,
): Rect | null {
  const a = projectAbs(X - halfW, alt + halfH, Z, cam);
  const b = projectAbs(X + halfW, alt - halfH, Z, cam);
  if (!a || !b) return null;
  return { x0: a.x, y0: a.y, x1: b.x, y1: b.y };
}

/** Portais visíveis, de longe para perto. */
export function buildCorridorDrawList(i: CorridorDrawInput): GateDraw[] {
  const ahead = i.gates.filter((g) => g - i.s > 0 && g - i.s <= GATE_VIEW_M).slice(0, MAX_GATES);
  const out: GateDraw[] = [];
  ahead.forEach((gateS, k) => {
    const Z = gateS - i.s;
    const alt = corridorAltAt(i.profile, gateS);
    const outer = rect(
      0,
      GATE_HALF_WIDTH * i.spacingM,
      alt,
      GATE_HALF_HEIGHT * i.heightM,
      Z,
      i.cam,
    );
    const inner = rect(
      0,
      LATERAL_LIMITS[0] * i.spacingM,
      alt,
      VERTICAL_LIMITS[0] * i.heightM,
      Z,
      i.cam,
    );
    if (!outer || !inner) return;
    const near = 1 - Z / GATE_VIEW_M;
    out.push({
      gateS,
      Z,
      outer,
      inner,
      alpha: k === 0 ? 0.7 : 0.15 + 0.4 * near,
      rgb: i.rift ? GATE_RGB_RIFT : GATE_RGB,
      next: k === 0,
    });
  });
  return out.reverse();
}

/** Níveis de transparência dos traços: os portais do mesmo nível saem num traço só. */
export const ALPHA_LEVELS = 6;

const level = (alpha: number) => Math.max(1, Math.round(alpha * ALPHA_LEVELS));

/**
 * Executa a draw list: trilho, portais e o piscar do último cruzado. Os traços são agrupados
 * por nível de transparência: poucas chamadas de `stroke` por quadro, qualquer que seja o
 * número de portais (o raster sem GPU paga caro por traço).
 */
export function drawCorridor(
  ctx: CanvasRenderingContext2D,
  list: readonly GateDraw[],
  flash: CorridorDrawInput['flash'],
  reduceFlashes: boolean,
  width: number,
  height: number,
): void {
  if (list.length === 0) return;
  const rgb = (list[0] as GateDraw).rgb;
  ctx.save();
  // Trilho: liga os cantos de baixo dos portais vizinhos, num traço só.
  ctx.lineWidth = 1;
  ctx.strokeStyle = `rgba(${rgb}, 0.12)`;
  ctx.beginPath();
  for (let k = 1; k < list.length; k++) {
    const a = list[k - 1] as GateDraw;
    const b = list[k] as GateDraw;
    ctx.moveTo(a.outer.x0, a.outer.y1);
    ctx.lineTo(b.outer.x0, b.outer.y1);
    ctx.moveTo(a.outer.x1, a.outer.y1);
    ctx.lineTo(b.outer.x1, b.outer.y1);
  }
  ctx.stroke();
  // Portais e losangos da zona Perfeita, um traço por nível de transparência.
  const levels = new Map<number, GateDraw[]>();
  for (const g of list) {
    const k = g.next ? ALPHA_LEVELS + 1 : level(g.alpha);
    const group = levels.get(k);
    if (group) group.push(g);
    else levels.set(k, [g]);
  }
  for (const [k, group] of levels) {
    const alpha = k > ALPHA_LEVELS ? 0.7 : k / ALPHA_LEVELS;
    ctx.lineWidth = k > ALPHA_LEVELS ? 2.5 : 2;
    ctx.strokeStyle = `rgba(${rgb}, ${alpha.toFixed(3)})`;
    ctx.beginPath();
    for (const g of group) {
      ctx.rect(g.outer.x0, g.outer.y0, g.outer.x1 - g.outer.x0, g.outer.y1 - g.outer.y0);
    }
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const g of group) {
      const cx = (g.inner.x0 + g.inner.x1) / 2;
      const cy = (g.inner.y0 + g.inner.y1) / 2;
      ctx.moveTo(cx, g.inner.y0);
      ctx.lineTo(g.inner.x1, cy);
      ctx.lineTo(cx, g.inner.y1);
      ctx.lineTo(g.inner.x0, cy);
      ctx.closePath();
    }
    ctx.stroke();
  }
  // O portal cruzado pisca na cor da nota (a borda da tela, já que ele ficou para trás).
  if (flash && !reduceFlashes && flash.ageS < GATE_FLASH_S) {
    const a = 0.5 * (1 - flash.ageS / GATE_FLASH_S);
    ctx.strokeStyle = `rgba(${GRADE_RGB[flash.grade]}, ${a.toFixed(3)})`;
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, width - 6, height - 6);
  }
  ctx.restore();
}

/** Riscos de vento de uma rajada: no máximo tantos na tela. */
export const GUST_STREAKS = 40;

export interface GustView {
  side: -1 | 1;
  inS: number;
  active: boolean;
}

export interface Streak {
  x0: number;
  x1: number;
  y: number;
  alpha: number;
}

/** Fração pseudoaleatória fixa por índice (sem sorteio a cada quadro). */
const frac = (k: number, a: number, b: number) => Math.abs(Math.sin(k * a) * b) % 1;

/**
 * Riscos de vento (survey-flight §5.13): traços que cruzam a tela no sentido da rajada,
 * poucos e fracos no aviso, mais e mais fortes no sopro. Com `reduceFlashes`, o alfa não pisca.
 */
export function gustStreaks(
  width: number,
  height: number,
  horizonY: number,
  gust: GustView,
  tS: number,
  reduceFlashes: boolean,
): Streak[] {
  const count = gust.active ? GUST_STREAKS : Math.round(GUST_STREAKS * 0.4);
  const speed = gust.active ? 900 : 500;
  const base = gust.active ? 0.35 : 0.18;
  const out: Streak[] = [];
  for (let k = 0; k < count; k++) {
    const h1 = frac(k + 1, 12.9898, 43758.5453);
    const h2 = frac(k + 1, 78.233, 12543.873);
    const len = 40 + 60 * h2;
    const span = width + len;
    const travel = (h1 * span + tS * speed * (0.7 + 0.6 * h2)) % span;
    const x0 = gust.side > 0 ? travel - len : width - travel + len;
    const y = horizonY + (height - horizonY) * (0.05 + 0.9 * h1);
    const alpha = reduceFlashes ? base : base * (0.6 + 0.4 * Math.abs(Math.sin(tS * 6 + k)));
    out.push({ x0, x1: x0 + len * gust.side, y, alpha });
  }
  return out;
}

export function drawGustStreaks(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  horizonY: number,
  gust: GustView,
  tS: number,
  reduceFlashes: boolean,
): void {
  // Um traço por nível de transparência (o raster sem GPU paga caro por traço).
  const levels = new Map<number, Streak[]>();
  for (const st of gustStreaks(width, height, horizonY, gust, tS, reduceFlashes)) {
    const k = level(st.alpha * 2);
    const group = levels.get(k);
    if (group) group.push(st);
    else levels.set(k, [st]);
  }
  ctx.save();
  ctx.lineWidth = 1.5;
  for (const [k, group] of levels) {
    ctx.strokeStyle = `rgba(226, 232, 240, ${(k / ALPHA_LEVELS / 2).toFixed(3)})`;
    ctx.beginPath();
    for (const st of group) {
      ctx.moveTo(st.x0, st.y);
      ctx.lineTo(st.x1, st.y);
    }
    ctx.stroke();
  }
  ctx.restore();
}
