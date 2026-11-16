import { TWEEN_S } from '@/engines/lab/tween';
import { approachAll, LabSimulation, type LabTargets } from './LabSimulation';
import { DEFAULT_OPTICS, DEFAULT_STEREO } from './InfographicLabScreen';

function surface() {
  const ctx = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;
  return { ctx, width: 900, height: 600, dpr: 1 };
}

function texts(sim: LabSimulation, s: ReturnType<typeof surface>): string[] {
  const out: string[] = [];
  vi.spyOn(s.ctx, 'fillText').mockImplementation((t) => void out.push(String(t)));
  sim.render();
  return out;
}

describe('approachAll', () => {
  it('aproxima só os campos numéricos', () => {
    const next = approachAll({ a: 0, b: 10, tag: 'x' }, { a: 100, b: 0, tag: 'y' }, TWEEN_S);
    expect(next.a).toBeGreaterThan(94);
    expect(next.b).toBeLessThan(1);
    expect(next.tag).toBe('x');
  });
});

describe('LabSimulation', () => {
  it('abre já nos valores dos sliders (sem animar na chegada)', () => {
    const targets: LabTargets = { panel: 'OPTICS', optics: DEFAULT_OPTICS, stereo: DEFAULT_STEREO };
    const sim = new LabSimulation(surface(), () => targets);
    expect(sim.shown.optics).toEqual(DEFAULT_OPTICS);
    expect(sim.shown.stereo).toEqual(DEFAULT_STEREO);
  });

  it('em 150 ms o prédio e os raios chegam a ~95 % do novo valor (e depois, ao valor exato)', () => {
    let targets: LabTargets = { panel: 'STEREO', optics: DEFAULT_OPTICS, stereo: DEFAULT_STEREO };
    const sim = new LabSimulation(surface(), () => targets);
    targets = { ...targets, stereo: { ...DEFAULT_STEREO, objectM: 60 } };
    for (let k = 0; k < 9; k++) sim.update(TWEEN_S / 9);
    const gained = (sim.shown.stereo.objectM - 20) / (60 - 20);
    expect(gained).toBeGreaterThan(0.94);
    expect(gained).toBeLessThan(0.96);
    for (let k = 0; k < 120; k++) sim.update(1 / 60);
    expect(sim.shown.stereo.objectM).toBe(60);
  });

  it('desenha o painel aberto, com as leituras do domínio dos valores interpolados', () => {
    let targets: LabTargets = { panel: 'OPTICS', optics: DEFAULT_OPTICS, stereo: DEFAULT_STEREO };
    const s = surface();
    const sim = new LabSimulation(s, () => targets);
    expect(texts(sim, s)).toContain('GSD 1,25 cm/px');
    expect(texts(sim, s)).toContain('H = 100 m');
    targets = { ...targets, panel: 'STEREO' };
    const stereo = texts(sim, s);
    expect(stereo).toContain('B = 30 m');
    expect(stereo).toContain('b = 10,50 mm');
    expect(stereo).toContain('Δp = 2,625 mm');
    // A meio caminho de H, o rótulo mostra o valor interpolado, não o alvo.
    targets = { ...targets, optics: { ...DEFAULT_OPTICS, heightM: 200 }, panel: 'OPTICS' };
    sim.update(0.03);
    const mid = texts(sim, s).find((t) => t.startsWith('H = '));
    expect(mid).not.toBe('H = 200 m');
    expect(mid).not.toBe('H = 100 m');
  });
});
