import type { LoopHandle, LoopId, MotorVariant } from './sfx';
import {
  FlightAmbience,
  motorVariantFor,
  WIND_FULL_MS,
  windIntensity,
  type LoopStarter,
} from './flightAmbience';

interface FakeLoop extends LoopHandle {
  id: LoopId;
  variant?: MotorVariant;
  params: Record<string, number>;
  stopped: number | null;
}

function fakeAudio() {
  const loops: FakeLoop[] = [];
  const audio: LoopStarter = {
    startLoop: (id, opts) => {
      const loop: FakeLoop = {
        id,
        ...(opts?.variant ? { variant: opts.variant } : {}),
        params: {},
        stopped: null,
        setParam: (name, value) => {
          loop.params[name] = value;
        },
        stop: (fadeS) => {
          loop.stopped = fadeS ?? 0;
        },
      };
      loops.push(loop);
      return loop;
    },
  };
  const of = (id: LoopId) => loops.find((l) => l.id === id) as FakeLoop;
  return { audio, loops, of };
}

describe('variantes do motor (audio §3)', () => {
  it('o Atlas bate asas, o multirrotor tem hélices e a asa fixa um tom mais grave', () => {
    expect(motorVariantFor('BIRD')).toBe('BIRD');
    expect(motorVariantFor('MULTIROTOR')).toBe('MULTIROTOR');
    expect(motorVariantFor('FIXED_WING_VTOL')).toBe('FIXED_WING');
  });

  it('o vento cruzado vira a intensidade 0..1 (cheia a partir de 12 m/s, sem sinal)', () => {
    expect(windIntensity(0)).toBe(0);
    expect(windIntensity(-6)).toBeCloseTo(0.5, 12);
    expect(windIntensity(WIND_FULL_MS)).toBe(1);
    expect(windIntensity(40)).toBe(1);
  });
});

describe('FlightAmbience', () => {
  it('liga o motor da aeronave e o vento; a velocidade vai para o `rate` do motor', () => {
    const { audio, loops, of } = fakeAudio();
    const a = new FlightAmbience(audio, 'MULTIROTOR');
    expect(loops).toHaveLength(0);
    a.start();
    expect(loops.map((l) => l.id)).toEqual(['MOTOR', 'WIND']);
    expect(of('MOTOR').variant).toBe('MULTIROTOR');
    expect(a.running).toBe(true);
    a.update(14, -6);
    expect(of('MOTOR').params.rate).toBe(14);
    expect(of('WIND').params.gain).toBeCloseTo(0.5, 12);
  });

  it('o Atlas usa a variante BIRD e a asa fixa, FIXED_WING', () => {
    for (const [kind, variant] of [
      ['BIRD', 'BIRD'],
      ['FIXED_WING_VTOL', 'FIXED_WING'],
    ] as const) {
      const { audio, of } = fakeAudio();
      new FlightAmbience(audio, kind).start();
      expect(of('MOTOR').variant).toBe(variant);
    }
  });

  it('na pausa os dois calam; ao retomar, voltam ao nível de antes', () => {
    const { audio, of } = fakeAudio();
    const a = new FlightAmbience(audio, 'MULTIROTOR');
    a.start();
    a.update(10, 12);
    expect(of('MOTOR').params.gain).toBe(1);
    expect(of('WIND').params.gain).toBe(1);
    a.setPaused(true);
    expect(of('MOTOR').params.gain).toBe(0);
    expect(of('WIND').params.gain).toBe(0);
    // Durante a pausa o HUD não religa o vento.
    a.update(10, 12);
    expect(of('WIND').params.gain).toBe(0);
    a.setPaused(false);
    expect(of('MOTOR').params.gain).toBe(1);
    expect(of('WIND').params.gain).toBe(1);
  });

  it('começar pausado já liga os loops calados', () => {
    const { audio, of } = fakeAudio();
    const a = new FlightAmbience(audio, 'BIRD');
    a.setPaused(true);
    a.start();
    expect(of('MOTOR').params.gain).toBe(0);
    expect(of('WIND').params.gain).toBe(0);
  });

  it('stop encerra os dois com um fade; start de novo (StrictMode) religa', () => {
    const { audio, loops, of } = fakeAudio();
    const a = new FlightAmbience(audio, 'MULTIROTOR');
    a.start();
    a.start();
    expect(loops).toHaveLength(2);
    const [motor, wind] = loops as [FakeLoop, FakeLoop];
    a.stop();
    expect(motor.stopped).toBeGreaterThan(0);
    expect(wind.stopped).toBeGreaterThan(0);
    expect(a.running).toBe(false);
    // Parar de novo não faz nada; ligar de novo cria loops novos.
    a.stop();
    a.start();
    expect(loops).toHaveLength(4);
    expect(of('MOTOR')).toBe(motor);
  });
});
