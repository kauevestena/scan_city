/**
 * O `measureText` do canvas falso mede 1 px por letra. Para testar a quebra de linha e o encolher
 * da letra (ADR-036), a largura passa a depender do tamanho da fonte em uso: `em` é a largura
 * média de uma letra, em frações do tamanho (≈ 0,45 numa serifada; 0,56 é uma letra larga).
 */
export function measureByFont(ctx: CanvasRenderingContext2D, em = 0.5): void {
  vi.spyOn(ctx, 'measureText').mockImplementation((text: string) => {
    const px = Number(/([\d.]+)px/.exec(ctx.font)?.[1] ?? '10');
    return { width: [...text].length * px * em } as TextMetrics;
  });
}

export function canvasContext(): CanvasRenderingContext2D {
  return document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;
}
