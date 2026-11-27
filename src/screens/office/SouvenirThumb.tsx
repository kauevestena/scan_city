import { useEffect, useRef } from 'react';
import { setupCanvas } from '@/engines/canvas';
import { drawSouvenirFront } from '@/engines/souvenir/faceRenderer';
import type { Souvenir } from '@/types';
import { cx } from '@/ui';
import { NamedIcon } from '@/ui/iconRegistry';

let canvas2d: boolean | null = null;

/** O navegador tem Canvas 2D? Sem ele, a miniatura vira o ícone (ADR-027). */
export function canvas2dSupported(): boolean {
  if (canvas2d === null) {
    try {
      canvas2d =
        typeof document !== 'undefined' &&
        document.createElement('canvas').getContext('2d') !== null;
    } catch {
      canvas2d = false;
    }
  }
  return canvas2d;
}

/**
 * A miniatura desenhada do souvenir (office §5, ADR-036): a primeira face (o objeto ou a capa),
 * desenhada uma vez no tamanho da tela; refeita se o DPR muda (zoom, outro monitor).
 */
export function SouvenirThumb({
  souvenir,
  size,
  className,
}: {
  souvenir: Souvenir;
  size: number;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const supported = canvas2dSupported();

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const draw = () => {
      const surface = setupCanvas(canvas, size, size);
      if (!surface) return;
      surface.ctx.clearRect(0, 0, size, size);
      drawSouvenirFront(surface.ctx, souvenir, { x: 0, y: 0, w: size, h: size });
    };
    draw();
    window.addEventListener('resize', draw);
    return () => window.removeEventListener('resize', draw);
  }, [souvenir, size]);

  if (!supported) {
    return (
      <NamedIcon
        name={souvenir.icon}
        size={Math.round(size * 0.65)}
        strokeWidth={1.75}
        aria-hidden
      />
    );
  }
  return (
    <canvas
      ref={ref}
      aria-hidden
      data-souvenir-thumb={souvenir.id}
      className={cx('block', className)}
      style={{ width: size, height: size }}
    />
  );
}
