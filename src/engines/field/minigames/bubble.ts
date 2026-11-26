/**
 * Mini-game de nivelamento (field-setup §5.4, REQ-FLD-010): uma bolha derivando num nível
 * circular. Coordenadas em px com a origem no centro do alvo; y cresce para baixo.
 */
import { hashString, mulberry32, type Rng } from '@/lib/rng';
import { valueNoise2D, type Noise2D } from '@/world/terrain/noise';
import {
  BUBBLE_LOCK_S,
  BUBBLE_TARGET_R,
  BUBBLE_WINDOW_S,
  scoreBubble,
  type BubbleSample,
} from '@/domain/minigameScoring';

/** Lado do canvas do mini-game, px. */
export const BUBBLE_CANVAS_PX = 360;
export const BUBBLE_RADIUS_PX = 14;
/** A bolha fica presa a este raio. */
export const BUBBLE_LIMIT_PX = 150;
const DRAG = 2.5;
const DRIFT_ACCEL = 120;
/** Velocidade com que o campo de deriva muda (ciclos de ruído por segundo). */
const DRIFT_RATE = 0.35;
const KICK_ACCEL = 250;
const KICK_DURATION_S = 0.2;
const KICK_MIN_S = 1.5;
const KICK_MAX_S = 3;
export const INPUT_ACCEL = 400;
/** Arrastar com o mouse: aceleração cheia a partir desta distância ao ponteiro, px. */
const POINTER_FULL_PX = 60;

export interface Vec2 {
  x: number;
  y: number;
}

export type BubblePhase = 'RUNNING' | 'DONE';

/** Entrada por frame: eixos MOVE (−1..1) e, opcionalmente, o ponteiro arrastado. */
export interface BubbleInput {
  moveX: number;
  moveY: number;
  pointer?: Vec2 | null;
}

export class BubbleSim {
  pos: Vec2 = { x: 0, y: 0 };
  vel: Vec2 = { x: 0, y: 0 };
  phase: BubblePhase = 'RUNNING';
  /** Tempo decorrido da janela, s. */
  elapsedS = 0;
  /** Tempo seguido dentro do alvo, s. */
  holdS = 0;
  /** `true` se o jogo terminou por "travar o nível". */
  locked = false;
  readonly samples: BubbleSample[] = [];
  private readonly rng: Rng;
  private readonly noise: Noise2D;
  private kick: Vec2 = { x: 0, y: 0 };
  private kickLeftS = 0;
  private nextKickS: number;
  private input: BubbleInput = { moveX: 0, moveY: 0 };

  constructor(seed: number) {
    this.rng = mulberry32(seed ^ hashString('bubble'));
    this.noise = valueNoise2D(this.rng.int(0, 0x7fffffff));
    // O estado inicial é ligeiramente deslocado: a bolha nunca começa já travada.
    const a = this.rng.range(0, Math.PI * 2);
    this.pos = { x: Math.cos(a) * 40, y: Math.sin(a) * 40 };
    this.nextKickS = this.rng.range(KICK_MIN_S, KICK_MAX_S);
  }

  /** Distância da bolha ao centro, px. */
  get distance(): number {
    return Math.hypot(this.pos.x, this.pos.y);
  }

  /** Define a entrada que vale até a próxima chamada. */
  setInput(input: BubbleInput): void {
    this.input = input;
  }

  update(dtS: number): void {
    if (this.phase === 'DONE' || dtS <= 0) return;
    const step = Math.min(dtS, BUBBLE_WINDOW_S - this.elapsedS);
    this.integrate(step);
    this.samples.push({ d: this.distance, dtS: step });
    this.elapsedS += step;
    this.holdS = this.distance <= BUBBLE_TARGET_R ? this.holdS + step : 0;
    if (this.holdS >= BUBBLE_LOCK_S) {
      this.locked = true;
      this.phase = 'DONE';
    } else if (this.elapsedS >= BUBBLE_WINDOW_S - 1e-9) {
      this.phase = 'DONE';
    }
  }

  /** Score do que foi jogado até agora (final quando `phase === 'DONE'`). */
  get score(): number {
    return scoreBubble(this.samples);
  }

  private integrate(dtS: number): void {
    // Deriva lenta: o ruído varia no tempo; cada eixo lê uma faixa distinta.
    const t = this.elapsedS * DRIFT_RATE;
    const driftX = this.noise(t, 0.5) * DRIFT_ACCEL;
    const driftY = this.noise(t, 100.5) * DRIFT_ACCEL;

    this.nextKickS -= dtS;
    if (this.nextKickS <= 0) {
      const a = this.rng.range(0, Math.PI * 2);
      this.kick = { x: Math.cos(a) * KICK_ACCEL, y: Math.sin(a) * KICK_ACCEL };
      this.kickLeftS = KICK_DURATION_S;
      this.nextKickS = this.rng.range(KICK_MIN_S, KICK_MAX_S);
    }
    const kicking = this.kickLeftS > 0;
    if (kicking) this.kickLeftS -= dtS;

    const { moveX, moveY, pointer } = this.input;
    let fx = moveX * INPUT_ACCEL;
    let fy = moveY * INPUT_ACCEL;
    if (pointer) {
      const dx = pointer.x - this.pos.x;
      const dy = pointer.y - this.pos.y;
      const gain = Math.min(1, Math.hypot(dx, dy) / POINTER_FULL_PX);
      const len = Math.hypot(dx, dy) || 1;
      fx = (dx / len) * gain * INPUT_ACCEL;
      fy = (dy / len) * gain * INPUT_ACCEL;
    }

    const ax = driftX + (kicking ? this.kick.x : 0) + fx - DRAG * this.vel.x;
    const ay = driftY + (kicking ? this.kick.y : 0) + fy - DRAG * this.vel.y;
    this.vel = { x: this.vel.x + ax * dtS, y: this.vel.y + ay * dtS };
    this.pos = { x: this.pos.x + this.vel.x * dtS, y: this.pos.y + this.vel.y * dtS };

    // Preso ao raio máximo: a componente radial da velocidade se anula na borda.
    const d = this.distance;
    if (d > BUBBLE_LIMIT_PX) {
      const nx = this.pos.x / d;
      const ny = this.pos.y / d;
      this.pos = { x: nx * BUBBLE_LIMIT_PX, y: ny * BUBBLE_LIMIT_PX };
      const radial = this.vel.x * nx + this.vel.y * ny;
      if (radial > 0) this.vel = { x: this.vel.x - radial * nx, y: this.vel.y - radial * ny };
    }
  }
}

/**
 * Desenha o nível: anel limite, alvo central e a bolha. `colors` vem dos tokens da tela
 * (nada de hex solto na UI).
 */
export interface BubbleColors {
  ring: string;
  target: string;
  targetActive: string;
  bubble: string;
  bg: string;
}

/**
 * Desenha o nível num canvas de `sizePx` px lógicos de lado: a cena de 360 × 360 escala para
 * caber (o painel pode ser mais estreito que o canvas do jogo).
 */
export function drawBubble(
  ctx: CanvasRenderingContext2D,
  sim: BubbleSim,
  colors: BubbleColors,
  sizePx: number = BUBBLE_CANVAS_PX,
): void {
  const c = BUBBLE_CANVAS_PX / 2;
  ctx.clearRect(0, 0, sizePx, sizePx);
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, sizePx, sizePx);
  const k = sizePx > 0 ? sizePx / BUBBLE_CANVAS_PX : 1;
  ctx.save();
  ctx.scale(k, k);
  ctx.lineWidth = 2;
  ctx.strokeStyle = colors.ring;
  ctx.beginPath();
  ctx.arc(c, c, BUBBLE_LIMIT_PX + BUBBLE_RADIUS_PX, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = sim.distance <= BUBBLE_TARGET_R ? colors.targetActive : colors.target;
  ctx.beginPath();
  ctx.arc(c, c, BUBBLE_TARGET_R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(c - 6, c);
  ctx.lineTo(c + 6, c);
  ctx.moveTo(c, c - 6);
  ctx.lineTo(c, c + 6);
  ctx.stroke();
  ctx.fillStyle = colors.bubble;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.arc(c + sim.pos.x, c + sim.pos.y, BUBBLE_RADIUS_PX, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();
}
