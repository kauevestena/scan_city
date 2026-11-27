import { ArrowLeft } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { getDebugFlags } from '@/app/debugFlags';
import { AudioEngine } from '@/audio/AudioEngine';
import { FlightAmbience } from '@/audio/flightAmbience';
import { gradeTone } from '@/audio/gradeScale';
import type { LoopHandle } from '@/audio/sfx';
import { CATALOG, getAircraft } from '@/data/catalog';
import { getContract } from '@/data/contracts';
import { COSMETICS } from '@/data/cosmetics';
import { missionHasData } from '@/domain/sorties';
import { STRINGS } from '@/data/strings';
import { cropEnergy } from '@/engines/flight/atlas';
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
import { useFlightCoach } from './flightCoach';

/** A etapa do tutorial dirigido do C00 que cabe ao voo. */
const FLIGHT_TUTORIAL_STEP = 3;
/**
 * Resolução adaptativa do voo (ADR-033): pode descer até 0,75 px de buffer por px de CSS. O céu
 * cobre o canvas inteiro, então o contexto é opaco (ADR-034).
 */
const FLIGHT_RESOLUTION = { kind: 'flight', floor: 0.75, opaque: true } as const;

/** Aceleração do autopilot de depuração (survey-flight §5.14: o debug permite ×8). */
export const AUTOPILOT_TIME_SCALE = 8;
/** Tempo até o autopilot confirmar "Levar dados" no pós-voo. */
export const AUTOPILOT_CONFIRM_MS = 1500;

const colorsOf = (id: string) => COSMETICS.find((c) => c.id === id)?.colors ?? null;

function createEngine(
  mission: MissionData,
  onHud: (s: FlightHudSnapshot) => void,
  onEnd: (r: SortieResult) => void,
  ambience: FlightAmbience,
): FlightEngine {
  const state = useGameStore.getState();
  const contract = getContract(mission.contractId);
  // Zumbido contínuo do LiDAR, enquanto o sensor ativo for o LiDAR.
  let lidarLoop: LoopHandle | null = null;
  // Grau da escala da sequência de notas (audio §4).
  let degree = -1;
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
    calm: getDebugFlags().calm,
    quality: () => useGameStore.getState().settings.quality,
    reduceFlashes: () => useGameStore.getState().settings.reduceFlashes,
    // O Atlas usa as cores do pombo; os drones, a pintura equipada.
    colors: atlas ? { primary: '#94a3b8', secondary: '#475569' } : paint,
    accessory:
      atlas && equipped.atlasAccessory !== 'ATLAS_NONE' ? colorsOf(equipped.atlasAccessory) : null,
    ...(atlas && equipped.atlasAccessory !== 'ATLAS_NONE'
      ? { accessoryId: equipped.atlasAccessory }
      : {}),
    initialEnergy: atlas ? cropEnergy(state.inventory.corn.crop) : 1,
    sortie: mission.sorties.length,
    shotOffset: mission.shots.length,
    onShots: (batch) => useGameStore.getState().appendShots(batch),
    onShutter: () => AudioEngine.get().play('SHUTTER'),
    onCollision: () => AudioEngine.get().play('CRASH'),
    onRing: () => AudioEngine.get().play('COLLECT'),
    onDetected: () => AudioEngine.get().play('ALERT'),
    onSensorChange: (sensor, scanHz) => {
      lidarLoop?.stop(0.2);
      lidarLoop = null;
      if (sensor === 'LIDAR') {
        lidarLoop = AudioEngine.get().startLoop('LIDAR_HUM');
        lidarLoop.setParam('rate', scanHz);
      }
    },
    onHint: (text) => useGameStore.getState().pushToast({ type: 'info', title: text }),
    onRthBeep: () => AudioEngine.get().play('RTH_BEEP'),
    onRtkChange: (status) => {
      if (status === 'FLOAT') {
        useGameStore
          .getState()
          .pushToast({ type: 'warn', title: STRINGS.flight.alerts.RTK_FLOAT() });
      }
    },
    onCrash: () => AudioEngine.get().play('CRASH'),
    onGrade: (g) => {
      const t = gradeTone(degree, g.grade);
      degree = t.degree;
      AudioEngine.get().play(t.sfx, { pitch: t.pitch });
    },
    onLinePass: (r) => AudioEngine.get().play(r.accepted ? 'STAGE_DONE' : 'DENIED'),
    // A rajada que bate sem contragolpe sopra grave; a cortada no tempo, o vento rasgado.
    onGustImpact: (cut) => AudioEngine.get().play(cut ? 'GUST_CUT' : 'GUST_HIT'),
    // A curva no tempo varre o ar; cedo, tarde ou do lado errado, o som surdo da arremetida.
    onTurn: (t) => AudioEngine.get().play(t.result === 'ON_TIME' ? 'TURN_OK' : 'GRADE_MISS'),
    onHud: (snap) => {
      // O motor segue a velocidade e o vento, o ganho do vento.
      ambience.update(snap.speedMs, snap.windCrossMs);
      onHud(snap);
    },
    onSortieEnd: (result) => {
      lidarLoop?.stop(0.2);
      lidarLoop = null;
      ambience.stop();
      useGameStore.getState().endSortie(result);
      completeTutorialStep(FLIGHT_TUTORIAL_STEP);
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
  return <FlightHost mission={mission} />;
}

/** Uma nova surtida remonta o voo (engine novo); o resto da tela segue igual. */
function FlightHost({ mission }: { mission: MissionData }) {
  const [attempt, setAttempt] = useState(0);
  return <Flight key={attempt} mission={mission} onNewSortie={() => setAttempt((n) => n + 1)} />;
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

function Flight({ mission, onNewSortie }: { mission: MissionData; onNewSortie: () => void }) {
  useInputContext('FLIGHT');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const surface = useCanvas(canvasRef, FLIGHT_RESOLUTION);
  const [hud, setHud] = useState<FlightHudSnapshot | null>(null);
  const [result, setResult] = useState<SortieResult | null>(null);
  const [ambience] = useState(
    () => new FlightAmbience(AudioEngine.get(), getAircraft(mission.plan.params.aircraftId).kind),
  );
  const [engine] = useState(() => createEngine(mission, setHud, setResult, ambience));
  // As dicas do primeiro voo só valem enquanto a dica da etapa do voo está na tela.
  const coaching = useGameStore((s) => s.flags.tutorialStep === FLIGHT_TUTORIAL_STEP);
  const coach = useFlightCoach(hud, coaching && !result);
  const autopilot = getDebugFlags().autopilot;

  // FIRE chega como ação discreta: disparo manual.
  useEffect(
    () =>
      InputManager.get().onAction((e) => {
        if (useGameStore.getState().session.paused) return;
        if (e.action === 'FIRE') engine.manualShot();
        else if (e.action === 'RTH') engine.requestRth();
        else if (e.action === 'TOGGLE_SENSOR') engine.toggleSensor();
        else if (e.action === 'TIME_WARP') engine.cycleTimeWarp();
        // O Esc cancela a confirmação do RTH (e também pausa).
        else if (e.action === 'PAUSE') engine.cancelRth();
      }),
    [engine],
  );

  // Motor e vento: ligam com a tela, calam na pausa e param ao sair (ou ao fim da surtida).
  useEffect(() => {
    ambience.start();
    ambience.setPaused(useGameStore.getState().session.paused);
    const off = useGameStore.subscribe((state, prev) => {
      if (state.session.paused !== prev.session.paused) ambience.setPaused(state.session.paused);
    });
    return () => {
      off();
      ambience.stop();
    };
  }, [ambience]);

  // Ao sair da tela, o zumbido do LiDAR para.
  useEffect(() => () => engine.dispose(), [engine]);

  // O autopilot de depuração leva os dados sozinho (para o E2E).
  useEffect(() => {
    if (!autopilot || !result) return;
    const timer = window.setTimeout(() => {
      const { mission: m, queueActive, goTo, startNewSortie } = useGameStore.getState();
      if (!m.active) return;
      // Com linhas incompletas e energia reserva, segue para outra surtida.
      if (startNewSortie()) {
        onNewSortie();
        return;
      }
      if (!missionHasData(m.active)) return;
      queueActive();
      goTo('WORLD_MAP', { outcome: 'QUEUED' });
    }, AUTOPILOT_CONFIRM_MS);
    return () => window.clearTimeout(timer);
  }, [autopilot, result, onNewSortie]);

  useGameLoop(
    () => {
      if (!surface) return null;
      engine.attach(surface);
      return engine;
    },
    [surface, engine],
    { timeScale: () => (autopilot ? AUTOPILOT_TIME_SCALE : engine.timeScale) },
  );

  return (
    <main
      data-testid="survey-flight-screen"
      data-flashes={hud?.flashes ?? 0}
      aria-label={STRINGS.flight.title}
      className="relative h-full w-full overflow-hidden bg-slate-950"
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 block h-full w-full"
        data-testid="flight-canvas"
      />
      {hud && <FlightHud snap={hud} rift={getContract(mission.contractId).dimension === 'RIFT'} />}
      <TutorialHint
        step={FLIGHT_TUTORIAL_STEP}
        detail={coach ? STRINGS.tutorial.flightCoach[coach] : null}
        className="absolute top-28 left-1/2 -translate-x-1/2"
      />
      {result && (
        <PostFlightDialog
          onNewSortie={onNewSortie}
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
