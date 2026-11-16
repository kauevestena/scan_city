import { FPS_FLOOR, MAX_FRAME_S, QualityGovernor, WINDOW_S } from './qualityGovernor';

/** Alimenta `seconds` de quadros a `fps`; devolve quantas vezes pediu para baixar. */
function run(g: QualityGovernor, fps: number, seconds: number): number {
  let drops = 0;
  const frames = Math.round(fps * seconds);
  for (let k = 0; k < frames; k++) if (g.sample(1 / fps)) drops++;
  return drops;
}

describe('QualityGovernor (holo-table §5.7)', () => {
  it('a 60 FPS nunca baixa a qualidade', () => {
    const g = new QualityGovernor();
    expect(run(g, 60, 30)).toBe(0);
    expect(g.averageFps).toBeGreaterThan(0);
  });

  it('abaixo de 50 FPS por 3 s: pede a queda uma vez por janela', () => {
    const g = new QualityGovernor();
    expect(run(g, 30, WINDOW_S - 0.5)).toBe(0);
    expect(run(g, 30, 0.6)).toBe(1);
    // A janela recomeça: mais 3 s lentas, mais uma queda.
    expect(run(g, 30, WINDOW_S + 0.1)).toBe(1);
  });

  it('exatamente no piso não derruba; um tranco isolado não derruba a média', () => {
    const g = new QualityGovernor();
    expect(run(g, FPS_FLOOR, 12)).toBe(0);
    const h = new QualityGovernor();
    // 2,9 s a 60 FPS e um quadro de 0,2 s: a média continua acima de 50.
    expect(run(h, 60, 2.9)).toBe(0);
    expect(h.sample(0.2)).toBe(false);
  });

  it('ignora quadros muito longos (aba em segundo plano) e dt inválido', () => {
    const g = new QualityGovernor();
    expect(g.sample(MAX_FRAME_S + 0.1)).toBe(false);
    expect(g.sample(0)).toBe(false);
    expect(g.sample(Number.NaN)).toBe(false);
    expect(g.averageFps).toBe(0);
  });

  it('reset recomeça a janela', () => {
    const g = new QualityGovernor();
    run(g, 20, 2.5);
    g.reset();
    expect(g.averageFps).toBe(0);
    expect(run(g, 20, 2.5)).toBe(0);
  });
});
