import { ArrowLeft } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { getDebugFlags } from '@/app/debugFlags';
import { AudioEngine } from '@/audio/AudioEngine';
import { CATALOG } from '@/data/catalog';
import { getContract } from '@/data/contracts';
import { COSMETICS } from '@/data/cosmetics';
import { STRINGS } from '@/data/strings';
import { FlightEngine, type SortieResult } from '@/engines/flight/FlightEngine';
import type { FlightHudSnapshot } from '@/engines/flight/hudPublisher';
import { useCanvas } from '@/engines/useCanvas';
import { useGameLoop } from '@/engines/useGameLoop';
import { InputManager } from '@/input/InputManager';
import { useInputContext } from '@/input/useInputContext';
import { selectModifiers } from '@/state/selectors';
import { useGameStore } from '@/state/store';
import type { MissionData } from '@/types';
import { Button } from '@/ui';
import { createTerrain } from '@/world/terrain/createTerrain';
import { FlightHud } from './FlightHud';
import { PostFlightDialog } from './PostFlightDialog';
import { completeTutorialStep, TutorialHint } from '../common/TutorialHint';

/** Aceleração do autopilot de depuração (survey-flight §5.14: o debug permite ×8). */
export const AUTOPILOT_TIME_SCALE = 8;
/** Tempo até o autopilot confirmar "Levar dados" no pós-voo. */
export const AUTOPILOT_CONFIRM_MS = 1500;

const colorsOf = (id: string) => COSMETICS.find((c) => c.id === id)?.colors ?? null;

function createEngine(
  mission: MissionData,
  onHud: (s: FlightHudSnapshot) => void,
  onEnd: (r: SortieResult) => void,
): FlightEngine {
  const state = useGameStore.getState();
  const contract = getContract(mission.contractId);
  const { equipped } = state.inventory;
  const atlas = mission.plan.params.aircraftId === 'ATLAS';
  const paint = colorsOf(equipped.dronePaint) ?? { primary: '#64748b', secondary: '#0f172a' };
  const engine = new FlightEngine({
    mission,
    contract,
    terrain: createTerrain(contract),
    catalog: CATALOG,
    input: InputManager.get(),
    mods: selectModifiers(state),
    ownsRtkKit: state.inventory.fieldEquipment.includes('GNSS_RTK_KIT'),
    autopilot: getDebugFlags().autopilot,
    quality: () => useGameStore.getState().settings.quality,
    reduceFlashes: () => useGameStore.getState().settings.reduceFlashes,
    // O Atlas usa as cores do pombo; os drones, a pintura equipada.
    colors: atlas ? { primary: '#94a3b8', secondary: '#475569' } : paint,
    accessory:
      atlas && equipped.atlasAccessory !== 'ATLAS_NONE' ? colorsOf(equipped.atlasAccessory) : null,
    sortie: mission.sorties.length,
    shotOffset: mission.shots.length,
    onShots: (batch) => useGameStore.getState().appendShots(batch),
    onShutter: () => AudioEngine.get().play('SHUTTER'),
    onCollision: () => AudioEngine.get().play('CRASH'),
    onCrash: () => AudioEngine.get().play('CRASH'),
    onHud,
    onSortieEnd: (result) => {
      useGameStore.getState().endSortie(result);
      completeTutorialStep(3);
      onEnd(result);
    },
  });
  if (atlas) AudioEngine.get().play('PIGEON_COO');
  else AudioEngine.get().play('TAKEOFF');
  return engine;
}

/** Voo de levantamento (survey-flight §3–§6). */
export function SurveyFlightScreen() {
  const mission = useGameStore((s) => s.mission.active);
  if (!mission || mission.status !== 'IN_FLIGHT') return <NoFlight />;
  return <Flight mission={mission} />;
}

function NoFlight() {
  return (
    <main
      className="flex h-full w-full flex-col items-center justify-center gap-4 bg-slate-950"
      data-testid="survey-flight-screen"
    >
      <p className="text-slate-300">{STRINGS.flight.noMission}</p>
      <Button
        icon={ArrowLeft}
        onClick={() => useGameStore.getState().goTo('WORLD_MAP', { outcome: 'ABORTED' })}
      >
        {STRINGS.field.backToMap}
      </Button>
    </main>
  );
}

function Flight({ mission }: { mission: MissionData }) {
  useInputContext('FLIGHT');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const surface = useCanvas(canvasRef);
  const [hud, setHud] = useState<FlightHudSnapshot | null>(null);
  const [result, setResult] = useState<SortieResult | null>(null);
  const [engine] = useState(() => createEngine(mission, setHud, setResult));
  const autopilot = getDebugFlags().autopilot;

  // FIRE chega como ação discreta: disparo manual.
  useEffect(
    () =>
      InputManager.get().onAction((e) => {
        if (e.action === 'FIRE' && !useGameStore.getState().session.paused) engine.manualShot();
      }),
    [engine],
  );

  // O autopilot de depuração leva os dados sozinho (para o E2E).
  useEffect(() => {
    if (!autopilot || !result) return;
    const timer = window.setTimeout(() => {
      const { mission: m, queueActive, goTo } = useGameStore.getState();
      if (!m.active || m.active.shots.length === 0) return;
      queueActive();
      goTo('WORLD_MAP', { outcome: 'QUEUED' });
    }, AUTOPILOT_CONFIRM_MS);
    return () => window.clearTimeout(timer);
  }, [autopilot, result]);

  useGameLoop(
    () => {
      if (!surface) return null;
      engine.attach(surface);
      return engine;
    },
    [surface, engine],
    { timeScale: () => (autopilot ? AUTOPILOT_TIME_SCALE : 1) },
  );

  return (
    <main
      data-testid="survey-flight-screen"
      aria-label={STRINGS.flight.title}
      className="relative h-full w-full overflow-hidden bg-slate-950"
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 block h-full w-full"
        data-testid="flight-canvas"
      />
      {hud && <FlightHud snap={hud} />}
      <TutorialHint step={3} className="absolute top-28 left-1/2 -translate-x-1/2" />
      {result && (
        <PostFlightDialog
          result={result}
          totalLines={mission.plan.lines.length}
          energyLeft={engine.energy}
        />
      )}
      {result && autopilot && (
        <p className="absolute right-4 bottom-4 text-sm text-cyan-300">
          {STRINGS.flight.post.autopilot}
        </p>
      )}
    </main>
  );
}
