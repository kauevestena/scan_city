import { ArrowLeft } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AudioEngine } from '@/audio/AudioEngine';
import { CONTRACTS, findContract } from '@/data/contracts';
import { COSMETICS } from '@/data/cosmetics';
import { STRINGS } from '@/data/strings';
import { HoloEngine } from '@/engines/holo/HoloEngine';
import {
  buildHoloScene,
  HOLO_MODES,
  LOWER_QUALITY,
  type HoloDimension,
  type HoloMode,
  type HoloQuality,
} from '@/engines/holo/sceneBuilder';
import { useCanvas } from '@/engines/useCanvas';
import { useGameLoop } from '@/engines/useGameLoop';
import { InputManager, type ActionEvent } from '@/input/InputManager';
import { useFocusNavigation } from '@/input/useFocusNavigation';
import { useInputContext } from '@/input/useInputContext';
import { useGameStore } from '@/state/store';
import type { Contract } from '@/types';
import { Button } from '@/ui';
import { createTerrain } from '@/world/terrain/createTerrain';
import { HoloControls } from './HoloControls';
import { SectorCard } from './SectorCard';
import { WingsPanel } from './WingsPanel';

const H = STRINGS.holo;

/** Ala do setor focado na chegada ("Enviar ao Museu"): a mesa abre na dimensão dele. */
function arrivalContract(): Contract | undefined {
  const payload = useGameStore.getState().session.payload as
    { focusSectorId?: unknown } | undefined;
  return typeof payload?.focusSectorId === 'string'
    ? findContract(payload.focusSectorId)
    : undefined;
}

const goBack = () => useGameStore.getState().goTo('OFFICE');

/**
 * Mesa Holográfica (holo-table §3–§5): a ala Real em grade e o anel de dioramas do Multiverso,
 * nos modos Ortofoto, Hipsometria e LiDAR Neon; seleção, painel de alas com destaque, chegada do
 * processamento e queda automática de qualidade da mesa.
 */
export function HoloTableScreen() {
  useInputContext('HOLO');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const surface = useCanvas(canvasRef);
  const sectors = useGameStore((s) => s.museum.sectors);
  const featured = useGameStore((s) => s.museum.featured);
  const contracts = useGameStore((s) => s.contracts);
  const discoveredRifts = useGameStore((s) => s.world.discoveredRifts);
  const settingsQuality = useGameStore((s) => s.settings.quality);

  const [arrival] = useState(arrivalContract);
  const [dimension, setDimension] = useState<HoloDimension>(arrival?.museum.wing ?? 'REAL');
  const [mode, setMode] = useState<HoloMode>('ORTHO');
  const [panelOpen, setPanelOpen] = useState(false);
  // A qualidade da mesa cai sozinha com FPS baixo; a global (configurações) não muda (§5.7).
  const [tableQuality, setTableQuality] = useState<HoloQuality>(settingsQuality);
  // A chegada do processamento já abre com o setor focado selecionado (o motor o foca e esculpe).
  const [selected, setSelected] = useState<number | null>(arrival?.museum.slot ?? null);

  const riftsAvailable =
    discoveredRifts.length > 0 ||
    Object.keys(sectors).some((id) => findContract(id)?.museum.wing === 'RIFT');

  const scene = useMemo(
    () =>
      buildHoloScene(sectors, contracts, tableQuality, createTerrain, CONTRACTS, {
        dimension,
        mode,
        featured,
      }),
    [sectors, contracts, tableQuality, dimension, mode, featured],
  );

  const [engine] = useState(
    () =>
      new HoloEngine({
        scene,
        input: InputManager.get(),
        focusSlot: arrival?.museum.slot ?? null,
        onSelect: setSelected,
        onSculptDone: () => AudioEngine.get().play('STAGE_DONE'),
        droneColors: () =>
          COSMETICS.find((c) => c.id === useGameStore.getState().inventory.equipped.dronePaint)
            ?.colors ?? { primary: '#64748b', secondary: '#0f172a' },
      }),
  );

  // FPS médio < 50 por 3 s: a qualidade da mesa cai um nível, com toast.
  useEffect(() => {
    engine.setLowFpsHandler(() => {
      const next = LOWER_QUALITY[tableQuality];
      if (!next) return;
      setTableQuality(next);
      useGameStore
        .getState()
        .pushToast({ type: 'warn', title: H.qualityDropped(H.qualityNames[next]) });
    });
  }, [engine, tableQuality]);

  // Setor a focar assim que a nova dimensão chegar ao motor (linha do painel de outra ala).
  const pendingFocus = useRef<number | null>(null);
  useEffect(() => {
    engine.setScene(scene);
    if (pendingFocus.current !== null) {
      engine.focus(pendingFocus.current);
      pendingFocus.current = null;
    }
  }, [engine, scene]);

  const switchDimension = useCallback(
    (next: HoloDimension) => {
      if (next === dimension) return;
      engine.select(null);
      setDimension(next);
    },
    [engine, dimension],
  );
  const toggleDimension = useCallback(() => {
    if (dimension === 'RIFT') return switchDimension('REAL');
    if (!riftsAvailable) {
      useGameStore.getState().pushToast({ type: 'info', title: H.noRifts });
      return;
    }
    switchDimension('RIFT');
  }, [dimension, riftsAvailable, switchDimension]);

  const focusContract = useCallback(
    (contract: Contract) => {
      if (contract.museum.wing === dimension) engine.focus(contract.museum.slot);
      else {
        pendingFocus.current = contract.museum.slot;
        switchDimension(contract.museum.wing);
      }
    },
    [engine, dimension, switchDimension],
  );

  // Modos e dimensão chegam como ações discretas (teclado na hora, gamepad no poll).
  useEffect(
    () =>
      InputManager.get().onAction((e) => {
        if (useGameStore.getState().session.paused) return;
        if (e.action === 'MODE_1') setMode('ORTHO');
        else if (e.action === 'MODE_2') setMode('HYPSO');
        else if (e.action === 'MODE_3') setMode('NEON');
        else if (e.action === 'FIRE')
          setMode((m) => HOLO_MODES[(HOLO_MODES.indexOf(m) + 1) % HOLO_MODES.length] ?? m);
        else if (e.action === 'TOGGLE_DIMENSION') toggleDimension();
      }),
    [toggleDimension],
  );

  // Camada de base: Voltar, painel de alas, seleção espacial (analógico/D-pad) e destaque.
  useEffect(
    () =>
      InputManager.get().pushLayer({
        context: 'HOLO',
        modal: false,
        handler: (e: ActionEvent) => {
          switch (e.action) {
            case 'UI_BACK':
              goBack();
              return true;
            case 'UI_TAB_NEXT':
              setPanelOpen((open) => !open);
              return true;
            case 'UI_UP':
              engine.moveSelection('UP');
              return true;
            case 'UI_DOWN':
              engine.moveSelection('DOWN');
              return true;
            case 'UI_LEFT':
              engine.moveSelection('LEFT');
              return true;
            case 'UI_RIGHT':
              engine.moveSelection('RIGHT');
              return true;
            case 'UI_CONFIRM': {
              // Com um botão focado, o Enter já o ativa (nativo): não destaca em dobro.
              const el = document.activeElement;
              if (e.device === 'KEYBOARD' && el instanceof HTMLElement && el.matches('button, a')) {
                return false;
              }
              const sector =
                engine.selected === null ? undefined : engine.sectorAt(engine.selected);
              if (sector?.mapped && sector.contract) {
                const { museum, setFeatured } = useGameStore.getState();
                const on = museum.featured[sector.wing] === sector.contract.id;
                setFeatured(sector.wing, on ? null : sector.contract.id);
              }
              return true;
            }
            default:
              return false;
          }
        },
      }),
    [engine],
  );

  // Com o painel aberto, o analógico e o D-pad navegam pelos botões dele.
  const mainRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  useFocusNavigation(panelRef, {
    context: 'HOLO',
    active: panelOpen,
    onBack: goBack,
    onTabNext: () => setPanelOpen(false),
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
  const sector = selected === null ? undefined : scene.sectors.find((s) => s.slot === selected);

  return (
    <main
      ref={mainRef}
      data-testid="holo-screen"
      data-dimension={dimension}
      data-mode={mode}
      data-sectors={scene.sectors.length}
      data-mapped={scene.mappedCount}
      data-quality={tableQuality}
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
      <HoloControls
        dimension={dimension}
        mode={mode}
        riftsAvailable={riftsAvailable}
        panelOpen={panelOpen}
        onDimension={switchDimension}
        onMode={setMode}
        onTogglePanel={() => setPanelOpen((open) => !open)}
      />
      {scene.mappedCount === 0 && (
        <p
          className="pointer-events-none absolute inset-x-0 top-1/3 text-center text-lg text-slate-300"
          data-testid="holo-empty"
        >
          {H.empty}
        </p>
      )}
      {panelOpen && (
        <WingsPanel ref={panelRef} onClose={() => setPanelOpen(false)} onFocus={focusContract} />
      )}
      <div className="absolute bottom-4 left-4 flex flex-col gap-3">
        {sector && <SectorCard sector={sector} />}
        <div className="flex items-center gap-3">
          <Button icon={ArrowLeft} glyph="UI_BACK" onClick={goBack}>
            {H.back}
          </Button>
          <span className="text-xs text-slate-400">{H.controls}</span>
        </div>
      </div>
    </main>
  );
}
