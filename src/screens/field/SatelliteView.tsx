import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
  type WheelEvent,
} from 'react';
import { AudioEngine } from '@/audio/AudioEngine';
import { STRINGS } from '@/data/strings';
import {
  pickPoint,
  initialView,
  panBy,
  toWorld,
  viewTransform,
  zoomAt,
  type SatView,
} from '@/engines/field/satellite';
import { SatelliteRenderer, type RenderStats } from '@/engines/field/SatelliteRenderer';
import { useCanvas } from '@/engines/useCanvas';
import { useGameLoop } from '@/engines/useGameLoop';
import { InputManager } from '@/input/InputManager';
import { formatNumber } from '@/lib/format';
import type { Contract, FlightPlan, GroundPoint, LightingId } from '@/types';
import type { TerrainSampler } from '@/world/terrain/TerrainSampler';
import type { PointTool } from './fieldModel';

/** Raio de pega de um ponto, em px de tela. */
const PICK_PX = 12;
/** Pan pelo teclado (WASD) e pelo analógico, em px/s. */
const PAN_SPEED_PX = 400;
/** Tempo do aviso de recusa sobre o mapa. */
export const REFUSAL_MS = 2000;

export interface SatelliteViewProps {
  contract: Pick<Contract, 'aoi' | 'wind'>;
  terrain: TerrainSampler;
  plan: FlightPlan | null;
  points: readonly GroundPoint[];
  lighting: LightingId;
  mask: Uint8Array | null;
  tool: PointTool | null;
  onPlace: (u: number, v: number) => string | null;
  onMove: (id: string, u: number, v: number) => string | null;
  onRemove: (id: string) => void;
  /** Para testes: estatísticas do último quadro. */
  onRendered?: (stats: RenderStats) => void;
}

interface Drag {
  kind: 'POINT' | 'PAN';
  id?: string;
  x: number;
  y: number;
  moved: boolean;
}

/**
 * Canvas satélite (field-setup §5.1): clique coloca, arrasta move ou remove (Borracha);
 * a roda faz zoom (1×–4×) e o botão direito ou do meio arrasta a vista; WASD também move.
 */
export function SatelliteView(props: SatelliteViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const surface = useCanvas(canvasRef);
  const propsRef = useRef(props);
  const viewRef = useRef<SatView>(initialView(props.terrain));
  const dragRef = useRef<Drag | null>(null);
  const previewRef = useRef<{ id: string; u: number; v: number } | null>(null);
  const flashRef = useRef<{ u: number; v: number; until: number } | null>(null);
  const [cursor, setCursor] = useState<{ u: number; v: number; z: number } | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const hoverRef = useRef<string | null>(null);
  const [refusal, setRefusal] = useState<{ text: string; x: number; y: number; id: number } | null>(
    null,
  );

  useEffect(() => {
    propsRef.current = props;
    hoverRef.current = hoverId;
  });

  useEffect(() => {
    if (!refusal) return;
    const timer = window.setTimeout(() => setRefusal(null), REFUSAL_MS);
    return () => window.clearTimeout(timer);
  }, [refusal]);

  const [renderer] = useState(() => new SatelliteRenderer(props.terrain, props.contract));

  useGameLoop(() => {
    if (!surface) return null;
    return {
      update: (dt) => {
        const input = InputManager.get();
        const dx = input.axis('MOVE_X');
        const dy = -input.axis('MOVE_Y');
        if (dx !== 0 || dy !== 0) {
          viewRef.current = panBy(
            viewRef.current,
            renderer.terrain,
            surface.width,
            surface.height,
            -dx * PAN_SPEED_PX * dt,
            -dy * PAN_SPEED_PX * dt,
          );
        }
      },
      render: () => {
        const p = propsRef.current;
        const preview = previewRef.current;
        const points = preview
          ? p.points.map((pt) =>
              pt.id === preview.id ? { ...pt, u: preview.u, v: preview.v } : pt,
            )
          : p.points;
        const flash =
          flashRef.current && flashRef.current.until > performance.now() ? flashRef.current : null;
        const stats = renderer.render(surface.ctx, surface.width, surface.height, {
          view: viewRef.current,
          lighting: p.lighting,
          plan: p.plan,
          points,
          mask: p.mask,
          flash,
          hoverId: hoverRef.current,
        });
        p.onRendered?.(stats);
      },
    };
  }, [surface, renderer]);

  const local = (e: { clientX: number; clientY: number }) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    return { x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0) };
  };
  const world = (x: number, y: number) =>
    toWorld(
      viewTransform(renderer.terrain, viewRef.current, surface?.width ?? 1, surface?.height ?? 1),
      x,
      y,
    );
  const pickRadius = () =>
    PICK_PX /
    viewTransform(renderer.terrain, viewRef.current, surface?.width ?? 1, surface?.height ?? 1)
      .scale;

  const refuse = (text: string, x: number, y: number, u: number, v: number) => {
    AudioEngine.get().play('DENIED');
    flashRef.current = { u, v, until: performance.now() + REFUSAL_MS };
    setRefusal({ text, x, y, id: performance.now() });
  };

  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    const { x, y } = local(e);
    if (e.button === 1 || e.button === 2) {
      dragRef.current = { kind: 'PAN', x, y, moved: false };
      return;
    }
    if (e.button !== 0) return;
    const { u, v } = world(x, y);
    const picked = pickPoint(props.points, u, v, pickRadius());
    const tool = props.tool;
    if (picked && tool === 'ERASER') {
      props.onRemove(picked.id);
      return;
    }
    if (picked) {
      dragRef.current = { kind: 'POINT', id: picked.id, x, y, moved: false };
      return;
    }
    if (tool === 'GCP' || tool === 'CP') {
      const reason = props.onPlace(u, v);
      if (reason) refuse(reason, x, y, u, v);
    }
  };

  const onPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    const { x, y } = local(e);
    const { u, v } = world(x, y);
    setCursor({ u, v, z: renderer.terrain.elevation(u, v) });
    const drag = dragRef.current;
    if (drag?.kind === 'PAN' && surface) {
      viewRef.current = panBy(
        viewRef.current,
        renderer.terrain,
        surface.width,
        surface.height,
        x - drag.x,
        y - drag.y,
      );
      dragRef.current = { ...drag, x, y, moved: true };
    } else if (drag?.kind === 'POINT' && drag.id) {
      previewRef.current = { id: drag.id, u, v };
      dragRef.current = { ...drag, moved: true };
    } else {
      const picked = pickPoint(props.points, u, v, pickRadius());
      setHoverId(picked?.id ?? null);
    }
  };

  const onPointerUp = (e: PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    previewRef.current = null;
    if (drag?.kind !== 'POINT' || !drag.id || !drag.moved) return;
    const { x, y } = local(e);
    const { u, v } = world(x, y);
    const reason = props.onMove(drag.id, u, v);
    if (reason) refuse(reason, x, y, u, v);
  };

  const onWheel = (e: WheelEvent<HTMLCanvasElement>) => {
    if (!surface) return;
    const { x, y } = local(e);
    viewRef.current = zoomAt(
      viewRef.current,
      renderer.terrain,
      surface.width,
      surface.height,
      x,
      y,
      e.deltaY < 0 ? 1.2 : 1 / 1.2,
    );
  };

  return (
    <div className="relative h-full w-full overflow-hidden" data-testid="satellite-host">
      <canvas
        ref={canvasRef}
        className="block h-full w-full touch-none"
        data-testid="satellite-canvas"
        role="img"
        aria-label={STRINGS.field.canvasLabel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => setCursor(null)}
        onWheel={onWheel}
        onContextMenu={(e: MouseEvent) => e.preventDefault()}
      />
      {cursor && (
        <span
          className="pointer-events-none absolute bottom-2 right-2 rounded bg-slate-950/80 px-2 py-1 font-mono text-xs text-slate-200 tabular-nums"
          data-testid="satellite-cursor"
        >
          {STRINGS.field.cursor(
            formatNumber(cursor.u, 1),
            formatNumber(cursor.v, 1),
            formatNumber(cursor.z, 1),
          )}
        </span>
      )}
      <div role="status" aria-live="polite">
        {refusal && (
          <span
            key={refusal.id}
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-md border border-rose-500/60 bg-slate-950/95 px-2 py-1 text-xs whitespace-nowrap text-rose-200"
            style={{ left: refusal.x, top: refusal.y - 12 }}
            data-testid="satellite-refusal"
          >
            {refusal.text}
          </span>
        )}
      </div>
    </div>
  );
}
