import { mulberry32 } from '@/lib/rng';
import { env } from './envelope';

export type SfxId =
  | 'SHUTTER'
  | 'RTH_BEEP'
  | 'PIGEON_COO'
  | 'CASH_REGISTER'
  | 'CRASH'
  | 'UI_CLICK'
  | 'UI_HOVER'
  | 'ALERT'
  | 'TAKEOFF'
  | 'RIFT_OPEN'
  | 'LEVEL_UP'
  | 'COLLECT'
  | 'DENIED'
  | 'STAGE_DONE'
  | 'GRADE'
  | 'GRADE_MISS'
  | 'GUST_CUT'
  | 'GUST_HIT'
  | 'TURN_OK'
  | 'PAGE_TURN';

export type LoopId = 'LIDAR_HUM' | 'MOTOR' | 'WIND' | 'PROCESSING';

export const SFX_IDS: readonly SfxId[] = [
  'SHUTTER',
  'RTH_BEEP',
  'PIGEON_COO',
  'CASH_REGISTER',
  'CRASH',
  'UI_CLICK',
  'UI_HOVER',
  'ALERT',
  'TAKEOFF',
  'RIFT_OPEN',
  'LEVEL_UP',
  'COLLECT',
  'DENIED',
  'STAGE_DONE',
  'GRADE',
  'GRADE_MISS',
  'GUST_CUT',
  'GUST_HIT',
  'TURN_OK',
  'PAGE_TURN',
];
export const LOOP_IDS: readonly LoopId[] = ['LIDAR_HUM', 'MOTOR', 'WIND', 'PROCESSING'];

/** Contexto de uma receita: tudo que ela cria termina em `out`. */
export interface Voice {
  ctx: BaseAudioContext;
  out: AudioNode;
  t0: number;
  /** Multiplicador de frequência. */
  pitch: number;
  noise: AudioBuffer;
}

// --- blocos ------------------------------------------------------------------

/** Ganho ligado a um nó ou a um parâmetro (modulação: LFO → profundidade → parâmetro). */
function gainNode(ctx: BaseAudioContext, value: number, dest: AudioNode | AudioParam): GainNode {
  const g = ctx.createGain();
  g.gain.value = value;
  // Guarda estrutural: `AudioNode` nem existe como global fora do navegador.
  if ('connect' in dest) g.connect(dest);
  else g.connect(dest);
  return g;
}

function filterNode(
  ctx: BaseAudioContext,
  type: BiquadFilterType,
  freq: number,
  dest: AudioNode,
  q?: number,
): BiquadFilterNode {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  if (q !== undefined) f.Q.value = q;
  f.connect(dest);
  return f;
}

function oscNode(
  ctx: BaseAudioContext,
  type: OscillatorType,
  freq: number,
  dest: AudioNode,
  t0: number,
  t1?: number,
): OscillatorNode {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  o.connect(dest);
  o.start(t0);
  // Sem `t1`, o nó toca até o `stop()` do loop (a API não aceita tempos infinitos).
  if (t1 !== undefined) o.stop(t1);
  return o;
}

function noiseNode(
  v: Pick<Voice, 'ctx' | 'noise'>,
  dest: AudioNode,
  t0: number,
  t1?: number,
): AudioBufferSourceNode {
  const n = v.ctx.createBufferSource();
  n.buffer = v.noise;
  n.loop = true;
  n.connect(dest);
  n.start(t0);
  if (t1 !== undefined) n.stop(t1);
  return n;
}

/** Tom com envelope próprio; devolve o fim. */
function tone(
  v: Voice,
  type: OscillatorType,
  freq: number,
  t0: number,
  e: Parameters<typeof env>[2],
  dest: AudioNode = v.out,
): { osc: OscillatorNode; end: number } {
  const g = gainNode(v.ctx, 0, dest);
  const end = env(g.gain, t0, e);
  const osc = oscNode(v.ctx, type, freq * v.pitch, g, t0, end + 0.02);
  return { osc, end };
}

// --- receitas one-shot (audio §3) ---------------------------------------------

/** Cada receita agenda os nós e devolve a duração em segundos. */
export const SFX: Record<SfxId, (v: Voice) => number> = {
  SHUTTER: (v) => {
    const { ctx, t0 } = v;
    const g = gainNode(ctx, 0, v.out);
    const end = env(g.gain, t0, { a: 0.001, d: 0.025, peak: 0.6 });
    noiseNode(v, filterNode(ctx, 'highpass', 2500, g), t0, end + 0.01);
    tone(v, 'square', 1800, t0, { a: 0, d: 0.008, peak: 0.3 });
    tone(v, 'square', 1200, t0 + 0.045, { a: 0, d: 0.008, peak: 0.2 });
    return 0.08;
  },

  RTH_BEEP: (v) => {
    for (let i = 0; i < 3; i++) {
      tone(v, 'square', 880, v.t0 + i * 0.16, {
        a: 0.003,
        d: 0,
        s: 1,
        sustainTime: 0.08,
        r: 0.007,
        peak: 0.25,
      });
    }
    return 0.41;
  },

  PIGEON_COO: (v) => {
    const { ctx, t0 } = v;
    const band = filterNode(ctx, 'bandpass', 600, v.out, 1.5);
    const notes: Array<[number, number, number, number]> = [
      [0, 0.18, 420, 300],
      [0.23, 0.22, 380, 280],
    ];
    for (const [start, dur, f0, f1] of notes) {
      const ts = t0 + start;
      const envGain = gainNode(ctx, 0, band);
      const end = env(envGain.gain, ts, { a: 0.02, d: dur - 0.02, peak: 0.5 });
      // AM de 28 Hz com profundidade 0,5: ganho base 0,5 ± 0,5 · LFO.
      const am = gainNode(ctx, 0.5, envGain);
      const depth = gainNode(ctx, 0.5, am.gain);
      oscNode(ctx, 'sine', 28, depth, ts, end + 0.02);
      const osc = oscNode(ctx, 'sine', f0 * v.pitch, am, ts, end + 0.02);
      osc.frequency.setValueAtTime(f0 * v.pitch, ts);
      osc.frequency.exponentialRampToValueAtTime(f1 * v.pitch, ts + dur);
    }
    return 0.5;
  },

  CASH_REGISTER: (v) => {
    const { ctx, t0 } = v;
    const g = gainNode(ctx, 0, v.out);
    const end = env(g.gain, t0, { a: 0.002, d: 0.06, peak: 0.4 });
    noiseNode(v, filterNode(ctx, 'bandpass', 3000, g), t0, end + 0.01);
    const chime: Array<[number, number]> = [
      [1568, 0.3],
      [2093, 0.2],
      [2637, 0.15],
    ];
    for (const [freq, peak] of chime)
      tone(v, 'triangle', freq, t0 + 0.05, { a: 0.002, d: 0.6, peak });
    return 0.7;
  },

  CRASH: (v) => {
    const { ctx, t0 } = v;
    const g = gainNode(ctx, 0, v.out);
    const end = env(g.gain, t0, { a: 0.002, d: 0.6, peak: 0.8 });
    const low = filterNode(ctx, 'lowpass', 2000, g);
    low.frequency.setValueAtTime(2000, t0);
    low.frequency.exponentialRampToValueAtTime(200, t0 + 0.6);
    noiseNode(v, low, t0, end + 0.01);
    const { osc } = tone(v, 'sine', 80, t0, { a: 0.002, d: 0.4, peak: 0.7 });
    osc.frequency.setValueAtTime(80 * v.pitch, t0);
    osc.frequency.exponentialRampToValueAtTime(30 * v.pitch, t0 + 0.4);
    return 0.7;
  },

  UI_CLICK: (v) => {
    tone(v, 'triangle', 1200, v.t0, { a: 0, d: 0.03, peak: 0.15 });
    return 0.03;
  },

  UI_HOVER: (v) => {
    tone(v, 'sine', 1800, v.t0, { a: 0, d: 0.015, peak: 0.05 });
    return 0.015;
  },

  ALERT: (v) => {
    const { osc } = tone(v, 'square', 660, v.t0, {
      a: 0.003,
      d: 0,
      s: 1,
      sustainTime: 0.47,
      r: 0.01,
      peak: 0.2,
    });
    for (let i = 0; i < 4; i++) {
      osc.frequency.setValueAtTime((i % 2 === 0 ? 660 : 990) * v.pitch, v.t0 + i * 0.12);
    }
    return 0.5;
  },

  TAKEOFF: (v) => {
    const { ctx, t0 } = v;
    const g = gainNode(ctx, 0, v.out);
    const end = env(g.gain, t0, { a: 0.4, d: 0.6, s: 0.7, sustainTime: 1.2, r: 0.3, peak: 0.3 });
    const band = filterNode(ctx, 'bandpass', 300, g, 1.2);
    band.frequency.setValueAtTime(300, t0);
    band.frequency.exponentialRampToValueAtTime(1200, t0 + 2.5);
    noiseNode(v, band, t0, end + 0.01);
    const saw = oscNode(ctx, 'sawtooth', 60 * v.pitch, gainNode(ctx, 0.35, g), t0, end + 0.01);
    saw.frequency.setValueAtTime(60 * v.pitch, t0);
    saw.frequency.linearRampToValueAtTime(140 * v.pitch, t0 + 2.5);
    return 2.5;
  },

  RIFT_OPEN: (v) => {
    const { ctx, t0 } = v;
    // Reverb simples: 3 linhas de atraso com realimentação 0,3.
    const dry = gainNode(ctx, 1, v.out);
    for (const delayS of [0.07, 0.11, 0.17]) {
      const delay = ctx.createDelay(1);
      delay.delayTime.value = delayS;
      const feedback = gainNode(ctx, 0.3, delay);
      delay.connect(feedback);
      delay.connect(gainNode(ctx, 0.35, v.out));
      dry.connect(delay);
    }
    // Acorde aumentado C5–E5–G#5–C6, desafinado ±15 cents, com vibrato de 6 Hz.
    const vibrato = ctx.createOscillator();
    vibrato.type = 'sine';
    vibrato.frequency.value = 6;
    vibrato.start(t0);
    vibrato.stop(t0 + 1.6);
    const chord: Array<[number, number]> = [
      [523.25, -15],
      [659.25, 15],
      [830.61, -15],
      [1046.5, 15],
    ];
    for (const [freq, detune] of chord) {
      const g = gainNode(ctx, 0, dry);
      const end = env(g.gain, t0, { a: 0.1, d: 1.4, peak: 0.12 });
      const osc = oscNode(ctx, 'sine', freq * v.pitch, g, t0, end + 0.02);
      osc.detune.value = detune;
      vibrato.connect(gainNode(ctx, 10, osc.detune));
    }
    return 1.5;
  },

  LEVEL_UP: (v) => {
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      tone(v, 'triangle', freq, v.t0 + i * 0.08, { a: 0.003, d: 0.077, s: 0, peak: 0.2 });
    });
    return 0.4;
  },

  COLLECT: (v) => {
    const { osc } = tone(v, 'sine', 1200, v.t0, { a: 0.003, d: 0.117, peak: 0.2 });
    osc.frequency.setValueAtTime(1200 * v.pitch, v.t0);
    osc.frequency.exponentialRampToValueAtTime(2400 * v.pitch, v.t0 + 0.12);
    return 0.12;
  },

  DENIED: (v) => {
    for (const start of [0, 0.17]) {
      tone(v, 'square', 180, v.t0 + start, {
        a: 0.003,
        d: 0,
        s: 1,
        sustainTime: 0.07,
        r: 0.007,
        peak: 0.2,
      });
    }
    return 0.25;
  },

  STAGE_DONE: (v) => {
    tone(v, 'sine', 880, v.t0, { a: 0.003, d: 0.057, peak: 0.15 });
    tone(v, 'sine', 1320, v.t0 + 0.06, { a: 0.003, d: 0.057, peak: 0.15 });
    return 0.15;
  },

  // Nota de uma amostra do voo: o tom sobe com a sequência (`pitch`, audio §4).
  GRADE: (v) => {
    tone(v, 'triangle', 660, v.t0, { a: 0.002, d: 0.088, peak: 0.22 });
    tone(v, 'sine', 1320, v.t0, { a: 0.002, d: 0.088, peak: 0.08 });
    return 0.1;
  },

  // Amostra Fraca ou Rejeitada: um som surdo que desce.
  GRADE_MISS: (v) => {
    const { osc } = tone(v, 'sine', 220, v.t0, { a: 0.003, d: 0.117, peak: 0.2 });
    osc.frequency.setValueAtTime(220 * v.pitch, v.t0);
    osc.frequency.exponentialRampToValueAtTime(140 * v.pitch, v.t0 + 0.12);
    return 0.12;
  },

  // Contragolpe no tempo: o vento rasgado (ruído agudo e curto) e um brilho que sobe.
  GUST_CUT: (v) => {
    const g = gainNode(v.ctx, 0, v.out);
    env(g.gain, v.t0, { a: 0.004, d: 0.14, peak: 0.16 });
    const f = filterNode(v.ctx, 'bandpass', 2400, g, 1.2);
    f.frequency.setValueAtTime(1600, v.t0);
    f.frequency.exponentialRampToValueAtTime(4200, v.t0 + 0.14);
    noiseNode(v, f, v.t0, v.t0 + 0.16);
    const { osc } = tone(v, 'triangle', 880, v.t0 + 0.02, { a: 0.002, d: 0.16, peak: 0.18 });
    osc.frequency.setValueAtTime(880 * v.pitch, v.t0 + 0.02);
    osc.frequency.exponentialRampToValueAtTime(1760 * v.pitch, v.t0 + 0.12);
    return 0.2;
  },

  // A rajada bateu sem contragolpe: um sopro grave que desce.
  GUST_HIT: (v) => {
    const g = gainNode(v.ctx, 0, v.out);
    env(g.gain, v.t0, { a: 0.01, d: 0.3, peak: 0.22 });
    const f = filterNode(v.ctx, 'lowpass', 900, g, 0.7);
    f.frequency.setValueAtTime(900, v.t0);
    f.frequency.exponentialRampToValueAtTime(250, v.t0 + 0.3);
    noiseNode(v, f, v.t0, v.t0 + 0.32);
    return 0.32;
  },

  // A curva no tempo (ADR-035): o ar varrido na inclinação (ruído em passa-banda subindo devagar)
  // e duas notas que sobem, uma quinta acima.
  TURN_OK: (v) => {
    const g = gainNode(v.ctx, 0, v.out);
    env(g.gain, v.t0, { a: 0.03, d: 0.24, peak: 0.14 });
    const f = filterNode(v.ctx, 'bandpass', 900, g, 0.9);
    f.frequency.setValueAtTime(800, v.t0);
    f.frequency.exponentialRampToValueAtTime(3000, v.t0 + 0.25);
    noiseNode(v, f, v.t0, v.t0 + 0.28);
    tone(v, 'triangle', 660, v.t0 + 0.04, { a: 0.003, d: 0.1, peak: 0.16 });
    tone(v, 'triangle', 990, v.t0 + 0.12, { a: 0.003, d: 0.14, peak: 0.16 });
    return 0.28;
  },

  // Virar a página no exame de um souvenir (ADR-036): o papel farfalhando (ruído em passa-banda
  // que sobe) e a folha assentando logo depois (um sopro grave e curto).
  PAGE_TURN: (v) => {
    const g = gainNode(v.ctx, 0, v.out);
    env(g.gain, v.t0, { a: 0.04, d: 0.18, peak: 0.16 });
    const f = filterNode(v.ctx, 'bandpass', 1400, g, 0.8);
    f.frequency.setValueAtTime(1400, v.t0);
    f.frequency.exponentialRampToValueAtTime(3200, v.t0 + 0.2);
    noiseNode(v, f, v.t0, v.t0 + 0.24);
    const land = gainNode(v.ctx, 0, v.out);
    env(land.gain, v.t0 + 0.13, { a: 0.005, d: 0.07, peak: 0.12 });
    const low = filterNode(v.ctx, 'lowpass', 1200, land, 0.7);
    noiseNode(v, low, v.t0 + 0.13, v.t0 + 0.22);
    return 0.3;
  },
};

// --- loops --------------------------------------------------------------------

export type LoopParam = 'pitch' | 'gain' | 'rate';

export interface LoopHandle {
  setParam(name: LoopParam, value: number): void;
  stop(fadeS?: number): void;
}

export type MotorVariant = 'MULTIROTOR' | 'FIXED_WING' | 'BIRD';

export interface LoopContext extends Omit<Voice, 't0' | 'pitch'> {
  /** Agenda uma função periódica (eventos discretos à frente do relógio do áudio). */
  every: (intervalMs: number, fn: () => void) => () => void;
  variant: MotorVariant;
}

/** Nós de um loop: o `out` é ligado ao barramento de efeitos; `sources` param no stop. */
export interface LoopVoice {
  sources: AudioScheduledSourceNode[];
  setParam: (name: LoopParam, value: number, now: number) => void;
  dispose?: () => void;
}

const LOOKAHEAD_S = 0.25;
const SCHEDULER_MS = 100;

const smooth = (param: AudioParam, value: number, now: number) => {
  param.setTargetAtTime(value, now, 0.05);
};

export const LOOPS: Record<LoopId, (c: LoopContext) => LoopVoice> = {
  LIDAR_HUM: (c) => {
    const { ctx, out } = c;
    const t0 = ctx.currentTime;
    const level = gainNode(ctx, 0.12, out);
    const low = filterNode(ctx, 'lowpass', 900, level, 6);
    const lfoDepth = gainNode(ctx, 400, low.frequency);
    const lfo = oscNode(ctx, 'sine', 2, lfoDepth, t0);
    const a = oscNode(ctx, 'sawtooth', 110, low, t0);
    const b = oscNode(ctx, 'sawtooth', 220.7, low, t0);
    return {
      sources: [lfo, a, b],
      setParam: (name, value, now) => {
        if (name === 'rate') smooth(lfo.frequency, 2 * value, now);
        else if (name === 'pitch') {
          smooth(a.frequency, 110 * value, now);
          smooth(b.frequency, 220.7 * value, now);
        } else smooth(level.gain, 0.12 * value, now);
      },
    };
  },

  MOTOR: (c) => {
    const { ctx, out, variant } = c;
    const t0 = ctx.currentTime;
    const level = gainNode(ctx, 1, out);
    let speed = 10;
    let pitch = 1;

    if (variant === 'BIRD') {
      // Atlas não tem motor: "bater de asas" em pulsos de ruído de 40 ms, ∝ velocidade.
      const band = filterNode(ctx, 'bandpass', 900, level, 0.8);
      let next = t0;
      const schedule = () => {
        const horizon = ctx.currentTime + LOOKAHEAD_S;
        const intervalS = 0.25 * (10 / Math.min(30, Math.max(2, speed)));
        next = Math.max(next, ctx.currentTime);
        while (next < horizon) {
          const g = gainNode(ctx, 0, band);
          const end = env(g.gain, next, { a: 0.005, d: 0.035, peak: 0.12 });
          noiseNode(c, g, next, end + 0.01);
          next += intervalS;
        }
      };
      schedule();
      const cancel = c.every(SCHEDULER_MS, schedule);
      return {
        sources: [],
        setParam: (name, value, now) => {
          if (name === 'rate') speed = value;
          else if (name === 'gain') smooth(level.gain, value, now);
        },
        dispose: cancel,
      };
    }

    const fixed = variant === 'FIXED_WING';
    const freqFor = () => (fixed ? 50 + 3 * speed : 80 + 6 * speed) * pitch;
    const saw = oscNode(
      ctx,
      'sawtooth',
      freqFor(),
      gainNode(ctx, 0.08, filterNode(ctx, 'lowpass', 1200, level)),
      t0,
    );
    const sources: AudioScheduledSourceNode[] = [saw];
    if (!fixed)
      sources.push(noiseNode(c, filterNode(ctx, 'bandpass', 400, gainNode(ctx, 0.04, level)), t0));
    return {
      sources,
      setParam: (name, value, now) => {
        if (name === 'gain') smooth(level.gain, value, now);
        else {
          if (name === 'rate') speed = value;
          else pitch = value;
          smooth(saw.frequency, freqFor(), now);
        }
      },
    };
  },

  WIND: (c) => {
    const { ctx, out } = c;
    const level = gainNode(ctx, 0, out);
    const src = noiseNode(c, filterNode(ctx, 'lowpass', 500, level), ctx.currentTime);
    return {
      sources: [src],
      // `gain`: intensidade do vento, 0..1 → ganho 0..0,15.
      setParam: (name, value, now) => {
        if (name === 'gain') smooth(level.gain, 0.15 * Math.min(1, Math.max(0, value)), now);
      },
    };
  },

  PROCESSING: (c) => {
    const { ctx, out } = c;
    const t0 = ctx.currentTime;
    const fan = gainNode(ctx, 0.05, out);
    const src = noiseNode(c, filterNode(ctx, 'lowpass', 300, fan), t0);
    // "Bips" de disco em intervalos de 0,3–0,8 s, com PRNG seedado (constitution §2.3).
    const rng = mulberry32(0x5ca1ab1e);
    let next = t0 + rng.range(0.3, 0.8);
    const schedule = () => {
      const horizon = ctx.currentTime + LOOKAHEAD_S;
      next = Math.max(next, ctx.currentTime);
      while (next < horizon) {
        const g = gainNode(ctx, 0, out);
        const end = env(g.gain, next, { a: 0.002, d: 0.02, peak: 0.03 });
        oscNode(ctx, 'square', rng.range(2000, 4000), g, next, end + 0.01);
        next += rng.range(0.3, 0.8);
      }
    };
    schedule();
    const cancel = c.every(SCHEDULER_MS, schedule);
    return {
      sources: [src],
      // `rate`: fator de velocidade do hardware.
      setParam: (name, value, now) => {
        if (name === 'rate') smooth(fan.gain, 0.05 * Math.pow(Math.max(0, value), 0.3), now);
        else if (name === 'gain') smooth(fan.gain, 0.05 * value, now);
      },
      dispose: cancel,
    };
  },
};
