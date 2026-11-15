import { ArrowLeft } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AudioEngine } from '@/audio/AudioEngine';
import { COSMETICS } from '@/data/cosmetics';
import { STRINGS } from '@/data/strings';
import { HoloEngine } from '@/engines/holo/HoloEngine';
import { buildHoloScene } from '@/engines/holo/sceneBuilder';
import { useCanvas } from '@/engines/useCanvas';
import { useGameLoop } from '@/engines/useGameLoop';
import { InputManager } from '@/input/InputManager';
import { useFocusNavigation } from '@/input/useFocusNavigation';
import { useInputContext } from '@/input/useInputContext';
import { useGameStore } from '@/state/store';
import { Button } from '@/ui';
import { createTerrain } from '@/world/terrain/createTerrain';
import { findContract } from '@/data/contracts';
import { SectorCard } from './SectorCard';

const H = STRINGS.holo;

/** Mesa Holográfica v1 (holo-table §3–§5): ala Real em ORTHO, seleção e chegada do processamento. */
export function HoloTableScreen() {
  useInputContext('HOLO');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const surface = useCanvas(canvasRef);
  const sectors = useGameStore((s) => s.museum.sectors);
  const contracts = useGameStore((s) => s.contracts);
  const quality = useGameStore((s) => s.settings.quality);
  const scene = useMemo(
    () => buildHoloScene(sectors, contracts, quality, createTerrain),
    [sectors, contracts, quality],
  );
  const [selected, setSelected] = useState<number | null>(null);

  const [engine] = useState(() => {
    const payload = useGameStore.getState().session.payload as
      { focusSectorId?: unknown } | undefined;
    const focusId = typeof payload?.focusSectorId === 'string' ? payload.focusSectorId : null;
    // A mesa v1 só mostra a ala Real: o `slot` de uma fenda é do anel do Multiverso (T072).
    const focusContract = focusId ? findContract(focusId) : undefined;
    const focusSlot = focusContract?.museum.wing === 'REAL' ? focusContract.museum.slot : null;
    return new HoloEngine({
      scene,
      input: InputManager.get(),
      focusSlot,
      onSelect: setSelected,
      onSculptDone: () => AudioEngine.get().play('STAGE_DONE'),
      droneColors: () =>
        COSMETICS.find((c) => c.id === useGameStore.getState().inventory.equipped.dronePaint)
          ?.colors ?? { primary: '#64748b', secondary: '#0f172a' },
    });
  });
  const [initialSelected] = useState(() => engine.selected);

  useEffect(() => engine.setScene(scene), [engine, scene]);

  // UI_BACK (Esc, Backspace, B) volta ao escritório (T14). Numa camada, para o Esc não
  // cair também no fallback de pausa.
  const mainRef = useRef<HTMLElement>(null);
  useFocusNavigation(mainRef, {
    context: 'HOLO',
    onBack: () => useGameStore.getState().goTo('OFFICE'),
  });

  useGameLoop(() => {
    if (!surface) return null;
    engine.attach(surface);
    return engine;
  }, [surface, engine]);

  const local = (e: { clientX: number; clientY: number }) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    return { x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0) };
  };
  const shown = selected ?? initialSelected;
  const sector = shown === null ? undefined : scene.sectors.find((s) => s.slot === shown);

  return (
    <main
      ref={mainRef}
      data-testid="holo-screen"
      aria-label={H.title}
      className="relative h-full w-full overflow-hidden bg-slate-950"
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={H.canvasLabel}
        className="absolute inset-0 block h-full w-full touch-none"
        data-testid="holo-canvas"
        onPointerDown={(e) => {
          const p = local(e);
          engine.pointerDown(p.x, p.y);
        }}
        onPointerMove={(e) => {
          const p = local(e);
          engine.pointerMove(p.x, p.y);
        }}
        onPointerUp={(e) => {
          const p = local(e);
          engine.pointerUp(p.x, p.y);
        }}
        onWheel={(e) => engine.wheel(e.deltaY)}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between p-3">
        <span className="rounded-md bg-slate-950/70 px-3 py-1.5 text-sm text-cyan-300">
          {H.modeOrtho}
        </span>
      </div>
      {scene.mappedCount === 0 && (
        <p
          className="pointer-events-none absolute inset-x-0 top-1/3 text-center text-lg text-slate-300"
          data-testid="holo-empty"
        >
          {H.empty}
        </p>
      )}
      <div className="absolute bottom-4 left-4 flex flex-col gap-3">
        {sector && <SectorCard sector={sector} />}
        <div className="flex items-center gap-3">
          <Button
            icon={ArrowLeft}
            glyph="UI_BACK"
            onClick={() => useGameStore.getState().goTo('OFFICE')}
          >
            {H.back}
          </Button>
          <span className="text-xs text-slate-400">{H.controls}</span>
        </div>
      </div>
    </main>
  );
}
