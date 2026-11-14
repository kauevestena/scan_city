import { useEffect, useRef, useState } from 'react';
import { characterColors } from '@/data/cosmetics';
import { getVehicle } from '@/data/catalog';
import { STRINGS } from '@/data/strings';
import { drawMinimap, renderMinimapBase } from '@/engines/overworld/minimap';
import { OverworldEngine, type SkinColors } from '@/engines/overworld/OverworldEngine';
import { useCanvas } from '@/engines/useCanvas';
import { useGameLoop } from '@/engines/useGameLoop';
import { InputGlyph } from '@/input/InputGlyph';
import { InputManager } from '@/input/InputManager';
import { useInputContext } from '@/input/useInputContext';
import { selectModifiers } from '@/state/selectors';
import { useGameStore } from '@/state/store';
import { Tabs, type TabDef } from '@/ui';
import { WORLD_MAP, type MapMarker } from '@/world/overworld/tiles';

const W = STRINGS.world;
/** Tempo que a dica de bloqueio fica na tela. */
export const HINT_VISIBLE_MS = 2500;
/** Intervalo de gravação da posição do avatar (world-map §5.3). */
export const AVATAR_SAVE_MS = 1000;

/** Na aba Real, só os contratos; as fendas entram com a aba Fendas (T059). */
const REAL_MARKERS: readonly MapMarker[] = WORLD_MAP.markers.filter((m) => m.kind === 'CONTRACT');
const TABS: ReadonlyArray<TabDef<'REAL'>> = [{ id: 'REAL', label: W.tabs.REAL }];

let minimapBase: HTMLCanvasElement | null = null;
function getMinimapBase(): HTMLCanvasElement {
  minimapBase ??= renderMinimapBase(WORLD_MAP);
  return minimapBase;
}

const skinColors = (): SkinColors =>
  characterColors(useGameStore.getState().inventory.equipped.character);

/** Grava a posição do avatar e a distância percorrida no store. */
function flushEngine(engine: OverworldEngine): void {
  const { world, setAvatar, addStats } = useGameStore.getState();
  const pos = engine.position;
  const a = world.avatar;
  if (a.x !== pos.x || a.y !== pos.y || a.facing !== pos.facing) setAvatar(pos);
  const distance = engine.takeDistance();
  if (distance > 0) addStats({ distanceTiles: distance });
}

/** Mapa-múndi (world-map §3–§5.3): exploração a pé, câmera, minimapa e porta da sede. */
export function WorldMapScreen() {
  useInputContext('OVERWORLD');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const surface = useCanvas(canvasRef);
  const vehicle = useGameStore((s) => s.world.vehicleMode);
  const [nearDoor, setNearDoor] = useState(false);
  const [hint, setHint] = useState<{ text: string; id: number } | null>(null);

  const [engine] = useState(() => {
    const s = useGameStore.getState();
    return new OverworldEngine({
      input: InputManager.get(),
      start: s.world.avatar,
      vehicle: () => useGameStore.getState().world.vehicleMode,
      speedMod: () => selectModifiers(useGameStore.getState()).overworldSpeed,
      skin: skinColors,
      markers: () => REAL_MARKERS,
      onHint: (text) => setHint({ text, id: performance.now() }),
      onNearDoorChange: setNearDoor,
    });
  });

  // INTERACT chega como ação discreta (teclado na hora, gamepad no poll).
  useEffect(
    () =>
      InputManager.get().onAction((e) => {
        if (e.action !== 'INTERACT' || useGameStore.getState().session.paused) return;
        if (engine.interact() === 'DOOR') {
          flushEngine(engine);
          useGameStore.getState().goTo('OFFICE');
        }
      }),
    [engine],
  );

  // Posição salva a cada 1 s e na saída.
  useEffect(() => {
    const timer = window.setInterval(() => flushEngine(engine), AVATAR_SAVE_MS);
    return () => {
      window.clearInterval(timer);
      flushEngine(engine);
    };
  }, [engine]);

  useEffect(() => {
    if (!hint) return;
    const timer = window.setTimeout(() => setHint(null), HINT_VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [hint]);

  useGameLoop(() => {
    if (!surface) return null;
    engine.attach(surface);
    const mini = minimapRef.current?.getContext('2d') ?? null;
    return {
      update: (dt) => engine.update(dt),
      render: () => {
        engine.render();
        if (mini) {
          drawMinimap(
            mini,
            getMinimapBase(),
            REAL_MARKERS,
            engine.avatar,
            WORLD_MAP.door,
            performance.now() / 1000,
          );
        }
      },
    };
  }, [surface, engine]);

  return (
    <main
      data-testid="world-map-screen"
      aria-label={W.title}
      className="relative h-full w-full overflow-hidden bg-slate-950"
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 block h-full w-full"
        data-testid="world-canvas"
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-4 p-3">
        <div className="pointer-events-auto rounded-lg bg-slate-950/80 px-2 pt-1">
          <Tabs tabs={TABS} value="REAL" onChange={() => undefined} ariaLabel={W.title} />
        </div>
        <span
          className="rounded-lg bg-slate-950/80 px-3 py-1.5 text-sm text-slate-200"
          data-testid="world-vehicle"
        >
          {W.vehicle(getVehicle(vehicle).name)}
        </span>
      </div>

      {nearDoor && (
        <div
          className="absolute bottom-4 left-4 flex items-center gap-2 rounded-lg border border-cyan-400/60 bg-slate-950/90 px-3 py-2 text-sm text-cyan-200"
          data-testid="world-prompt"
        >
          <InputGlyph action="INTERACT" />
          {W.enterHq}
        </div>
      )}

      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none absolute inset-x-0 bottom-20 flex justify-center"
      >
        {hint && (
          <span
            key={hint.id}
            className="rounded-lg border border-amber-400/60 bg-slate-950/90 px-3 py-2 text-sm text-amber-200"
            data-testid="world-hint"
          >
            {hint.text}
          </span>
        )}
      </div>

      <figure className="absolute right-4 bottom-4 m-0 rounded-md border border-slate-700 bg-slate-950/90 p-1">
        <canvas
          ref={minimapRef}
          width={WORLD_MAP.width}
          height={WORLD_MAP.height}
          aria-label={W.minimap}
          role="img"
          className="block [image-rendering:pixelated]"
          style={{ width: WORLD_MAP.width, height: WORLD_MAP.height }}
          data-testid="world-minimap"
        />
      </figure>
    </main>
  );
}
