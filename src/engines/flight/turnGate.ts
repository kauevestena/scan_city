/**
 * Portal da curva (survey-flight §5.7, ADR-035): uma seta grande no fim da linha, na altitude do
 * corredor, apontando para o lado da próxima faixa. Ela aparece de longe e acende quando a
 * aeronave entra na janela da manobra; a manobra no tempo a deixa verde, e a curva perdida, rosa.
 * A draw list é pura (testável sem pixels); o desenho só a executa.
 */
import type { TurnResult, TurnWindow } from '@/domain/turnManeuver';
import { projectAbs, type FlightCamera } from './projection';

/** A seta aparece a partir desta distância à frente. */
export const TURN_GATE_VIEW_M = 450;
/** Âmbar (a curva pedida), verde (no tempo) e rosa (perdida). */
export const TURN_GATE_RGB = {
  WAITING: '251, 191, 36',
  DONE: '52, 211, 153',
  MISSED: '244, 63, 94',
};

export interface TurnGateInput {
  /** Distância do portal à frente da aeronave (m). */
  Z: number;
  /** Altitude do corredor no portal. */
  alt: number;
  side: -1 | 1;
  spacingM: number;
  heightM: number;
  cam: FlightCamera;
  /** Segundos reais até o portal (negativo depois dele). */
  toGateS: number;
  window: TurnWindow;
  judged: TurnResult | null;
  /** Relógio (s reais) para o pulso. */
  timeS: number;
  reduceFlashes: boolean;
}

export interface TurnGateDraw {
  /** O contorno da seta projetado (x, y, …). */
  points: number[];
  rgb: string;
  fillAlpha: number;
  strokeAlpha: number;
  lineWidth: number;
  /** A aeronave está na janela da manobra. */
  inWindow: boolean;
}

/** Meia largura e meia altura da seta (m): proporcionais à faixa e à altura de voo. */
export function turnArrowSize(spacingM: number, heightM: number): { halfW: number; halfH: number } {
  return { halfW: Math.max(6, 0.22 * spacingM), halfH: Math.max(3, 0.1 * heightM) };
}

/**
 * A seta da curva: haste e ponta, no plano de frente para a câmera, apontando para `side`
 * (cantos em sentido horário a partir do de baixo da haste).
 */
export function turnArrowShape(
  side: -1 | 1,
  halfW: number,
  halfH: number,
): Array<[number, number]> {
  const t = 0.35 * halfH;
  const neck = 0.2 * halfW;
  const pts: Array<[number, number]> = [
    [-halfW, -t],
    [neck, -t],
    [neck, -halfH],
    [halfW, 0],
    [neck, halfH],
    [neck, t],
    [-halfW, t],
  ];
  return pts.map(([x, y]) => [x * side, y]);
}

/** A seta à vista, ou `null` (atrás da câmera, longe demais ou já passada). */
export function buildTurnGate(i: TurnGateInput): TurnGateDraw | null {
  if (!(i.Z > 1) || i.Z > TURN_GATE_VIEW_M) return null;
  const { halfW, halfH } = turnArrowSize(i.spacingM, i.heightM);
  const points: number[] = [];
  for (const [x, y] of turnArrowShape(i.side, halfW, halfH)) {
    const p = projectAbs(x, i.alt + y, i.Z, i.cam);
    if (!p) return null;
    points.push(p.x, p.y);
  }
  const inWindow = i.toGateS <= i.window.earlyS && i.toGateS >= -i.window.lateS;
  const pulse = i.reduceFlashes ? 0.5 : 0.5 + 0.5 * Math.sin(i.timeS * 12);
  const near = 1 - i.Z / TURN_GATE_VIEW_M;
  if (i.judged === 'ON_TIME') {
    return {
      points,
      rgb: TURN_GATE_RGB.DONE,
      fillAlpha: 0.35,
      strokeAlpha: 0.95,
      lineWidth: 3,
      inWindow,
    };
  }
  if (i.judged !== null) {
    return {
      points,
      rgb: TURN_GATE_RGB.MISSED,
      fillAlpha: 0.2,
      strokeAlpha: 0.8,
      lineWidth: 2.5,
      inWindow,
    };
  }
  return {
    points,
    rgb: TURN_GATE_RGB.WAITING,
    fillAlpha: inWindow ? 0.25 + 0.2 * pulse : 0.08 + 0.1 * near,
    strokeAlpha: inWindow ? 0.75 + 0.25 * pulse : 0.35 + 0.45 * near,
    lineWidth: inWindow ? 3.5 : 2,
    inWindow,
  };
}

/** Executa a seta: o preenchimento translúcido e o contorno (duas chamadas). */
export function drawTurnGate(ctx: CanvasRenderingContext2D, g: TurnGateDraw | null): void {
  if (!g || g.points.length < 6) return;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(g.points[0] as number, g.points[1] as number);
  for (let k = 2; k < g.points.length; k += 2) {
    ctx.lineTo(g.points[k] as number, g.points[k + 1] as number);
  }
  ctx.closePath();
  ctx.fillStyle = `rgba(${g.rgb}, ${g.fillAlpha.toFixed(3)})`;
  ctx.fill();
  ctx.strokeStyle = `rgba(${g.rgb}, ${g.strokeAlpha.toFixed(3)})`;
  ctx.lineWidth = g.lineWidth;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.restore();
}
