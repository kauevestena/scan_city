/**
 * Faixa de quads vizinhos da mesma cor num polígono só (survey-flight §5.18, ADR-033): os
 * quads de uma faixa do terreno saem da esquerda para a direita e, quando o seguinte divide a
 * aresta com o anterior e tem a mesma cor, os dois viram um contorno só. A borda de perto (a
 * de baixo na tela) e a ponta da direita avançam `overlapPx` sobre o vizinho, como no quad
 * solto (`extendQuad`): a faixa mais perto e o próximo trecho, pintados depois, cobrem o
 * avanço. Por dentro do trecho não há emenda nenhuma.
 *
 * Os cantos do quad chegam na ordem de `extendQuad`: perto-esquerda, perto-direita,
 * longe-direita, longe-esquerda (x, y de cada).
 */
export class QuadStrip {
  /** Pontos da borda de perto e da de longe, da esquerda para a direita (x, y). */
  private readonly near: Float64Array;
  private readonly far: Float64Array;
  /** Quantos pontos há em cada borda (quads + 1); 0 = vazio. */
  private count = 0;
  private color = '';

  constructor(
    maxQuads: number,
    private readonly overlapPx: number,
  ) {
    this.near = new Float64Array((maxQuads + 1) * 2);
    this.far = new Float64Array((maxQuads + 1) * 2);
  }

  /** Quads no trecho em curso. */
  get quads(): number {
    return Math.max(0, this.count - 1);
  }

  /**
   * Junta o quad `p` ao trecho, se ele continua o anterior (mesma cor e a aresta da esquerda
   * igual à da direita do anterior); senão desenha o trecho em curso e começa outro com ele.
   */
  push(ctx: CanvasRenderingContext2D, p: Float64Array, color: string): void {
    const k = (this.count - 1) * 2;
    const continues =
      this.count > 0 &&
      color === this.color &&
      this.count * 2 < this.near.length &&
      this.near[k] === p[0] &&
      this.near[k + 1] === p[1] &&
      this.far[k] === p[6] &&
      this.far[k + 1] === p[7];
    if (!continues) {
      this.flush(ctx);
      this.color = color;
      this.near[0] = p[0] as number;
      this.near[1] = p[1] as number;
      this.far[0] = p[6] as number;
      this.far[1] = p[7] as number;
      this.count = 1;
    }
    const j = this.count * 2;
    this.near[j] = p[2] as number;
    this.near[j + 1] = p[3] as number;
    this.far[j] = p[4] as number;
    this.far[j + 1] = p[5] as number;
    this.count++;
  }

  /** Desenha o trecho em curso (um `fill`) e esvazia. */
  flush(ctx: CanvasRenderingContext2D): void {
    if (this.count < 2) {
      this.count = 0;
      return;
    }
    const o = this.overlapPx;
    const last = this.count - 1;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    // Borda de perto, da esquerda para a direita, um pouco abaixo; a ponta da direita avança.
    ctx.moveTo(this.near[0] as number, (this.near[1] as number) + o);
    for (let i = 1; i < last; i++) {
      ctx.lineTo(this.near[i * 2] as number, (this.near[i * 2 + 1] as number) + o);
    }
    ctx.lineTo((this.near[last * 2] as number) + o, (this.near[last * 2 + 1] as number) + o);
    // Borda de longe, da direita para a esquerda, no lugar.
    ctx.lineTo((this.far[last * 2] as number) + o, this.far[last * 2 + 1] as number);
    for (let i = last - 1; i >= 0; i--) {
      ctx.lineTo(this.far[i * 2] as number, this.far[i * 2 + 1] as number);
    }
    ctx.closePath();
    ctx.fill();
    this.count = 0;
  }
}
