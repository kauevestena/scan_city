import { useEffect, useRef } from 'react';
import { COLORS, withAlpha } from '@/ui/tokens';

/** Duração da distorção ao entrar numa fenda. */
export const RIFT_WARP_MS = 700;

/**
 * Faixa de uma linha da distorção em `t` (0..1): o deslocamento lateral cresce até o meio da
 * transição e volta, em ondas que sobem pela tela.
 */
export function warpOffset(y: number, height: number, t: number): number {
  const envelope = Math.sin(Math.PI * Math.min(1, Math.max(0, t)));
  return envelope * 34 * Math.sin(y / 17 + t * 26) * (0.6 + 0.4 * Math.sin(y / height));
}

/**
 * Transição "distorção" (contracts-rifts §1): ondas violeta e ciano varrem a tela por 700 ms e
 * então `onDone` segue para a tela da missão. Com `reduceFlashes`, passa direto.
 */
export function RiftWarp({
  onDone,
  reduceFlashes = false,
}: {
  onDone: () => void;
  reduceFlashes?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const done = useRef(onDone);
  // O callback mais recente, sem reiniciar a animação a cada render (ref só em efeito).
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (reduceFlashes) {
      done.current();
      return;
    }
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d') ?? null;
    let raf = 0;
    const start = performance.now();
    const frame = (now: number) => {
      const t = Math.min(1, (now - start) / RIFT_WARP_MS);
      if (canvas && ctx) {
        const { width: w, height: h } = canvas;
        ctx.clearRect(0, 0, w, h);
        for (let y = 0; y < h; y += 6) {
          const dx = warpOffset(y, h, t);
          const hue = (y / h + t) % 1;
          ctx.fillStyle = withAlpha(
            hue < 0.5 ? COLORS.rift : COLORS.radar,
            0.55 * Math.sin(Math.PI * t),
          );
          ctx.fillRect(dx, y, w, 6);
        }
        ctx.fillStyle = withAlpha(COLORS.bgBase, 0.85 * t * t);
        ctx.fillRect(0, 0, w, h);
      }
      if (t < 1) raf = requestAnimationFrame(frame);
      else done.current();
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [reduceFlashes]);

  if (reduceFlashes) return null;
  return (
    <canvas
      ref={canvasRef}
      width={640}
      height={360}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[60] h-full w-full"
      data-testid="rift-warp"
    />
  );
}
