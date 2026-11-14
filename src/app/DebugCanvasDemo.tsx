import { useRef } from 'react';
import { useCanvas } from '@/engines/useCanvas';
import { useGameLoop } from '@/engines/useGameLoop';
import { COLORS, withAlpha } from '@/ui';

const TURNS_PER_S = 0.25;

/** Cena de teste do loop e do canvas: um quadrado girando, que congela na pausa. */
export function DebugCanvasDemo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const surface = useCanvas(canvasRef);

  useGameLoop(() => {
    if (!surface) return null;
    const { ctx, width, height } = surface;
    let angleRad = 0;
    return {
      update: (dtS) => {
        angleRad = (angleRad + dtS * TURNS_PER_S * 2 * Math.PI) % (2 * Math.PI);
      },
      render: () => {
        const side = Math.min(width, height) * 0.45;
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = COLORS.bgBase;
        ctx.fillRect(0, 0, width, height);
        ctx.save();
        ctx.translate(width / 2, height / 2);
        ctx.rotate(angleRad);
        ctx.fillStyle = withAlpha(COLORS.radar, 0.2);
        ctx.strokeStyle = COLORS.radar;
        ctx.lineWidth = 2;
        ctx.fillRect(-side / 2, -side / 2, side, side);
        ctx.strokeRect(-side / 2, -side / 2, side, side);
        ctx.restore();
      },
    };
  }, [surface]);

  return (
    <div className="h-40 w-64 shrink-0 overflow-hidden rounded-lg border border-slate-700">
      <canvas ref={canvasRef} className="block h-full w-full" data-testid="debug-canvas" />
    </div>
  );
}
