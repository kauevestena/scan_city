/** Direção de navegação de foco. */
export type NavDirection = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const DIR: Record<NavDirection, [number, number]> = {
  UP: [0, -1],
  DOWN: [0, 1],
  LEFT: [-1, 0],
  RIGHT: [1, 0],
};

/** tan(60°): só entram candidatos num cone de ±60° em torno da direção (input §5). */
const CONE = Math.tan(Math.PI / 3);

function center(r: Rect): [number, number] {
  return [r.left + r.width / 2, r.top + r.height / 2];
}

/**
 * Vizinho mais próximo na direção pedida: distância entre centros com peso 1 no eixo
 * primário e 2 no ortogonal, restrita ao cone de ±60°. Com `wrap`, sem candidato na
 * direção, volta ao mais distante no sentido oposto. Devolve o índice ou −1.
 */
export function pickNeighbor(
  from: Rect,
  candidates: readonly Rect[],
  dir: NavDirection,
  wrap = false,
): number {
  const [cx, cy] = center(from);
  const [ux, uy] = DIR[dir];
  let best = -1;
  let bestScore = Infinity;
  let wrapBest = -1;
  let wrapScore = -Infinity;
  candidates.forEach((r, i) => {
    const [px, py] = center(r);
    const dx = px - cx;
    const dy = py - cy;
    const primary = dx * ux + dy * uy;
    const ortho = Math.abs(dx * uy - dy * ux);
    if (primary > 0 && ortho <= primary * CONE) {
      const score = primary + 2 * ortho;
      if (score < bestScore) {
        bestScore = score;
        best = i;
      }
    } else if (primary < 0 && ortho <= -primary * CONE) {
      // Volta: o mais distante para trás, preferindo o mais alinhado.
      const score = -primary - 2 * ortho;
      if (score > wrapScore) {
        wrapScore = score;
        wrapBest = i;
      }
    }
  });
  return best >= 0 || !wrap ? best : wrapBest;
}
