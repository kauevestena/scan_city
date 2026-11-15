import { useEffect, useMemo, useRef, useState } from 'react';
import { AudioEngine } from '@/audio/AudioEngine';
import { ACTIVE_HOTSPOTS, DOOR_HINT_MS, OFFICE_HOTSPOTS, type OfficeHotspot } from '@/data/office';
import { STRINGS } from '@/data/strings';
import { COSMETICS } from '@/data/cosmetics';
import { SOUVENIRS } from '@/data/souvenirs';
import { HoloPreview } from '@/engines/holo/HoloPreview';
import { buildHoloScene } from '@/engines/holo/sceneBuilder';
import { fitOffice, hotspotStyle } from '@/engines/office/hotspots';
import { OfficeRenderer, type OfficeSceneState } from '@/engines/office/OfficeRenderer';
import { useCanvas } from '@/engines/useCanvas';
import { useGameLoop } from '@/engines/useGameLoop';
import { useFocusNavigation } from '@/input/useFocusNavigation';
import { DEFAULT_SPAWN } from '@/state/slices/worldSlice';
import { useGameStore } from '@/state/store';
import type { GameStore } from '@/state/types';
import { cx, EmblemBadge, FOCUS_RING } from '@/ui';
import { NamedIcon } from '@/ui/iconRegistry';
import { useElementSize } from '@/ui/useElementSize';
import { createTerrain } from '@/world/terrain/createTerrain';
import { CareerPanel } from './CareerPanel';
import { GaragePanel } from './GaragePanel';
import { IntroSequence } from './IntroSequence';
import { PerchPanel } from './PerchPanel';
import { ShelfPanel } from './ShelfPanel';
import { StaffPanel } from './StaffPanel';
import { WorkstationPanel } from './WorkstationPanel';

type PanelId = 'WORKSTATION' | 'GARAGE' | 'CAREER' | 'STAFF' | 'PERCH' | 'SHELF';

function sceneState(s: GameStore, holo: OfficeSceneState['holo']): OfficeSceneState {
  const accessory = COSMETICS.find((c) => c.id === s.inventory.equipped.atlasAccessory);
  return {
    aircraft: s.inventory.aircraft,
    vehicles: s.inventory.vehicles,
    hardware: s.inventory.hardware,
    souvenirColors: SOUVENIRS.filter((sv) => s.souvenirs.includes(sv.id)).map((sv) => sv.color),
    staff: s.staff,
    atlasAccessory: accessory && accessory.id !== 'ATLAS_NONE' ? accessory.colors : null,
    holo,
  };
}

function HotspotButton({
  hotspot,
  highlight,
  onActivate,
}: {
  hotspot: OfficeHotspot;
  highlight: boolean;
  onActivate: () => void;
}) {
  const reduceFlashes = useGameStore((s) => s.settings.reduceFlashes);
  return (
    <button
      type="button"
      data-focusable
      data-focus-id={hotspot.id}
      data-hotspot={hotspot.id}
      aria-label={hotspot.label}
      onClick={onActivate}
      style={hotspotStyle(hotspot)}
      className={cx(
        'group absolute rounded-lg border-2 border-transparent hover:border-cyan-400/70 focus-visible:border-cyan-400',
        FOCUS_RING,
      )}
    >
      <span
        className={cx(
          'pointer-events-none absolute -top-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-cyan-400/60 bg-slate-950/90 px-2.5 py-1 text-xs whitespace-nowrap text-cyan-300 transition-opacity',
          highlight
            ? 'opacity-100'
            : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 pad:group-focus:opacity-100',
          highlight && !reduceFlashes && 'animate-pulse',
        )}
      >
        <NamedIcon name={hotspot.icon} size={16} strokeWidth={1.75} aria-hidden />
        {hotspot.label}
      </span>
    </button>
  );
}

/** Escritório (office §3–§5): sala em Canvas com hotspots, Workstation e introdução. */
export function OfficeScreen() {
  const introSeen = useGameStore((s) => s.flags.introSeen);
  const emblem = useGameStore((s) => s.inventory.emblem);
  const [panel, setPanel] = useState<PanelId | null>(null);
  const [doorHint, setDoorHint] = useState(false);
  const areaRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const area = useElementSize(areaRef);
  const box = fitOffice(area.width, area.height);
  const surface = useCanvas(canvasRef);

  useFocusNavigation(areaRef, { active: introSeen && panel === null });

  // Ao entrar: avisa missões pendentes e foca a Porta (ou a Workstation, se houver fila).
  useEffect(() => {
    if (!introSeen) return;
    const pending = useGameStore.getState().mission.pending.length;
    if (pending > 0) {
      useGameStore
        .getState()
        .pushToast({ type: 'info', title: STRINGS.office.pendingToast(pending) });
    }
    const target = pending > 0 ? 'WORKSTATION' : 'DOOR';
    areaRef.current?.querySelector<HTMLElement>(`[data-hotspot="${target}"]`)?.focus();
  }, [introSeen]);

  useEffect(() => {
    if (!doorHint) return;
    const timer = window.setTimeout(() => setDoorHint(false), DOOR_HINT_MS);
    return () => window.clearTimeout(timer);
  }, [doorHint]);

  const sectors = useGameStore((s) => s.museum.sectors);
  const contracts = useGameStore((s) => s.contracts);
  const quality = useGameStore((s) => s.settings.quality);
  // Preview com a resolução baixa: a mesa é pequena no escritório.
  const holo = useMemo(
    () =>
      new HoloPreview(
        buildHoloScene(sectors, contracts, quality === 'HIGH' ? 'MEDIUM' : 'LOW', createTerrain),
      ),
    [sectors, contracts, quality],
  );
  const holoRef = useRef(holo);
  useEffect(() => {
    holoRef.current = holo;
  }, [holo]);

  useGameLoop(() => {
    if (!surface) return null;
    const renderer = new OfficeRenderer();
    return {
      update: (dt) => renderer.update(dt),
      render: () =>
        renderer.render(
          surface.ctx,
          sceneState(useGameStore.getState(), holoRef.current),
          surface.width,
          surface.height,
        ),
    };
  }, [surface]);

  const activate = (id: OfficeHotspot['id']) => {
    const { goTo, setAvatar } = useGameStore.getState();
    if (id === 'DOOR') {
      // Sai pela porta: o avatar aparece no spawn `@`, ao lado dela.
      setAvatar({ ...DEFAULT_SPAWN, facing: 'S' });
      goTo('WORLD_MAP');
    } else if (id === 'HOLO_TABLE') goTo('HOLO_TABLE_VIEW');
    else if (id === 'LAB') goTo('INFOGRAPHIC_LAB');
    else if (id === 'WORKSTATION') setPanel('WORKSTATION');
    else if (id === 'GARAGE') setPanel('GARAGE');
    else if (id === 'CAREER') setPanel('CAREER');
    else if (id === 'STAFF') setPanel('STAFF');
    else if (id === 'SHELF') setPanel('SHELF');
    else if (id === 'PERCH') {
      // Clicar no Atlas arrulha, e abre o Poleiro.
      AudioEngine.get().play('PIGEON_COO');
      setPanel('PERCH');
    }
  };

  return (
    <main
      ref={areaRef}
      data-testid="office-screen"
      aria-label={STRINGS.office.title}
      className="relative flex h-full w-full items-center justify-center overflow-hidden bg-slate-950"
    >
      <div className="relative" style={{ width: box.width, height: box.height }}>
        <canvas
          ref={canvasRef}
          className="absolute inset-0 block h-full w-full"
          data-testid="office-canvas"
        />
        {/* Placa da empresa na parede, com o emblema do jogador (REQ-PRG-008). */}
        <div
          className="pointer-events-none absolute top-[5%] left-[47%] flex items-center gap-2"
          data-testid="office-emblem"
        >
          <EmblemBadge emblem={emblem} size={44} title={STRINGS.topBar.company} />
        </div>
        {OFFICE_HOTSPOTS.filter((h) => ACTIVE_HOTSPOTS.has(h.id)).map((h) => (
          <HotspotButton
            key={h.id}
            hotspot={h}
            highlight={h.id === 'DOOR' && doorHint}
            onActivate={() => activate(h.id)}
          />
        ))}
      </div>
      {panel === 'WORKSTATION' && (
        <WorkstationPanel
          onClose={() => {
            setPanel(null);
            areaRef.current?.querySelector<HTMLElement>('[data-hotspot="WORKSTATION"]')?.focus();
          }}
        />
      )}
      {panel === 'GARAGE' && (
        <GaragePanel
          onClose={() => {
            setPanel(null);
            areaRef.current?.querySelector<HTMLElement>('[data-hotspot="GARAGE"]')?.focus();
          }}
        />
      )}
      {panel === 'SHELF' && (
        <ShelfPanel
          onClose={() => {
            setPanel(null);
            areaRef.current?.querySelector<HTMLElement>('[data-hotspot="SHELF"]')?.focus();
          }}
        />
      )}
      {panel === 'PERCH' && (
        <PerchPanel
          onClose={() => {
            setPanel(null);
            areaRef.current?.querySelector<HTMLElement>('[data-hotspot="PERCH"]')?.focus();
          }}
        />
      )}
      {panel === 'STAFF' && (
        <StaffPanel
          onClose={() => {
            setPanel(null);
            areaRef.current?.querySelector<HTMLElement>('[data-hotspot="STAFF"]')?.focus();
          }}
        />
      )}
      {panel === 'CAREER' && (
        <CareerPanel
          onClose={() => {
            setPanel(null);
            areaRef.current?.querySelector<HTMLElement>('[data-hotspot="CAREER"]')?.focus();
          }}
        />
      )}
      {!introSeen && (
        <IntroSequence
          onDone={() => {
            useGameStore.getState().setFlags({ introSeen: true });
            setDoorHint(true);
          }}
        />
      )}
    </main>
  );
}
