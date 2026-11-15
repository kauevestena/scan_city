import { pickNeighbor, type Rect } from './spatial';

const r = (left: number, top: number, width = 40, height = 20): Rect => ({
  left,
  top,
  width,
  height,
});

describe('pickNeighbor', () => {
  //  A  B  C
  //  D  E  F
  const grid = [r(0, 0), r(100, 0), r(200, 0), r(0, 100), r(100, 100), r(200, 100)];
  const [A, B, C, D, E, F] = grid as [Rect, Rect, Rect, Rect, Rect, Rect];

  it('escolhe o vizinho mais próximo em cada direção', () => {
    expect(pickNeighbor(E, grid, 'UP')).toBe(1);
    expect(pickNeighbor(E, grid, 'LEFT')).toBe(3);
    expect(pickNeighbor(E, grid, 'RIGHT')).toBe(5);
    expect(pickNeighbor(B, grid, 'DOWN')).toBe(4);
    expect(pickNeighbor(A, grid, 'RIGHT')).toBe(1);
  });

  it('pesa o desvio ortogonal em dobro', () => {
    // De A para baixo: D está alinhado (100), E está a 100 + 2·100 → D.
    expect(pickNeighbor(A, grid, 'DOWN')).toBe(3);
    // Um alvo diagonal mais perto perde para um alinhado mais longe.
    const far = r(0, 150);
    const diagonal = r(60, 60);
    expect(pickNeighbor(A, [diagonal, far], 'DOWN')).toBe(1);
  });

  it('ignora candidatos fora do cone de ±60°', () => {
    // C está a 200 px à direita e 0 abaixo de A: fora do cone para baixo.
    expect(pickNeighbor(A, [C], 'DOWN')).toBe(-1);
    expect(pickNeighbor(F, grid, 'RIGHT')).toBe(-1);
  });

  it('com wrap, volta ao mais distante no sentido oposto', () => {
    expect(pickNeighbor(C, grid, 'RIGHT', true)).toBe(0);
    expect(pickNeighbor(D, grid, 'DOWN', true)).toBe(0);
    expect(pickNeighbor(A, [], 'UP', true)).toBe(-1);
  });
});
