import { Compass, Crosshair } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { getAircraft } from '@/data/catalog';
import { STRINGS } from '@/data/strings';
import { gcpSigma } from '@/domain/accuracy';
import { gyroDriftDegPerHour } from '@/domain/minigameScoring';
import {
  BUBBLE_CANVAS_PX,
  BubbleSim,
  drawBubble,
  type BubbleColors,
  type Vec2,
} from '@/engines/field/minigames/bubble';
import {
  drawLemniscate,
  LEMNISCATE_CANVAS_H,
  LEMNISCATE_CANVAS_W,
  LEMNISCATE_DURATION_S,
  LEMNISCATE_READY_S,
  LemniscateSim,
  type LemniscateColors,
} from '@/engines/field/minigames/lemniscate';
import { useCanvas } from '@/engines/useCanvas';
import { useGameLoop } from '@/engines/useGameLoop';
import { InputManager } from '@/input/InputManager';
import { useInputContext } from '@/input/useInputContext';
import { formatNumber } from '@/lib/format';
import { hashString } from '@/lib/rng';
import { useGameStore } from '@/state/store';
import { Button, COLORS, Panel, ProgressBar } from '@/ui';
import type { FieldContext } from './useFieldContext';

const C = STRINGS.field.calibration;

const BUBBLE_COLORS: BubbleColors = {
  bg: COLORS.bgBase,
  ring: COLORS.border,
  target: COLORS.radarDim,
  targetActive: COLORS.ok,
  bubble: COLORS.radar,
};

const LEMNISCATE_COLORS: LemniscateColors = {
  bg: COLORS.bgBase,
  curve: COLORS.border,
  cursor: COLORS.radar,
  guide: COLORS.warn,
};

type Game = 'LEVEL' | 'IMU';

/** Aba 3 (field-setup §5.4): mini-games opcionais de calibração. */
export function CalibrationTab({ field }: { field: FieldContext }) {
  const { mission, equipment, predict } = field;
  const [attempt, setAttempt] = useState(0);
  // Um mini-game por vez: iniciar um encerra o outro.
  const [playing, setPlaying] = useState<Game | null>(null);
  const [lastOutcome, setLastOutcome] = useState<'LOCKED' | 'TIMEOUT' | null>(null);
  const level = mission.minigames.levelScore;
  const imu = mission.minigames.imuScore;
  const sigma = gcpSigma(equipment.sigmaBaseM, equipment.id, level);
  const rtkAircraft = getAircraft(mission.plan.params.aircraftId).rtk;
  const rtkNote = level !== undefined && predict.ownsRtkKit && rtkAircraft;
  const start = (game: Game) => {
    setAttempt((n) => n + 1);
    setLastOutcome(null);
    setPlaying(game);
  };

  return (
    <div className="flex flex-col gap-5" data-testid="calibration-tab">
      <p className="text-sm text-slate-300">{C.intro}</p>
      <Panel title={C.levelTitle}>
        <div className="flex flex-col gap-3">
          <p className="text-xs text-slate-400">{C.levelHelp}</p>
          {playing === 'LEVEL' ? (
            <BubbleGame
              key={attempt}
              seed={hashString(mission.id) + attempt}
              onFinish={(score, outcome) => {
                useGameStore.getState().recordMinigame('level', score);
                setLastOutcome(outcome);
                setPlaying(null);
              }}
            />
          ) : (
            <Button icon={Crosshair} onClick={() => start('LEVEL')}>
              {level === undefined ? C.levelStart : C.levelRetry}
            </Button>
          )}
          {lastOutcome && playing === null && (
            <p className="text-sm text-slate-200" data-testid="level-outcome">
              {lastOutcome === 'LOCKED' ? C.levelLocked : C.levelDone}
            </p>
          )}
          <p
            className={
              level !== undefined && level >= 0.9
                ? 'text-sm text-emerald-300'
                : 'text-sm text-slate-200'
            }
            data-testid="level-score"
          >
            {level === undefined ? C.levelDefault : C.levelScore(formatNumber(level * 100, 0))}
          </p>
          <p className="font-mono text-sm text-cyan-300" data-testid="level-sigma">
            {C.sigma(formatNumber(sigma.xy * 100, 1))}
          </p>
          {rtkNote && <p className="text-xs text-emerald-300">{C.rtkLevel}</p>}
        </div>
      </Panel>
      <Panel title={C.imuTitle}>
        <div className="flex flex-col gap-3">
          <p className="text-xs text-slate-400">{C.imuHelp}</p>
          {playing === 'IMU' ? (
            <ImuGame
              key={attempt}
              onFinish={(score) => {
                useGameStore.getState().recordMinigame('imu', score);
                setLastOutcome(null);
                setPlaying(null);
              }}
            />
          ) : (
            <Button icon={Compass} onClick={() => start('IMU')}>
              {imu === undefined ? C.imuStart : C.imuRetry}
            </Button>
          )}
          <p
            className={
              imu !== undefined && imu >= 0.9
                ? 'text-sm text-emerald-300'
                : 'text-sm text-slate-200'
            }
            data-testid="imu-score"
          >
            {imu === undefined ? C.imuDefault : C.imuScore(formatNumber(imu * 100, 0))}
          </p>
          <p className="font-mono text-sm text-amber-300" data-testid="imu-drift">
            {C.gyroDrift(formatNumber(gyroDriftDegPerHour(imu ?? 0), 1))}
          </p>
        </div>
      </Panel>
    </div>
  );
}

interface BubbleGameProps {
  seed: number;
  onFinish: (score: number, outcome: 'LOCKED' | 'TIMEOUT') => void;
}

/** O canvas 360×360 do nível de bolha; roda no `GameLoop` e se desmonta ao terminar. */
function BubbleGame({ seed, onFinish }: BubbleGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Durante o jogo, o D-pad e o analógico movem a bolha em vez de navegar o foco.
  useInputContext('MINIGAME');
  const surface = useCanvas(canvasRef);
  const [sim] = useState(() => new BubbleSim(seed));
  const [holdS, setHoldS] = useState(0);
  const pointer = useRef<Vec2 | null>(null);
  const finished = useRef(false);
  const onFinishRef = useRef(onFinish);
  useEffect(() => {
    onFinishRef.current = onFinish;
  });

  useGameLoop(() => {
    if (!surface) return null;
    const { ctx } = surface;
    return {
      update(dtS) {
        if (finished.current) return;
        const im = InputManager.get();
        // MOVE_Y positivo é "para cima"; no canvas o y cresce para baixo.
        sim.setInput({
          moveX: im.axis('MOVE_X'),
          moveY: -im.axis('MOVE_Y'),
          pointer: pointer.current,
        });
        sim.update(dtS);
        if (sim.phase === 'DONE') {
          finished.current = true;
          onFinishRef.current(sim.score, sim.locked ? 'LOCKED' : 'TIMEOUT');
        }
      },
      render() {
        drawBubble(ctx, sim, BUBBLE_COLORS, Math.min(surface.width, surface.height));
      },
    };
  }, [surface, sim]);

  // O cronômetro do alvo é de texto; 10 Hz bastam.
  useEffect(() => {
    const id = window.setInterval(() => setHoldS(sim.holdS), 100);
    return () => window.clearInterval(id);
  }, [sim]);

  const toLocal = (e: React.PointerEvent<HTMLCanvasElement>): Vec2 => {
    const rect = e.currentTarget.getBoundingClientRect();
    const scale = BUBBLE_CANVAS_PX / (rect.width || BUBBLE_CANVAS_PX);
    return {
      x: (e.clientX - rect.left) * scale - BUBBLE_CANVAS_PX / 2,
      y: (e.clientY - rect.top) * scale - BUBBLE_CANVAS_PX / 2,
    };
  };

  return (
    <div className="flex flex-col gap-2" data-testid="bubble-game">
      <div className="aspect-square w-full overflow-hidden rounded-md border border-slate-700">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={C.levelCanvas}
          className="block h-full w-full touch-none"
          data-testid="bubble-canvas"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture?.(e.pointerId);
            pointer.current = toLocal(e);
          }}
          onPointerMove={(e) => {
            if (pointer.current) pointer.current = toLocal(e);
          }}
          onPointerUp={() => {
            pointer.current = null;
          }}
          onPointerCancel={() => {
            pointer.current = null;
          }}
        />
      </div>
      <div className="flex items-center gap-2 text-xs text-slate-300">
        <span className="font-mono">{C.levelHold(formatNumber(holdS, 1))}</span>
        <div className="flex-1">
          <ProgressBar value={Math.min(1, holdS / 3)} />
        </div>
      </div>
    </div>
  );
}

interface ImuGameProps {
  onFinish: (score: number) => void;
}

/** O canvas 480×300 da lemniscata; o mouse (sem clicar) ou o analógico guiam o cursor. */
function ImuGame({ onFinish }: ImuGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useInputContext('MINIGAME');
  const surface = useCanvas(canvasRef);
  const [sim] = useState(() => new LemniscateSim());
  const [elapsedS, setElapsedS] = useState(0);
  const [readyS, setReadyS] = useState(LEMNISCATE_READY_S);
  const [liveScore, setLiveScore] = useState(0);
  const hostRef = useRef<HTMLDivElement>(null);
  const pointer = useRef<Vec2 | null>(null);
  const finished = useRef(false);
  const onFinishRef = useRef(onFinish);
  useEffect(() => {
    onFinishRef.current = onFinish;
  });

  useGameLoop(() => {
    if (!surface) return null;
    const { ctx } = surface;
    return {
      update(dtS) {
        if (finished.current) return;
        const im = InputManager.get();
        sim.setInput({
          moveX: im.axis('MOVE_X'),
          moveY: im.axis('MOVE_Y'),
          pointer: pointer.current,
        });
        sim.update(dtS);
        if (sim.phase === 'DONE') {
          finished.current = true;
          onFinishRef.current(sim.score);
        }
      },
      render() {
        drawLemniscate(ctx, sim, LEMNISCATE_COLORS, surface.width, surface.height);
      },
    };
  }, [surface, sim]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setElapsedS(sim.elapsedS);
      setReadyS(sim.phase === 'READY' ? sim.readyLeftS : 0);
      setLiveScore(sim.score);
    }, 100);
    return () => window.clearInterval(id);
  }, [sim]);

  // O jogo abre embaixo do nivelamento: rola até ele caber inteiro na tela.
  useEffect(() => {
    hostRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, []);

  const toLocal = (e: React.PointerEvent<HTMLCanvasElement>): Vec2 => {
    const rect = e.currentTarget.getBoundingClientRect();
    const scale = LEMNISCATE_CANVAS_W / (rect.width || LEMNISCATE_CANVAS_W);
    return {
      x: (e.clientX - rect.left) * scale - LEMNISCATE_CANVAS_W / 2,
      y: (e.clientY - rect.top) * scale - LEMNISCATE_CANVAS_H / 2,
    };
  };

  return (
    <div className="flex flex-col gap-2" data-testid="imu-game" ref={hostRef}>
      <div
        className="w-full overflow-hidden rounded-md border border-slate-700"
        style={{ aspectRatio: `${LEMNISCATE_CANVAS_W} / ${LEMNISCATE_CANVAS_H}` }}
      >
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={C.imuCanvas}
          className="block h-full w-full touch-none"
          data-testid="imu-canvas"
          onPointerMove={(e) => {
            pointer.current = toLocal(e);
          }}
          onPointerLeave={() => {
            pointer.current = null;
          }}
        />
      </div>
      <div className="flex items-center justify-between font-mono text-xs text-slate-300">
        <span data-testid="imu-time">
          {readyS > 0
            ? C.imuReady(formatNumber(Math.ceil(readyS), 0))
            : C.imuTime(formatNumber(elapsedS, 1))}
        </span>
        <span className="text-amber-300">
          {C.gyroDrift(formatNumber(gyroDriftDegPerHour(liveScore), 1))}
        </span>
      </div>
      <ProgressBar value={Math.min(1, elapsedS / LEMNISCATE_DURATION_S)} />
    </div>
  );
}
