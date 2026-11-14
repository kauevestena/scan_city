/** Canvas preparado para desenhar em pixels lógicos (CSS), com o buffer escalado pelo DPR. */
export interface CanvasSurface {
  ctx: CanvasRenderingContext2D;
  /** Largura e altura lógicas, em px de CSS. */
  width: number;
  height: number;
  dpr: number;
}

export function currentDpr(): number {
  return typeof window !== 'undefined' && window.devicePixelRatio > 0 ? window.devicePixelRatio : 1;
}

/**
 * Ajusta o buffer do canvas para `css × dpr` e aplica a transformação, de modo que
 * o código de desenho use sempre coordenadas lógicas (REQ-CORE-008, REQ-NFR-004).
 */
export function setupCanvas(
  canvas: HTMLCanvasElement,
  cssWidth: number,
  cssHeight: number,
  dpr: number = currentDpr(),
): CanvasSurface | null {
  const width = Math.max(1, Math.floor(cssWidth));
  const height = Math.max(1, Math.floor(cssHeight));
  const bufferWidth = Math.round(width * dpr);
  const bufferHeight = Math.round(height * dpr);
  if (canvas.width !== bufferWidth) canvas.width = bufferWidth;
  if (canvas.height !== bufferHeight) canvas.height = bufferHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  // Redimensionar o buffer zera o estado do contexto; a escala é reaplicada sempre.
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, width, height, dpr };
}
