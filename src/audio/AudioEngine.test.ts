import {
  FakeAudioContext,
  fakeContextFactory,
  type FakeBiquad,
  type FakeBufferSource,
  type FakeGain,
  type FakeOscillator,
  type FakeParam,
} from '@/test/fakeAudio';
import { AudioEngine, MAX_VOICES } from './AudioEngine';
import { env, MIN_GAIN } from './envelope';
import { LOOP_IDS, SFX_IDS } from './sfx';

let engine: AudioEngine;
const ctx = () => engine.context as unknown as FakeAudioContext;
const sources = (from = 0) => [
  ...ctx().created('oscillator', from),
  ...ctx().created('bufferSource', from),
];

beforeEach(() => {
  vi.useFakeTimers();
  FakeAudioContext.instances = [];
  engine = AudioEngine.resetForTests(fakeContextFactory());
});
afterEach(() => {
  engine.dispose();
  vi.useRealTimers();
});

describe('AudioEngine (audio §5)', () => {
  it('1. nenhum contexto existe antes do unlock()', () => {
    engine.play('SHUTTER');
    engine.setVolumes(0.5, 0.5, false);
    expect(engine.startLoop('MOTOR')).toBeDefined();
    expect(FakeAudioContext.instances).toHaveLength(0);
    expect(engine.ready).toBe(false);
    expect(() => engine.noiseBuffer()).toThrow();

    const notified = vi.fn();
    const off = engine.subscribe(notified);
    engine.unlock();
    engine.unlock();
    off();
    expect(notified).toHaveBeenCalledTimes(1);
    expect(FakeAudioContext.instances).toHaveLength(1);
    expect(engine.ready).toBe(true);
    expect(ctx().resumed).toBe(1);
  });

  it('sem dispositivo de áudio (o AudioContext lança), o unlock não lança, o jogo segue mudo e não tenta de novo', () => {
    let attempts = 0;
    const mute = AudioEngine.resetForTests(() => {
      attempts++;
      throw new DOMException('sem dispositivo de áudio', 'NotSupportedError');
    });
    expect(() => mute.unlock()).not.toThrow();
    expect(() => mute.unlock()).not.toThrow();
    expect(attempts).toBe(1);
    expect(mute.ready).toBe(false);
    expect(mute.context).toBeNull();
    expect(() => mute.play('SHUTTER')).not.toThrow();
    expect(() => mute.setVolumes(0.5, 0.5, false)).not.toThrow();
    expect(() => mute.startLoop('MOTOR').stop()).not.toThrow();
  });

  it('um resume() recusado pelo navegador não vira erro (o próximo gesto tenta de novo)', () => {
    engine.unlock();
    ctx().state = 'suspended';
    const refused = Promise.reject(new DOMException('bloqueado', 'NotAllowedError'));
    const handled = vi.spyOn(refused, 'catch');
    ctx().resume = () => refused;
    expect(() => engine.unlock()).not.toThrow();
    // Sem tratamento, a rejeição viraria "Uncaught (in promise)" a cada gesto.
    expect(handled).toHaveBeenCalled();
  });

  it('monta o grafo sfx → master → compressor (−18 dB, 4:1) → destino', () => {
    engine.unlock();
    const compressor = ctx().created('compressor')[0] as unknown as {
      threshold: FakeParam;
      ratio: FakeParam;
      connections: unknown[];
    };
    expect(compressor.threshold.value).toBe(-18);
    expect(compressor.ratio.value).toBe(4);
    expect(compressor.connections).toEqual([ctx().destination]);
    const master = engine.masterGain as unknown as FakeGain;
    const sfx = engine.sfxGain as unknown as FakeGain;
    expect(master.connections).toEqual([compressor]);
    expect(sfx.connections).toEqual([master]);
  });

  it('2. play("SHUTTER") cria ≥ 2 fontes e um filtro highpass', () => {
    engine.unlock();
    const before = ctx().nodes.length;
    engine.play('SHUTTER');
    expect(sources(before).length).toBeGreaterThanOrEqual(2);
    const filters = ctx().created('biquad', before) as unknown as FakeBiquad[];
    expect(filters.some((f) => f.type === 'highpass' && f.frequency.value === 2500)).toBe(true);
    // Todas as fontes têm início e fim agendados.
    for (const s of sources(before) as unknown as Array<FakeOscillator | FakeBufferSource>) {
      expect(s.started).not.toBeNull();
      expect(s.stopped).not.toBeNull();
    }
  });

  it('3. o obturador respeita o intervalo mínimo de 60 ms', () => {
    engine.unlock();
    engine.play('SHUTTER');
    const count = () => ctx().created('biquad').length;
    expect(count()).toBe(1);
    ctx().currentTime = 0.05;
    engine.play('SHUTTER');
    expect(count()).toBe(1);
    ctx().currentTime = 0.061;
    engine.play('SHUTTER');
    expect(count()).toBe(2);
  });

  it('4. setVolumes(0,5, 1, false) deixa o master em 0,25 (curva quadrática)', () => {
    engine.unlock();
    engine.setVolumes(0.5, 1, false);
    expect((engine.masterGain as unknown as FakeGain).gain.value).toBe(0.25);
    expect((engine.sfxGain as unknown as FakeGain).gain.value).toBe(1);
    engine.setVolumes(1, 0.3, false);
    expect((engine.sfxGain as unknown as FakeGain).gain.value).toBeCloseTo(0.09, 12);
  });

  it('5. muted zera o master com rampa de 50 ms', () => {
    engine.unlock();
    engine.setVolumes(0.8, 0.8, false);
    ctx().currentTime = 2;
    engine.setVolumes(0.8, 0.8, true);
    const master = (engine.masterGain as unknown as FakeGain).gain;
    expect(master.value).toBe(0);
    expect(master.calls.at(-1)).toEqual(['linear', 0, 2.05]);
    engine.setVolumes(0.8, 0.8, false);
    expect(master.value).toBeCloseTo(0.64, 12);
  });

  it('os volumes definidos antes do unlock valem no unlock', () => {
    engine.setVolumes(0.5, 0.5, true);
    engine.unlock();
    expect((engine.masterGain as unknown as FakeGain).gain.value).toBe(0);
    expect((engine.sfxGain as unknown as FakeGain).gain.value).toBe(0.25);
  });

  it('limita a 24 vozes simultâneas e libera as que terminaram', () => {
    engine.unlock();
    for (let i = 0; i < MAX_VOICES + 5; i++) engine.play('TAKEOFF');
    expect(engine.activeVoices).toBe(MAX_VOICES);
    const before = ctx().nodes.length;
    engine.play('UI_CLICK');
    expect(ctx().nodes.length).toBe(before);
    ctx().currentTime = 3;
    expect(engine.activeVoices).toBe(0);
    engine.play('UI_CLICK');
    expect(engine.activeVoices).toBe(1);
  });

  it('todas as receitas tocam sem erro e agendam fontes finitas', () => {
    engine.unlock();
    for (const id of SFX_IDS) {
      ctx().currentTime += 1;
      const before = ctx().nodes.length;
      expect(() => engine.play(id), id).not.toThrow();
      expect(sources(before).length, id).toBeGreaterThan(0);
    }
  });

  it('pitch, gain e pan da voz', () => {
    engine.unlock();
    const before = ctx().nodes.length;
    engine.play('UI_CLICK', { pitch: 2, gain: 0.5, pan: -3 });
    const [voice] = ctx().created('gain', before) as unknown as FakeGain[];
    expect(voice?.gain.value).toBe(0.5);
    const panner = ctx().created('panner', before)[0] as unknown as { pan: FakeParam };
    expect(panner.pan.value).toBe(-1);
    const osc = ctx().created('oscillator', before)[0] as unknown as FakeOscillator;
    expect(osc.frequency.value).toBe(2400);
  });

  it('o ruído de 1 s é gerado uma vez, de forma determinística', () => {
    engine.unlock();
    const a = engine.noiseBuffer();
    expect(engine.noiseBuffer()).toBe(a);
    const data = a.getChannelData(0);
    expect(data).toHaveLength(8000);
    expect(Math.max(...data)).toBeLessThanOrEqual(1);
    expect(Math.min(...data)).toBeGreaterThanOrEqual(-1);
    const other = AudioEngine.resetForTests(fakeContextFactory());
    other.unlock();
    expect(Array.from(other.noiseBuffer().getChannelData(0))).toEqual(Array.from(data));
    other.dispose();
  });
});

describe('loops', () => {
  it('cada loop inicia, aceita parâmetros e para com fade', () => {
    engine.unlock();
    for (const id of LOOP_IDS) {
      const before = ctx().nodes.length;
      const loop = engine.startLoop(id);
      loop.setParam('pitch', 1.2);
      loop.setParam('rate', 3);
      loop.setParam('gain', 0.5);
      ctx().currentTime += 1;
      loop.stop(0.2);
      loop.stop();
      loop.setParam('gain', 1);
      for (const s of sources(before) as unknown as FakeOscillator[]) {
        expect(s.stopped, id).toBeCloseTo(ctx().currentTime + 0.21, 9);
      }
    }
  });

  it('LIDAR_HUM: duas serras desafinadas, lowpass 900 Hz (Q 6) varrido por LFO de 2 Hz', () => {
    engine.unlock();
    const before = ctx().nodes.length;
    const loop = engine.startLoop('LIDAR_HUM');
    const oscs = ctx().created('oscillator', before) as unknown as FakeOscillator[];
    expect(oscs.map((o) => [o.type, o.frequency.value])).toEqual([
      ['sine', 2],
      ['sawtooth', 110],
      ['sawtooth', 220.7],
    ]);
    const filter = ctx().created('biquad', before)[0] as unknown as FakeBiquad;
    expect([filter.type, filter.frequency.value, filter.Q.value]).toEqual(['lowpass', 900, 6]);
    loop.setParam('rate', 2);
    expect(oscs[0]?.frequency.value).toBe(4);
  });

  it('MOTOR: frequência pela velocidade em multirrotor e asa fixa', () => {
    engine.unlock();
    let before = ctx().nodes.length;
    const rotor = engine.startLoop('MOTOR', { variant: 'MULTIROTOR' });
    const rotorSaw = ctx().created('oscillator', before)[0] as unknown as FakeOscillator;
    expect(rotorSaw.frequency.value).toBe(140);
    rotor.setParam('rate', 15);
    expect(rotorSaw.frequency.value).toBe(170);
    expect(ctx().created('bufferSource', before)).toHaveLength(1);

    before = ctx().nodes.length;
    const wing = engine.startLoop('MOTOR', { variant: 'FIXED_WING' });
    const wingSaw = ctx().created('oscillator', before)[0] as unknown as FakeOscillator;
    wing.setParam('rate', 20);
    expect(wingSaw.frequency.value).toBe(110);
    expect(ctx().created('bufferSource', before)).toHaveLength(0);
  });

  it('MOTOR do Atlas bate asas mais rápido quanto maior a velocidade', () => {
    engine.unlock();
    const before = ctx().nodes.length;
    const flaps = engine.startLoop('MOTOR', { variant: 'BIRD' });
    const pulses = () => ctx().created('bufferSource', before).length;
    expect(pulses()).toBe(1);
    ctx().currentTime = 1;
    vi.advanceTimersByTime(100);
    const slow = pulses();
    flaps.setParam('rate', 20);
    ctx().currentTime = 2;
    vi.advanceTimersByTime(100);
    const fast = pulses() - slow;
    expect(fast).toBeGreaterThanOrEqual(2);
    flaps.stop();
    ctx().currentTime = 5;
    vi.advanceTimersByTime(1000);
    expect(pulses()).toBe(slow + fast);
  });

  it('WIND e PROCESSING ajustam o ganho', () => {
    engine.unlock();
    let before = ctx().nodes.length;
    const wind = engine.startLoop('WIND');
    const windGain = ctx().created('gain', before)[1] as unknown as FakeGain;
    wind.setParam('gain', 2);
    expect(windGain.gain.value).toBeCloseTo(0.15, 12);

    before = ctx().nodes.length;
    const proc = engine.startLoop('PROCESSING');
    const fan = ctx().created('gain', before)[1] as unknown as FakeGain;
    proc.setParam('rate', 32);
    expect(fan.gain.value).toBeCloseTo(0.05 * 32 ** 0.3, 12);
    const bips = () => ctx().created('oscillator', before).length;
    ctx().currentTime = 10;
    vi.advanceTimersByTime(100);
    expect(bips()).toBeGreaterThan(0);
  });

  it('dispose para todos os loops', () => {
    engine.unlock();
    const audio = ctx();
    const before = audio.nodes.length;
    engine.startLoop('WIND');
    engine.dispose();
    const [noise] = audio.created('bufferSource', before) as unknown as FakeBufferSource[];
    expect(noise?.stopped).not.toBeNull();
    expect(audio.state).toBe('closed');
    expect(engine.ready).toBe(false);
  });
});

describe('env', () => {
  it('ataque linear, decaimento exponencial, nunca até 0', () => {
    const p = new (class {
      calls: Array<[string, number, number]> = [];
      value = 0;
      cancelled = 0;
      cancelScheduledValues() {
        this.cancelled++;
      }
      setValueAtTime(v: number, t: number) {
        this.calls.push(['set', v, t]);
      }
      linearRampToValueAtTime(v: number, t: number) {
        this.calls.push(['linear', v, t]);
      }
      exponentialRampToValueAtTime(v: number, t: number) {
        this.calls.push(['exp', v, t]);
      }
    })();
    const end = env(p as unknown as AudioParam, 1, { a: 0.01, d: 0.1, peak: 0.5 });
    expect(end).toBeCloseTo(1.11, 12);
    // O envelope limpa a automação anterior do parâmetro antes de agendar a nova.
    expect(p.cancelled).toBe(1);
    expect(p.calls).toEqual([
      ['set', MIN_GAIN, 1],
      ['linear', 0.5, 1.01],
      ['exp', MIN_GAIN, expect.closeTo(1.11, 12)],
    ]);

    p.calls = [];
    const end2 = env(p as unknown as AudioParam, 0, {
      a: 0,
      d: 0,
      s: 1,
      sustainTime: 0.2,
      r: 0.05,
      peak: 0.3,
    });
    expect(end2).toBeCloseTo(0.25, 12);
    expect(p.calls).toEqual([
      ['set', MIN_GAIN, 0],
      ['set', 0.3, 0],
      ['set', 0.3, 0.2],
      ['exp', MIN_GAIN, 0.25],
    ]);

    p.calls = [];
    env(p as unknown as AudioParam, 0, { a: 0, d: 0, s: 0.5, sustainTime: 0.1, peak: 0 });
    expect(p.calls.every(([, v]) => v >= MIN_GAIN)).toBe(true);
    expect(p.calls.at(-1)).toEqual(['set', MIN_GAIN, 0.1]);
  });
});
