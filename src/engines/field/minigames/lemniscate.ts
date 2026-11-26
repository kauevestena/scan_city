/**
 * Mini-game de calibração da IMU (field-setup §5.4, REQ-FLD-011): seguir com o cursor o
 * ponto-guia numa lemniscata de Bernoulli. Origem no centro do canvas; y cresce para baixo.
 * Começa com uma preparação curta (o guia espera no ponto de partida e nada conta) e então o
 * guia dá 2 voltas em 20 s. O desenho escala para caber no canvas, qualquer que seja a largura
 * do painel (as coordenadas do jogo são sempre as de 480 × 300).
 */
import { LEMNISCATE_ZERO_PX, scoreLemniscate } from '@/domain/minigameScoring';
import type { Vec2 } from './bubble';

export const LEMNISCATE_CANVAS_W = 480;
export const LEMNISCATE_CANVAS_H = 300;
/** Semieixo `a` da curva, px. */
export const LEMNISCATE_A = 200;
/** Duração da parte que conta (as 2 voltas), s. */
export const LEMNISCATE_DURATION_S = 20;
/** Preparação antes do guia andar: o cursor já se mexe, mas nada é amostrado. */
export const LEMNISCATE_READY_S = 2;
export const LEMNISCATE_LAPS = 2;
export const LEMNISCATE_SAMPLE_HZ = 30;
/** Velocidade do cursor com o analógico/teclado, px/s. */
export const CURSOR_SPEED = 350;
const TRAIL_MAX = 90;

/** Ponto da curva para o parâmetro `t` (rad). */
export function lemniscatePoint(t: number, a = LEMNISCATE_A): Vec2 {
  const s = Math.sin(t);
  const k = 1 + s * s;
  return { x: (a * Math.cos(t)) / k, y: (a * s * Math.cos(t)) / k };
}

/** Posição do guia `timeS` segundos depois do início da parte que conta: 2 voltas em 20 s. */
export function guideAt(timeS: number): Vec2 {
  return lemniscatePoint((2 * Math.PI * LEMNISCATE_LAPS * timeS) / LEMNISCATE_DURATION_S);
}

export interface LemniscateInput {
  moveX: number;
  moveY: number;
  /** Posição absoluta do mouse (relativa ao centro); tem prioridade sobre os eixos. */
  pointer?: Vec2 | null;
}

export type LemniscatePhase = 'READY' | 'RUNNING' | 'DONE';

export class LemniscateSim {
  /** Tempo da parte que conta (0 durante a preparação). */
  elapsedS = 0;
  /** Preparação que falta, s. */
  readyLeftS = LEMNISCATE_READY_S;
  phase: LemniscatePhase = 'READY';
  cursor: Vec2 = guideAt(0);
  guide: Vec2 = guideAt(0);
  readonly distances: number[] = [];
  readonly cursorTrail: Vec2[] = [];
  readonly guideTrail: Vec2[] = [];
  private input: LemniscateInput = { moveX: 0, moveY: 0 };
  private sampleClock = 0;

  setInput(input: LemniscateInput): void {
    this.input = input;
  }

  update(dtS: number): void {
    if (this.phase === 'DONE' || dtS <= 0) return;
    if (this.phase === 'READY') {
      const ready = Math.min(dtS, this.readyLeftS);
      this.moveCursor(ready);
      this.readyLeftS -= ready;
      if (this.readyLeftS > 1e-9) return;
      this.readyLeftS = 0;
      this.phase = 'RUNNING';
      dtS -= ready;
      if (dtS <= 0) return;
    }
    const step = Math.min(dtS, LEMNISCATE_DURATION_S - this.elapsedS);
    this.moveCursor(step);
    this.elapsedS += step;
    this.guide = guideAt(this.elapsedS);

    // Amostragem a 30 Hz, independente do tamanho do sub-passo.
    this.sampleClock += step;
    const period = 1 / LEMNISCATE_SAMPLE_HZ;
    while (this.sampleClock >= period - 1e-9) {
      this.sampleClock -= period;
      this.distances.push(Math.hypot(this.cursor.x - this.guide.x, this.cursor.y - this.guide.y));
      this.cursorTrail.push(this.cursor);
      this.guideTrail.push(this.guide);
      if (this.cursorTrail.length > TRAIL_MAX) {
        this.cursorTrail.shift();
        this.guideTrail.shift();
      }
    }
    if (this.elapsedS >= LEMNISCATE_DURATION_S - 1e-9) this.phase = 'DONE';
  }

  /** Move o cursor pelo ponteiro ou pelos eixos, preso ao canvas. */
  private moveCursor(step: number): void {
    const { moveX, moveY, pointer } = this.input;
    if (pointer) this.cursor = pointer;
    else {
      this.cursor = {
        x: this.cursor.x + moveX * CURSOR_SPEED * step,
        // MOVE_Y positivo é "para cima".
        y: this.cursor.y - moveY * CURSOR_SPEED * step,
      };
    }
    this.cursor = {
      x: Math.max(-LEMNISCATE_CANVAS_W / 2, Math.min(LEMNISCATE_CANVAS_W / 2, this.cursor.x)),
      y: Math.max(-LEMNISCATE_CANVAS_H / 2, Math.min(LEMNISCATE_CANVAS_H / 2, this.cursor.y)),
    };
  }

  /** Score do que foi jogado até agora (final quando `phase === 'DONE'`). */
  get score(): number {
    return scoreLemniscate(this.distances);
  }
}

export interface LemniscateColors {
  bg: string;
  curve: string;
  cursor: string;
  guide: string;
}

/** Raio da zona boa em volta do guia, px (um terço da distância em que a nota zera). */
export const GUIDE_ZONE_PX = LEMNISCATE_ZERO_PX / 3;

/** Escala que leva as coordenadas do jogo (480 × 300) para um canvas de `width` × `height`. */
export function fitScale(width: number, height: number, w: number, h: number): number {
  const k = Math.min(width / w, height / h);
  return k > 0 && Number.isFinite(k) ? k : 1;
}

/**
 * Desenha o mini-game num canvas de `width` × `height` px lógicos: a cena de 480 × 300 é
 * escalada e centrada para caber inteira (o painel pode ser mais estreito que o canvas do jogo).
 */
export function drawLemniscate(
  ctx: CanvasRenderingContext2D,
  sim: LemniscateSim,
  colors: LemniscateColors,
  width: number = LEMNISCATE_CANVAS_W,
  height: number = LEMNISCATE_CANVAS_H,
): void {
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, width, height);
  const k = fitScale(width, height, LEMNISCATE_CANVAS_W, LEMNISCATE_CANVAS_H);
  ctx.save();
  ctx.translate((width - LEMNISCATE_CANVAS_W * k) / 2, (height - LEMNISCATE_CANVAS_H * k) / 2);
  ctx.scale(k, k);
  const cx = LEMNISCATE_CANVAS_W / 2;
  const cy = LEMNISCATE_CANVAS_H / 2;
  // A curva-guia, esmaecida.
  ctx.strokeStyle = colors.curve;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= 120; i++) {
    const p = lemniscatePoint((i / 120) * Math.PI * 2);
    if (i === 0) ctx.moveTo(cx + p.x, cy + p.y);
    else ctx.lineTo(cx + p.x, cy + p.y);
  }
  ctx.stroke();
  const trail = (pts: readonly Vec2[], color: string) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    pts.forEach((p, i) =>
      i === 0 ? ctx.moveTo(cx + p.x, cy + p.y) : ctx.lineTo(cx + p.x, cy + p.y),
    );
    ctx.stroke();
  };
  trail(sim.guideTrail, colors.guide);
  trail(sim.cursorTrail, colors.cursor);
  // A zona boa em volta do guia: dentro dela a deriva fica baixa.
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = colors.guide;
  ctx.beginPath();
  ctx.arc(cx + sim.guide.x, cy + sim.guide.y, GUIDE_ZONE_PX, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  if (sim.phase === 'READY') {
    // Preparação: um anel que fecha sobre o guia até ele partir.
    const r = GUIDE_ZONE_PX + 40 * (sim.readyLeftS / LEMNISCATE_READY_S);
    ctx.strokeStyle = colors.guide;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx + sim.guide.x, cy + sim.guide.y, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = colors.guide;
  ctx.beginPath();
  ctx.arc(cx + sim.guide.x, cy + sim.guide.y, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colors.cursor;
  ctx.beginPath();
  ctx.arc(cx + sim.cursor.x, cy + sim.cursor.y, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
