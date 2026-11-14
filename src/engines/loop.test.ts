import { createFakeRaf } from '@/test/fakeRaf';
import { FpsMeter, GameLoop, type GameLoopOptions } from './loop';

function setup(opts: GameLoopOptions = {}) {
  const fake = createFakeRaf();
  const updates: number[] = [];
  let renders = 0;
  const loop = new GameLoop(
    {
      update: (dt) => updates.push(dt),
      render: () => {
        renders++;
      },
    },
    { raf: fake.raf, caf: fake.caf, ...opts },
  );
  return {
    fake,
    loop,
    updates,
    get renders() {
      return renders;
    },
  };
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe('GameLoop', () => {
  it('o primeiro frame só desenha (dt = 0)', () => {
    const t = setup();
    t.loop.start();
    t.fake.frame(1000);
    expect(t.updates).toHaveLength(0);
    expect(t.renders).toBe(1);
  });

  it('dt = 0,2 s vira clamp de 0,05 s em 3 sub-passos de 1/60 s', () => {
    const t = setup({ stepS: 1 / 60 });
    t.loop.start();
    t.fake.frame(1000);
    t.fake.frame(1200);
    expect(t.updates).toHaveLength(3);
    expect(sum(t.updates)).toBeCloseTo(0.05, 12);
    for (const dt of t.updates) expect(dt).toBeLessThanOrEqual(1 / 60 + 1e-12);
    expect(t.renders).toBe(2);
  });

  it('um frame de 16,67 ms é um único sub-passo', () => {
    const t = setup();
    t.loop.start();
    t.fake.frame(0);
    t.fake.frame(1000 / 60);
    expect(t.updates).toHaveLength(1);
    expect(t.updates[0]).toBeCloseTo(1 / 60, 12);
  });

  it('frames mais lentos que 1/60 s são divididos em sub-passos iguais', () => {
    const t = setup();
    t.loop.start();
    t.fake.frame(0);
    t.fake.frame(40);
    expect(t.updates).toHaveLength(3);
    expect(t.updates[0]).toBeCloseTo(0.04 / 3, 12);
  });

  it('timeScale = 4 multiplica os sub-passos', () => {
    let scale = 1;
    const t = setup({ timeScale: () => scale });
    t.loop.start();
    t.fake.frame(0);
    t.fake.frame(1000 / 60);
    expect(t.updates).toHaveLength(1);
    scale = 4;
    t.fake.frame(2000 / 60);
    expect(t.updates).toHaveLength(5);
    expect(sum(t.updates.slice(1))).toBeCloseTo(4 / 60, 12);
    for (const dt of t.updates) expect(dt).toBeLessThanOrEqual(1 / 60 + 1e-12);
  });

  it('pausado = 0 updates e 1 render por frame; ao retomar não há salto', () => {
    const t = setup();
    t.loop.start();
    t.fake.frame(0);
    t.loop.setPaused(true);
    expect(t.loop.isPaused).toBe(true);
    t.fake.frame(16);
    expect(t.updates).toHaveLength(0);
    expect(t.renders).toBe(2);
    t.fake.frame(5016);
    expect(t.updates).toHaveLength(0);
    t.loop.setPaused(false);
    t.fake.frame(5032);
    expect(sum(t.updates)).toBeCloseTo(0.016, 12);
  });

  it('beforeFrame roda antes dos sub-passos, uma vez por frame', () => {
    const order: string[] = [];
    const fake = createFakeRaf();
    const loop = new GameLoop(
      { update: () => order.push('update'), render: () => order.push('render') },
      { raf: fake.raf, caf: fake.caf, beforeFrame: () => order.push('input') },
    );
    loop.start();
    fake.frame(0);
    fake.frame(16);
    expect(order).toEqual(['input', 'render', 'input', 'update', 'render']);
  });

  it('start é idempotente e stop cancela o próximo frame', () => {
    const t = setup();
    expect(t.loop.running).toBe(false);
    t.loop.start();
    t.loop.start();
    expect(t.fake.pending).toBe(1);
    t.fake.frame(0);
    t.loop.stop();
    t.loop.stop();
    expect(t.loop.running).toBe(false);
    expect(t.fake.pending).toBe(0);
    t.fake.frame(16);
    expect(t.renders).toBe(1);
  });

  it('stop dentro do render encerra o loop; reiniciar não herda o relógio antigo', () => {
    const fake = createFakeRaf();
    let renders = 0;
    const updates: number[] = [];
    const loop: GameLoop = new GameLoop(
      {
        update: (dt) => updates.push(dt),
        render: () => {
          renders++;
          if (renders === 2) loop.stop();
        },
      },
      { raf: fake.raf, caf: fake.caf },
    );
    loop.start();
    fake.frame(0);
    fake.frame(16);
    expect(fake.pending).toBe(0);
    loop.start();
    fake.frame(60_000);
    expect(updates).toHaveLength(1);
  });

  it('usa requestAnimationFrame por padrão', () => {
    const raf = vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(7);
    const caf = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
    const loop = new GameLoop({ update: () => undefined, render: () => undefined });
    loop.start();
    expect(raf).toHaveBeenCalledTimes(1);
    loop.stop();
    expect(caf).toHaveBeenCalledWith(7);
    raf.mockRestore();
    caf.mockRestore();
  });

  it('fps é a média móvel de 1 s', () => {
    const t = setup();
    t.loop.start();
    expect(t.loop.fps).toBe(0);
    for (let i = 0; i <= 120; i++) t.fake.frame((i * 1000) / 60);
    expect(t.loop.fps).toBeCloseTo(60, 6);
    // A cadência cai para 30 FPS: depois de 1 s, a média reflete só a janela recente.
    for (let i = 1; i <= 45; i++) t.fake.frame(2000 + (i * 1000) / 30);
    expect(t.loop.fps).toBeCloseTo(30, 6);
  });
});

describe('FpsMeter', () => {
  it('zera com reset e ignora intervalo nulo', () => {
    const meter = new FpsMeter();
    expect(meter.tick(100)).toBe(0);
    expect(meter.tick(100)).toBe(0);
    expect(meter.tick(200)).toBeCloseTo(20, 6);
    meter.reset();
    expect(meter.fps).toBe(0);
  });
});
