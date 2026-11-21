import { QuadStrip } from './terrainStrip';

/** Contexto que grava o polígono de cada `fill` (pontos e cor). */
function recorder() {
  const fills: Array<{ color: string; pts: number[] }> = [];
  let pts: number[] = [];
  const ctx = {
    fillStyle: '',
    beginPath: () => (pts = []),
    moveTo: (x: number, y: number) => pts.push(x, y),
    lineTo: (x: number, y: number) => pts.push(x, y),
    closePath: () => undefined,
    fill() {
      fills.push({ color: String(this.fillStyle), pts });
    },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, fills };
}

/** Vértices da grade na coluna `c`: perto (embaixo na tela) e longe, com um relevo em zigue-zague. */
const near = (c: number) => [c * 30, 100 + (c % 2)];
const far = (c: number) => [c * 30 - 2, 90 + (c % 2)];
/** Quad da coluna `j`: perto-esq, perto-dir, longe-dir, longe-esq. */
const quad = (j: number) =>
  Float64Array.from([...near(j), ...near(j + 1), ...far(j + 1), ...far(j)]);

describe('QuadStrip: quads vizinhos de mesma cor num polígono só (ADR-033)', () => {
  it('um quad sozinho sai com a borda de perto e a da direita avançadas; as outras no lugar', () => {
    const { ctx, fills } = recorder();
    const s = new QuadStrip(8, 1);
    const p = Float64Array.from([10, 100, 40, 100, 38, 90, 12, 90]);
    s.push(ctx, p, '#111');
    s.flush(ctx);
    expect(fills).toEqual([{ color: '#111', pts: [10, 101, 41, 101, 39, 90, 12, 90] }]);
    // O quad de entrada não muda: o terreno o reaproveita para as curvas e o brilho.
    expect([...p]).toEqual([10, 100, 40, 100, 38, 90, 12, 90]);
  });

  it('três vizinhos da mesma cor viram um fill com a borda de perto e a de longe inteiras', () => {
    const { ctx, fills } = recorder();
    const s = new QuadStrip(8, 1);
    for (let j = 0; j < 3; j++) s.push(ctx, quad(j), '#222');
    expect(fills).toHaveLength(0);
    expect(s.quads).toBe(3);
    s.flush(ctx);
    expect(fills).toHaveLength(1);
    // Perto (y + 1), da esquerda para a direita, a ponta da direita avançada; longe de volta.
    expect(fills[0]?.pts).toEqual([
      0, 101, 30, 102, 60, 101, 91, 102, 89, 91, 58, 90, 28, 91, -2, 90,
    ]);
    // Esvaziou: flush de novo não desenha nada.
    s.flush(ctx);
    expect(fills).toHaveLength(1);
  });

  it('cor diferente, aresta diferente ou trecho cheio fecham o trecho e começam outro', () => {
    const { ctx, fills } = recorder();
    const s = new QuadStrip(2, 1);
    s.push(ctx, quad(0), '#a');
    s.push(ctx, quad(1), '#b'); // cor nova
    s.push(ctx, quad(3), '#b'); // pulou a coluna 2: não divide aresta
    s.push(ctx, quad(4), '#b');
    s.push(ctx, quad(5), '#b'); // o trecho já tem 2 quads (o máximo)
    s.flush(ctx);
    expect(fills.map((f) => [f.color, f.pts.length / 2])).toEqual([
      ['#a', 4],
      ['#b', 4],
      ['#b', 6],
      ['#b', 4],
    ]);
  });
});
