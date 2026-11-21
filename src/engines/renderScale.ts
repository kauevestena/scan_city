/**
 * Resolução adaptativa dos canvases pesados, o voo e a mesa (ADR-033, REQ-NFR-001). A escala do
 * buffer (px do buffer por px de CSS; o `devicePixelRatio` numa tela comum) começa no teto da
 * qualidade e cai um degrau quando a janela de quadros (1,5 s) fecha abaixo de 54 FPS. Depois de
 * 3 s seguidos a 58 FPS ou mais, tenta subir um degrau; se a subida não se segura (cai de novo logo
 * em seguida), a espera da próxima tentativa dobra, até 1 min. Uma descida só fica se ajudou:
 * quando a janela seguinte não ganha 5 % de FPS (o navegador limitado a 30 Hz pela economia de
 * energia, ou o gargalo no JS e não nos pixels), a escala volta e as descidas param por 30 s.
 * O HUD é DOM e não muda: só o desenho do canvas fica mais suave.
 */
import type { Quality } from './flight/projection';

/** Um degrau: a escala nova é a anterior vezes isto (descendo) ou dividida (subindo). */
export const SCALE_STEP = 0.8;
/** Abaixo disto (média da janela), desce um degrau. */
export const SLOW_FPS = 54;
/** A partir disto, a janela conta como folga para subir. */
export const FAST_FPS = 58;
/** Duração de uma janela de medição. */
export const WINDOW_MS = 1500;
/** Folga seguida antes de tentar subir (multiplicada pela espera acumulada). */
export const UP_AFTER_MS = 3000;
/** Uma descida até este tempo depois de uma subida a desfaz e dobra a espera. */
export const FAILED_UP_MS = 3500;
/** A espera para subir não passa disto. */
export const MAX_UP_WAIT_MS = 60_000;
/** Uma descida que não ganha isto de FPS na janela seguinte é desfeita. */
export const MIN_GAIN = 1.05;
/** Depois de desfazer uma descida inútil, não desce de novo por este tempo. */
export const DOWN_LOCK_MS = 30_000;
/** Intervalos maiores que isto (aba em segundo plano, travada) não entram na média. */
export const MAX_FRAME_MS = 250;

/**
 * Teto da escala por qualidade: a Alta usa a densidade inteira da tela, a Média até 1,5 e a
 * Baixa até 1 px de buffer por px de CSS.
 */
export function renderScaleCap(quality: Quality, dpr: number): number {
  const d = dpr > 0 ? dpr : 1;
  if (quality === 'HIGH') return d;
  return Math.min(d, quality === 'MEDIUM' ? 1.5 : 1);
}

export class RenderScaleGovernor {
  private current: number;
  private cap: number;
  private floor: number;
  private windowMs = 0;
  private frames = 0;
  private clockMs = 0;
  private steadyMs = 0;
  private upWaitMs = UP_AFTER_MS;
  private lastUpAtMs = -Infinity;
  /** A descida em teste: a escala de antes e o FPS que a motivou. */
  private trial: { from: number; fps: number } | null = null;
  private downLockedUntilMs = -Infinity;

  constructor(cap: number, floor: number, initial = cap) {
    this.cap = cap;
    this.floor = Math.min(floor, cap);
    this.current = this.clamp(initial);
  }

  /** Escala de agora. */
  get scale(): number {
    return this.current;
  }

  /**
   * Troca o teto (a qualidade ou a tela mudou). Um teto maior (o jogador subiu a qualidade)
   * leva a escala até ele, e o governador ajusta dali; um menor só a limita.
   */
  setLimits(cap: number, floor: number): number {
    const raised = cap > this.cap;
    this.cap = cap;
    this.floor = Math.min(floor, cap);
    this.current = this.clamp(raised ? cap : this.current);
    this.trial = null;
    this.resetWindow();
    return this.current;
  }

  /**
   * Conta o intervalo entre dois quadros (ms). Devolve a escala nova quando ela muda, ou `null`.
   * Cada mudança zera a janela: a escala nova é medida do zero.
   */
  sample(intervalMs: number): number | null {
    if (!(intervalMs > 0) || intervalMs > MAX_FRAME_MS) return null;
    this.clockMs += intervalMs;
    this.windowMs += intervalMs;
    this.frames++;
    if (this.windowMs < WINDOW_MS) return null;
    const fps = (this.frames * 1000) / this.windowMs;
    const windowMs = this.windowMs;
    this.resetWindow();

    // A descida anterior ajudou? Se não, volta e para de descer por um tempo.
    const trial = this.trial;
    this.trial = null;
    if (trial && fps < trial.fps * MIN_GAIN) {
      this.steadyMs = 0;
      this.downLockedUntilMs = this.clockMs + DOWN_LOCK_MS;
      return this.change(trial.from);
    }

    if (fps < SLOW_FPS) {
      this.steadyMs = 0;
      if (this.current <= this.floor || this.clockMs < this.downLockedUntilMs) return null;
      // A subida não se segurou: volta (sem teste, a escala de baixo já se provou) e espera o
      // dobro antes de tentar de novo.
      if (this.clockMs - this.lastUpAtMs <= FAILED_UP_MS) {
        this.upWaitMs = Math.min(MAX_UP_WAIT_MS, this.upWaitMs * 2);
        return this.change(this.current * SCALE_STEP);
      }
      const from = this.current;
      const next = this.change(this.current * SCALE_STEP);
      if (next !== null) this.trial = { from, fps };
      return next;
    }
    if (fps < FAST_FPS) {
      this.steadyMs = 0;
      return null;
    }
    this.steadyMs += windowMs;
    if (this.steadyMs < this.upWaitMs || this.current >= this.cap) return null;
    this.steadyMs = 0;
    this.lastUpAtMs = this.clockMs;
    return this.change(this.current / SCALE_STEP);
  }

  private change(next: number): number | null {
    const v = this.clamp(next);
    if (Math.abs(v - this.current) < 1e-9) return null;
    this.current = v;
    return v;
  }

  /** Dentro de [piso, teto], e grudado num deles quando fica a menos de 3 % (sem degrau inútil). */
  private clamp(v: number): number {
    if (v >= this.cap * 0.97) return this.cap;
    if (v <= this.floor * 1.03) return this.floor;
    return v;
  }

  private resetWindow(): void {
    this.windowMs = 0;
    this.frames = 0;
  }
}
