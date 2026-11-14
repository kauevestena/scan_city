/** Contrato de uma simulação dirigida pelo `GameLoop` (architecture §4). */
export interface Simulation {
  /** Avança a simulação; chamado em sub-passos de no máximo `stepS`. */
  update(dtS: number): void;
  /** Desenha, uma vez por frame. */
  render(alpha: number): void;
}

export interface GameLoopOptions {
  /** Teto do `dt` real por frame. Padrão: 0,05 s. */
  maxDtS?: number;
  /** Tamanho máximo de um sub-passo. Padrão: 1/60 s. */
  stepS?: number;
  /** Fator de aceleração do tempo (TIME_WARP). Padrão: 1. */
  timeScale?: () => number;
  /** Chamado no início de cada frame, antes dos sub-passos (ex.: `InputManager.poll`). */
  beforeFrame?: () => void;
  /** `requestAnimationFrame`/`cancelAnimationFrame` injetáveis para testes. */
  raf?: (cb: (timeMs: number) => void) => number;
  caf?: (handle: number) => void;
}

const DEFAULT_MAX_DT_S = 0.05;
const DEFAULT_STEP_S = 1 / 60;
/** Evita um sub-passo a mais por erro de ponto flutuante (0,05 · 60 = 3,0000000000000004). */
const EPSILON = 1e-9;

/** Média móvel de FPS em uma janela de 1 s. */
export class FpsMeter {
  private readonly times: number[] = [];
  private value = 0;

  /** Registra um frame no instante `timeMs` e devolve o FPS atual. */
  tick(timeMs: number): number {
    const times = this.times;
    times.push(timeMs);
    while (times.length > 2 && timeMs - (times[0] as number) > 1000) times.shift();
    const span = timeMs - (times[0] as number);
    this.value = span > 0 ? ((times.length - 1) * 1000) / span : 0;
    return this.value;
  }

  get fps(): number {
    return this.value;
  }

  reset(): void {
    this.times.length = 0;
    this.value = 0;
  }
}

/**
 * Loop de jogo sobre `requestAnimationFrame`: limita o `dt` a 50 ms e divide o tempo
 * simulado em `ceil(dt · timeScale / stepS)` sub-passos iguais (REQ-CORE-008).
 * Pausado, não chama `update`, mas continua desenhando.
 */
export class GameLoop {
  private readonly sim: Simulation;
  private readonly maxDtS: number;
  private readonly stepS: number;
  private readonly timeScale: () => number;
  private readonly beforeFrame: (() => void) | undefined;
  private readonly raf: (cb: (timeMs: number) => void) => number;
  private readonly caf: (handle: number) => void;
  private readonly meter = new FpsMeter();

  private handle: number | null = null;
  private lastTimeMs: number | null = null;
  private paused = false;

  constructor(sim: Simulation, opts: GameLoopOptions = {}) {
    this.sim = sim;
    this.maxDtS = opts.maxDtS ?? DEFAULT_MAX_DT_S;
    this.stepS = opts.stepS ?? DEFAULT_STEP_S;
    this.timeScale = opts.timeScale ?? (() => 1);
    this.beforeFrame = opts.beforeFrame;
    this.raf = opts.raf ?? ((cb) => requestAnimationFrame(cb));
    this.caf = opts.caf ?? ((h) => cancelAnimationFrame(h));
  }

  get fps(): number {
    return this.meter.fps;
  }

  get running(): boolean {
    return this.handle !== null;
  }

  get isPaused(): boolean {
    return this.paused;
  }

  start(): void {
    if (this.handle !== null) return;
    this.lastTimeMs = null;
    this.meter.reset();
    this.handle = this.raf(this.frame);
  }

  stop(): void {
    if (this.handle === null) return;
    this.caf(this.handle);
    this.handle = null;
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  private readonly frame = (timeMs: number): void => {
    if (this.handle === null) return;
    const elapsedS = this.lastTimeMs === null ? 0 : (timeMs - this.lastTimeMs) / 1000;
    this.lastTimeMs = timeMs;
    this.meter.tick(timeMs);

    this.beforeFrame?.();

    if (!this.paused) {
      const dtS = Math.min(Math.max(elapsedS, 0), this.maxDtS);
      const simS = dtS * Math.max(0, this.timeScale());
      const steps = Math.ceil(simS / this.stepS - EPSILON);
      if (steps > 0) {
        const stepS = simS / steps;
        for (let i = 0; i < steps; i++) this.sim.update(stepS);
      }
    }
    this.sim.render(1);

    // `stop()` pode ter sido chamado dentro do update/render.
    if (this.handle !== null) this.handle = this.raf(this.frame);
  };
}
