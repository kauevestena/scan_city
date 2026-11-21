import {
  DOWN_LOCK_MS,
  RenderScaleGovernor,
  renderScaleCap,
  SCALE_STEP,
  UP_AFTER_MS,
  WINDOW_MS,
} from './renderScale';

/** Alimenta `durationMs` de quadros de `frameMs` e devolve as escalas novas (4 casas), na ordem. */
function feed(g: RenderScaleGovernor, frameMs: number, durationMs: number): number[] {
  const out: number[] = [];
  for (let t = 0; t < durationMs; t += frameMs) {
    const next = g.sample(frameMs);
    if (next !== null) out.push(Math.round(next * 1e4) / 1e4);
  }
  return out;
}
/** Tempo de quadro de um FPS. */
const ms = (fps: number) => 1000 / fps;

describe('teto da escala por qualidade (ADR-033)', () => {
  it('Alta usa a densidade da tela; Média até 1,5; Baixa até 1', () => {
    expect(renderScaleCap('HIGH', 2)).toBe(2);
    expect(renderScaleCap('MEDIUM', 2)).toBe(1.5);
    expect(renderScaleCap('LOW', 2)).toBe(1);
    expect(renderScaleCap('MEDIUM', 1.25)).toBe(1.25);
    expect(renderScaleCap('HIGH', 1)).toBe(1);
    expect(renderScaleCap('HIGH', 0)).toBe(1);
  });
});

describe('RenderScaleGovernor: resolução que segue o tempo de quadro', () => {
  it('com folga (60 FPS) fica no teto', () => {
    const g = new RenderScaleGovernor(2, 0.75);
    expect(g.scale).toBe(2);
    expect(feed(g, ms(60), 20_000)).toEqual([]);
  });

  it('lento (35 FPS) desce um degrau por janela enquanto ajuda, e nunca abaixo do piso', () => {
    const g = new RenderScaleGovernor(2, 0.75);
    // Cada janela ainda abaixo de 54 FPS, mas melhor que a anterior (≥ 5 %): mais um degrau.
    const steps = [35, 40, 43, 46, 48.5].flatMap((fps) => feed(g, ms(fps), WINDOW_MS));
    expect(steps).toEqual([1.6, 1.28, 1.024, 0.8192, 0.75]);
    expect(SCALE_STEP).toBe(0.8);
    // No piso, com o ganho confirmado: fica, mesmo lento.
    expect(feed(g, ms(51), WINDOW_MS)).toEqual([]);
    expect(feed(g, ms(30), 10_000)).toEqual([]);
    expect(g.scale).toBe(0.75);
  });

  it('com folga de novo, sobe depois de 3 s; a subida que não se segura volta e dobra a espera', () => {
    const g = new RenderScaleGovernor(2, 0.75, 1.28);
    // 2 janelas de folga (3 s): sobe um degrau.
    expect(feed(g, ms(60), UP_AFTER_MS)).toEqual([1.6]);
    // A subida deixa o quadro lento: volta na hora, sem teste.
    expect(feed(g, ms(40), WINDOW_MS)).toEqual([1.28]);
    // Agora a próxima tentativa espera o dobro: em 3 s não sobe, em 6 s sobe.
    expect(feed(g, ms(60), UP_AFTER_MS)).toEqual([]);
    expect(feed(g, ms(60), UP_AFTER_MS)).toEqual([1.6]);
  });

  it('limitado a 30 Hz (economia de energia): a descida não ajuda, a escala volta e as descidas param', () => {
    const g = new RenderScaleGovernor(2, 0.75);
    expect(feed(g, ms(30), WINDOW_MS)).toEqual([1.6]);
    // Mesma taxa depois de descer: não era pixel. Volta para 2 e trava as descidas.
    expect(feed(g, ms(30), WINDOW_MS)).toEqual([2]);
    expect(feed(g, ms(30), DOWN_LOCK_MS - 2 * WINDOW_MS)).toEqual([]);
    // Passada a trava, tenta de novo (e desfaz de novo se não ajudar).
    expect(feed(g, ms(30), 4 * WINDOW_MS)).toEqual([1.6, 2]);
  });

  it('quadros entre 54 e 58 FPS não mexem na escala', () => {
    const g = new RenderScaleGovernor(2, 0.75, 1.6);
    expect(feed(g, ms(56), 30_000)).toEqual([]);
  });

  it('ignora intervalos inválidos ou longos demais (aba em segundo plano)', () => {
    const g = new RenderScaleGovernor(2, 0.75);
    expect(g.sample(0)).toBeNull();
    expect(g.sample(-5)).toBeNull();
    expect(g.sample(Number.NaN)).toBeNull();
    for (let k = 0; k < 20; k++) expect(g.sample(400)).toBeNull();
    expect(g.scale).toBe(2);
  });

  it('a escala inicial e os limites novos ficam entre o piso e o teto', () => {
    expect(new RenderScaleGovernor(2, 0.75, 5).scale).toBe(2);
    expect(new RenderScaleGovernor(2, 0.75, 0.1).scale).toBe(0.75);
    // O piso nunca passa do teto (tela de DPR 1 com piso 1 na mesa).
    expect(new RenderScaleGovernor(1, 1.2).scale).toBe(1);
    const g = new RenderScaleGovernor(2, 0.75);
    expect(g.setLimits(1.5, 0.75)).toBe(1.5);
    expect(g.setLimits(1, 1)).toBe(1);
    // Um teto maior (a qualidade subiu) leva a escala até ele.
    expect(g.setLimits(2, 0.75)).toBe(2);
  });
});
