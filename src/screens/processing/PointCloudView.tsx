import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { STRINGS } from '@/data/strings';
import { RETURN_COLORS, type CloudScene } from '@/engines/raster/pointCloud';
import { OrbitCamera } from '@/engines/soft3d/OrbitCamera';
import { Soft3DRenderer } from '@/engines/soft3d/Renderer';
import { useCanvas } from '@/engines/useCanvas';
import { useGameLoop } from '@/engines/useGameLoop';
import { InputManager } from '@/input/InputManager';
import { formatNumber } from '@/lib/format';
import { COLORS } from '@/ui/tokens';

const C = STRINGS.processing.products.cloud;

/** Velocidade do orbitar pelo analógico (rad/s), a mesma da mesa do museu. */
const ORBIT_SPEED = 1.5;
const DRAG_YAW = 0.008;
const DRAG_PITCH = 0.006;

export interface PointCloudViewProps {
  scene: CloudScene;
  /** Mostra a malha TIN em wireframe ciano sobre a nuvem. */
  tin: boolean;
  /** Expõe a câmera (testes e ajuste fino). */
  cameraRef?: MutableRefObject<OrbitCamera | null>;
}

/** Canvas 3D da nuvem: órbita por mouse (arrastar, roda) e analógico direito (`LOOK`, `ZOOM`). */
export function PointCloudView({ scene, tin, cameraRef }: PointCloudViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const surface = useCanvas(canvasRef);
  const camera = useMemo(() => new OrbitCamera(scene.radius), [scene.radius]);
  const renderer = useMemo(() => new Soft3DRenderer(), []);
  const drag = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    if (cameraRef) cameraRef.current = camera;
  }, [cameraRef, camera]);

  useGameLoop(() => {
    if (!surface) return null;
    const { ctx, width, height } = surface;
    return {
      update(dtS) {
        const im = InputManager.get();
        const lx = im.axis('LOOK_X');
        const ly = im.axis('LOOK_Y');
        if (lx !== 0 || ly !== 0)
          camera.orbit(-lx * ORBIT_SPEED * dtS, -ly * ORBIT_SPEED * dtS * 0.6);
        const z = im.axis('ZOOM');
        if (z !== 0) camera.zoom(1 - z * dtS);
        camera.update(dtS, drag.current !== null);
      },
      render() {
        ctx.fillStyle = COLORS.bgBase;
        ctx.fillRect(0, 0, width, height);
        renderer.render(
          ctx,
          width,
          height,
          camera.matrix(width / Math.max(1, height)),
          [],
          tin ? [scene.tin] : [],
          scene.points,
        );
      },
    };
  }, [surface, scene, tin, camera, renderer]);

  return (
    <div
      className="aspect-[8/5] w-full max-w-[640px] overflow-hidden rounded-md border border-slate-700"
      data-testid="cloud-frame"
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={C.canvasLabel}
        title={C.controls}
        className="block h-full w-full cursor-grab touch-none active:cursor-grabbing"
        data-testid="cloud-canvas"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture?.(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          camera.orbit(-(e.clientX - d.x) * DRAG_YAW, (e.clientY - d.y) * DRAG_PITCH);
          drag.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
        onWheel={(e) => camera.zoom(e.deltaY > 0 ? 1.1 : 1 / 1.1)}
      />
    </div>
  );
}

/** Legenda da nuvem: contagem de pontos e, no LiDAR, as cores por retorno. */
export function CloudLegend({ scene }: { scene: CloudScene }) {
  return (
    <ul className="flex flex-wrap gap-4 text-sm text-slate-200" data-testid="cloud-legend">
      <li className="font-mono text-xs" data-testid="cloud-count">
        {C.count(formatNumber(scene.pointCount, 0))}
      </li>
      {scene.source === 'PHOTO' ? (
        <li>{C.photoColors}</li>
      ) : (
        (['FIRST', 'INTERMEDIATE', 'GROUND'] as const).map((ret) => (
          <li key={ret} className="flex items-center gap-2" data-testid={`return-${ret}`}>
            <span
              className="size-3 rounded-full"
              style={{ backgroundColor: RETURN_COLORS[ret] }}
              aria-hidden
            />
            {C.returns[ret]}
            {scene.byReturn && (
              <span className="font-mono text-xs tabular-nums">
                {formatNumber(scene.byReturn[ret], 0)}
              </span>
            )}
          </li>
        ))
      )}
    </ul>
  );
}
