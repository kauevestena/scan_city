import { useEffect, useState, type RefObject } from 'react';
import { currentDpr, setupCanvas, type CanvasSurface } from './canvas';

/**
 * Liga um `<canvas>` à área de conteúdo do seu elemento pai, respeitando o `devicePixelRatio`.
 * O canvas deve preencher o pai por CSS (`h-full w-full`); o retorno é `null` até a
 * primeira medição.
 */
export function useCanvas(ref: RefObject<HTMLCanvasElement | null>): CanvasSurface | null {
  const [surface, setSurface] = useState<CanvasSurface | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    const host = canvas?.parentElement;
    if (!canvas || !host) return;

    const measure = () => {
      // Área de conteúdo do pai (sem borda): é o espaço que o canvas ocupa.
      const next = setupCanvas(canvas, host.clientWidth, host.clientHeight, currentDpr());
      setSurface((prev) =>
        prev &&
        next &&
        prev.ctx === next.ctx &&
        prev.width === next.width &&
        prev.height === next.height &&
        prev.dpr === next.dpr
          ? prev
          : next,
      );
    };

    measure();
    // Zoom do navegador e troca de monitor mudam o DPR sem redimensionar o elemento.
    window.addEventListener('resize', measure);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(host);
    return () => {
      window.removeEventListener('resize', measure);
      observer?.disconnect();
    };
  }, [ref]);

  return surface;
}
