import { useEffect, useRef, useState } from 'react';
import { getDebugFlags } from '@/app/debugFlags';
import { characterColors } from '@/data/cosmetics';
import { getVehicle } from '@/data/catalog';
import { STRINGS } from '@/data/strings';
import { drawMinimap, renderMinimapBase } from '@/engines/overworld/minimap';
import {
  OverworldEngine,
  type InteractTarget,
  type SkinColors,
} from '@/engines/overworld/OverworldEngine';
import { useCanvas } from '@/engines/useCanvas';
import { useGameLoop } from '@/engines/useGameLoop';
import { InputManager } from '@/input/InputManager';
import { useInputContext } from '@/input/useInputContext';
import { selectModifiers } from '@/state/selectors';
import { nextVehicle } from '@/state/slices/worldSlice';
import { useGameStore } from '@/state/store';
import type { GameStore } from '@/state/types';
import type { Dimension } from '@/types';
import { Tabs, type TabDef } from '@/ui';
import { activeDimension, markerViews, type MarkerView } from '@/world/overworld/markers';
import { WORLD_MAP } from '@/world/overworld/tiles';
import { BriefingModal } from './BriefingModal';
import { rollFieldEvent } from '@/domain/fieldEvents';
import { mulberry32 } from '@/lib/rng';
import type { FieldEventRuntime } from '@/engines/overworld/fieldEventRuntime';
import { createFieldEventRuntime } from './fieldEventDeps';
import { CattleBanner, FieldEventModal } from './FieldEventModal';

import { MarkerLayer } from './MarkerLayer';
import { completeTutorialStep, TutorialHint } from '../common/TutorialHint';

const W = STRINGS.world;
/** Tempo que a dica de bloqueio fica na tela. */
export const HINT_VISIBLE_MS = 2500;
/** Intervalo de gravação da posição do avatar (world-map §5.3). */
export const AVATAR_SAVE_MS = 1000;

type Tab = Dimension;

let minimapBase: HTMLCanvasElement | null = null;
function getMinimapBase(): HTMLCanvasElement {
  minimapBase ??= renderMinimapBase(WORLD_MAP);
  return minimapBase;
}

let markerCache: {
  contracts: GameStore['contracts'];
  rifts: readonly string[];
  tab: Tab;
  views: readonly MarkerView[];
} | null = null;

/** Marcadores da aba atual, recalculados só quando os contratos, as fendas ou a aba mudam. */
function currentMarkers(): readonly MarkerView[] {
  const { contracts, world } = useGameStore.getState();
  const tab = activeDimension(world);
  if (
    markerCache?.contracts !== contracts ||
    markerCache.rifts !== world.discoveredRifts ||
    markerCache.tab !== tab
  ) {
    // Na aba Real só os contratos 0–6; na das Fendas, só as fendas descobertas (a–k).
    const views = markerViews(contracts, tab, world.discoveredRifts);
    markerCache = { contracts, rifts: world.discoveredRifts, tab, views };
  }
  return markerCache.views;
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
export function WorldMapScreen({ eventRuntime }: { eventRuntime?: FieldEventRuntime } = {}) {
  useInputContext('OVERWORLD');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const surface = useCanvas(canvasRef);
  const vehicle = useGameStore((s) => s.world.vehicleMode);
  const world = useGameStore((s) => s.world);
  const tab = activeDimension(world);
  const tabs: ReadonlyArray<TabDef<Tab>> = [
    { id: 'REAL', label: W.tabs.REAL },
    ...(world.discoveredRifts.length > 0 ? [{ id: 'RIFT' as const, label: W.tabs.RIFT }] : []),
  ];
  const [target, setTarget] = useState<InteractTarget | null>(null);
  const [briefing, setBriefing] = useState<string | null>(null);
  const [hint, setHint] = useState<{ text: string; id: number } | null>(null);

  const [runtime] = useState(() => eventRuntime ?? createFieldEventRuntime());
  const [engine] = useState(() => {
    const s = useGameStore.getState();
    const e: OverworldEngine = new OverworldEngine({
      input: InputManager.get(),
      start: s.world.avatar,
      vehicle: () => useGameStore.getState().world.vehicleMode,
      speedMod: () => selectModifiers(useGameStore.getState()).overworldSpeed * runtime.speedFactor,
      skin: skinColors,
      markers: currentMarkers,
      dimension: () => activeDimension(useGameStore.getState().world),
      reduceFlashes: () => useGameStore.getState().settings.reduceFlashes,
      onHint: (text) => setHint({ text, id: performance.now() }),
      onTargetChange: setTarget,
      blocked: () => runtime.blocking,
      rain: () => runtime.rainActive,
      // Um sorteio por tile inteiro, com o RNG de (save, distância percorrida).
      onTile: (tile) => {
        if (runtime.blocking) return;
        const { stats, createdAt, world } = useGameStore.getState();
        const tiles = Math.floor(stats.distanceTiles + e.pendingDistance);
        // A seed global é a do save, ou a de `?seed=` na depuração.
        const seed = getDebugFlags().seed ?? createdAt;
        const rng = mulberry32((seed ^ Math.imul(tiles, 0x9e3779b1)) >>> 0);
        const nowS = Date.now() / 1000;
        const id = rollFieldEvent(rng, tile, world.vehicleMode, nowS, world.lastEventAt);
        if (id && runtime.trigger(id)) useGameStore.getState().markFieldEvent(nowS);
      },
    });
    return e;
  });

  // Volta do voo com dados (world-map §3): lembra de levá-los à Workstation.
  useEffect(() => {
    const { session, pushToast } = useGameStore.getState();
    const payload = session.payload as { outcome?: unknown } | undefined;
    if (payload?.outcome === 'QUEUED') pushToast({ type: 'info', title: W.queuedToast });
  }, []);

  // INTERACT chega como ação discreta (teclado na hora, gamepad no poll).
  useEffect(
    () =>
      InputManager.get().onAction((e) => {
        if (useGameStore.getState().session.paused) return;
        if (e.action === 'TOGGLE_DIMENSION') {
          if (runtime.blocking) return;
          const { world: w, setDimensionTab } = useGameStore.getState();
          if (w.discoveredRifts.length === 0) setHint({ text: W.noRifts, id: performance.now() });
          else setDimensionTab(activeDimension(w) === 'RIFT' ? 'REAL' : 'RIFT');
          return;
        }
        if (e.action === 'CYCLE_VEHICLE') {
          const { inventory, world, cycleVehicle } = useGameStore.getState();
          const next = nextVehicle(inventory.vehicles, world.vehicleMode);
          if (next === world.vehicleMode) return;
          // O novo modo precisa caber no tile atual; senão, recusa com a dica.
          const refusal = engine.switchRefusal(next);
          if (refusal) setHint({ text: refusal, id: performance.now() });
          else cycleVehicle();
          return;
        }
        // Pneu e gado consomem o toque (mash / buzina); com um evento em curso, o mapa não interage.
        if ((e.action === 'INTERACT' || e.action === 'UI_CONFIRM') && runtime.interact()) return;
        if (runtime.blocking) return;
        if (e.action !== 'INTERACT') return;
        const hit = engine.interact();
        if (hit?.kind === 'DOOR') {
          flushEngine(engine);
          useGameStore.getState().goTo('OFFICE');
        } else if (hit?.kind === 'MARKER') {
          const open = () => {
            setBriefing(hit.marker.contractId);
            completeTutorialStep(0);
          };
          // Pelo teclado, abre ao soltar a tecla: o Espaço solto já no modal "clicaria" o
          // diálogo que recebe o foco.
          if (e.device === 'KEYBOARD') window.addEventListener('keyup', open, { once: true });
          else open();
        }
      }),
    [engine, runtime],
  );

  // Teleporte de depuração: a store muda o avatar por fora do engine.
  useEffect(
    () =>
      useGameStore.subscribe((s, prev) => {
        const a = s.world.avatar;
        if (a === prev.world.avatar) return;
        const p = engine.position;
        if (Math.abs(a.x - p.x) > 1e-6 || Math.abs(a.y - p.y) > 1e-6) engine.teleport(a.x, a.y);
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
      update: (dt) => {
        runtime.update(dt);
        engine.update(dt);
      },
      render: () => {
        engine.render();
        if (mini) {
          drawMinimap(
            mini,
            getMinimapBase(),
            currentMarkers(),
            engine.avatar,
            WORLD_MAP.door,
            performance.now() / 1000,
          );
        }
      },
    };
  }, [surface, engine, runtime]);

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
          <Tabs
            tabs={tabs}
            value={tab}
            onChange={(id) => useGameStore.getState().setDimensionTab(id)}
            ariaLabel={W.title}
          />
        </div>
        <span
          className="rounded-lg bg-slate-950/80 px-3 py-1.5 text-sm text-slate-200"
          data-testid="world-vehicle"
        >
          {W.vehicle(getVehicle(vehicle).name)}
        </span>
      </div>

      <MarkerLayer target={target} />
      <TutorialHint step={0} className="absolute top-16 left-1/2 -translate-x-1/2" />

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
      <CattleBanner runtime={runtime} />
      <FieldEventModal runtime={runtime} />
      {briefing && <BriefingModal contractId={briefing} onClose={() => setBriefing(null)} />}
    </main>
  );
}
