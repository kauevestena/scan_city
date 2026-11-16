import { clamp } from '@/lib/math';
import { mulberry32 } from '@/lib/rng';
import {
  LOOPS,
  SFX,
  type LoopHandle,
  type LoopId,
  type LoopVoice,
  type MotorVariant,
  type SfxId,
} from './sfx';

export type { LoopHandle, LoopId, MotorVariant, SfxId } from './sfx';

/** Limite de vozes one-shot simultâneas (audio §1). */
export const MAX_VOICES = 24;
/** Intervalo mínimo entre dois obturadores. */
export const SHUTTER_MIN_INTERVAL_S = 0.06;
/** Rampa do mudo e das mudanças de volume. */
export const VOLUME_RAMP_S = 0.05;

export interface PlayOptions {
  /** Multiplicador de frequência. */
  pitch?: number;
  /** Multiplicador de ganho da voz. */
  gain?: number;
  /** −1 (esquerda) a 1 (direita). */
  pan?: number;
}

const INERT_LOOP: LoopHandle = { setParam: () => undefined, stop: () => undefined };

/**
 * Motor de áudio procedural (audio §1). O `AudioContext` só nasce no `unlock()`,
 * chamado no primeiro gesto do jogador; antes disso, `play()` não faz nada.
 *
 * fontes → voz → gainSfx → gainMaster → compressor (−18 dB, 4:1) → destino
 */
export class AudioEngine {
  private static instance: AudioEngine | null = null;

  static get(): AudioEngine {
    AudioEngine.instance ??= new AudioEngine();
    return AudioEngine.instance;
  }

  /** Só para testes: troca o singleton, com uma fábrica de contexto falsa. */
  static resetForTests(createContext?: () => AudioContext): AudioEngine {
    AudioEngine.instance?.dispose();
    AudioEngine.instance = new AudioEngine(createContext);
    return AudioEngine.instance;
  }

  private readonly createContext: () => AudioContext;
  private ctx: AudioContext | null = null;
  /** O navegador não deixou criar o contexto: o áudio fica desligado nesta sessão. */
  private unavailable = false;
  private master: GainNode | null = null;
  private sfx: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private volumes = { master: 1, sfx: 1, muted: false };
  private voices: Array<{ id: SfxId; endAt: number }> = [];
  private lastShutterAt = -Infinity;
  private readonly loops = new Set<() => void>();
  private readonly readyListeners = new Set<() => void>();

  constructor(createContext: () => AudioContext = () => new AudioContext()) {
    this.createContext = createContext;
  }

  get ready(): boolean {
    return this.ctx !== null;
  }

  /** Avisa quando o áudio é liberado ou descartado (`ready` muda). */
  subscribe(fn: () => void): () => void {
    this.readyListeners.add(fn);
    return () => this.readyListeners.delete(fn);
  }

  get context(): AudioContext | null {
    return this.ctx;
  }

  get masterGain(): GainNode | null {
    return this.master;
  }

  get sfxGain(): GainNode | null {
    return this.sfx;
  }

  /** Vozes one-shot ainda tocando. */
  get activeVoices(): number {
    const now = this.ctx?.currentTime ?? 0;
    return this.voices.filter((v) => v.endAt > now).length;
  }

  unlock(): void {
    if (!this.ctx && !this.unavailable) {
      try {
        const ctx = this.createContext();
        const compressor = ctx.createDynamicsCompressor();
        compressor.threshold.value = -18;
        compressor.ratio.value = 4;
        compressor.connect(ctx.destination);
        const master = ctx.createGain();
        master.connect(compressor);
        const sfx = ctx.createGain();
        sfx.connect(master);
        this.ctx = ctx;
        this.master = master;
        this.sfx = sfx;
      } catch {
        // Sem dispositivo de áudio ou com a API bloqueada: o jogo segue mudo (`play` e
        // `startLoop` ficam inertes) e não tenta de novo a cada gesto.
        this.unavailable = true;
        return;
      }
      this.applyVolumes(false);
      this.readyListeners.forEach((fn) => fn());
    }
    // O navegador pode recusar o `resume` (autoplay); o próximo gesto tenta de novo.
    if (this.ctx?.state === 'suspended') Promise.resolve(this.ctx.resume()).catch(() => undefined);
  }

  /** Volumes 0..1 com curva perceptual (`valor²`); `muted` zera o master em 50 ms. */
  setVolumes(master: number, sfx: number, muted: boolean): void {
    this.volumes = { master: clamp(master, 0, 1), sfx: clamp(sfx, 0, 1), muted };
    this.applyVolumes(true);
  }

  private applyVolumes(ramp: boolean): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.sfx) return;
    const { master, sfx, muted } = this.volumes;
    const set = (param: AudioParam, value: number) => {
      const now = ctx.currentTime;
      param.cancelScheduledValues(now);
      if (ramp) {
        param.setValueAtTime(param.value, now);
        param.linearRampToValueAtTime(value, now + VOLUME_RAMP_S);
      } else {
        param.setValueAtTime(value, now);
      }
    };
    set(this.master.gain, muted ? 0 : master * master);
    set(this.sfx.gain, sfx * sfx);
  }

  /** Ruído branco de 1 s, gerado uma vez (PRNG seedado) e reutilizado. */
  noiseBuffer(): AudioBuffer {
    const ctx = this.ctx;
    if (!ctx) throw new Error('AudioEngine.noiseBuffer() exige unlock()');
    if (!this.noise) {
      const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      const rng = mulberry32(0x0a0d10);
      for (let i = 0; i < data.length; i++) data[i] = rng.next() * 2 - 1;
      this.noise = buffer;
    }
    return this.noise;
  }

  /** Efeito one-shot. Antes do `unlock()`, não faz nada. */
  play(id: SfxId, opts: PlayOptions = {}): void {
    const ctx = this.ctx;
    const bus = this.sfx;
    if (!ctx || !bus) return;
    const now = ctx.currentTime;
    this.voices = this.voices.filter((v) => v.endAt > now);
    if (this.voices.length >= MAX_VOICES) return;
    if (id === 'SHUTTER') {
      if (now - this.lastShutterAt < SHUTTER_MIN_INTERVAL_S) return;
      this.lastShutterAt = now;
    }

    const out = ctx.createGain();
    out.gain.value = Math.max(0, opts.gain ?? 1);
    let head: AudioNode = out;
    if (opts.pan !== undefined && typeof ctx.createStereoPanner === 'function') {
      const panner = ctx.createStereoPanner();
      panner.pan.value = clamp(opts.pan, -1, 1);
      out.connect(panner);
      head = panner;
    }
    head.connect(bus);

    const duration = SFX[id]({
      ctx,
      out,
      t0: now,
      pitch: opts.pitch ?? 1,
      noise: this.noiseBuffer(),
    });
    this.voices.push({ id, endAt: now + duration });
  }

  /** Som contínuo. Antes do `unlock()`, devolve um handle inerte. */
  startLoop(id: LoopId, opts: { variant?: MotorVariant } = {}): LoopHandle {
    const ctx = this.ctx;
    const bus = this.sfx;
    if (!ctx || !bus) return INERT_LOOP;

    const out = ctx.createGain();
    out.connect(bus);
    const timers: number[] = [];
    const voice: LoopVoice = LOOPS[id]({
      ctx,
      out,
      noise: this.noiseBuffer(),
      variant: opts.variant ?? 'MULTIROTOR',
      every: (intervalMs, fn) => {
        const handle = window.setInterval(fn, intervalMs);
        timers.push(handle);
        return () => window.clearInterval(handle);
      },
    });

    let stopped = false;
    const halt = (fadeS: number) => {
      if (stopped) return;
      stopped = true;
      this.loops.delete(kill);
      voice.dispose?.();
      timers.forEach((t) => window.clearInterval(t));
      const now = ctx.currentTime;
      const end = now + Math.max(0, fadeS);
      out.gain.cancelScheduledValues(now);
      out.gain.setValueAtTime(out.gain.value, now);
      out.gain.linearRampToValueAtTime(0, end);
      for (const src of voice.sources) src.stop(end + 0.01);
    };
    const kill = () => halt(0);
    this.loops.add(kill);

    return {
      setParam: (name, value) => {
        if (!stopped) voice.setParam(name, value, ctx.currentTime);
      },
      stop: (fadeS = 0.1) => halt(fadeS),
    };
  }

  /** Para todos os loops e fecha o contexto. */
  dispose(): void {
    [...this.loops].forEach((kill) => kill());
    void this.ctx?.close?.();
    this.ctx = null;
    this.master = null;
    this.sfx = null;
    this.noise = null;
    this.readyListeners.forEach((fn) => fn());
  }
}
