/**
 * A troca de faixa no HUD (survey-flight §5.7, ADR-035): o aviso da curva com as teclas (o acorde
 * e a sequência no teclado; analógico e gatilho no controle), a barra da janela em volta do
 * portal da curva, a marca do julgamento e a arremetida. Também a leitura do vento vertical e o
 * selo da dificuldade.
 */
import { STRINGS } from '@/data/strings';
import { TURN_FAILSAFE_MISSES } from '@/engines/flight/FlightEngine';
import type { FlightHudSnapshot } from '@/engines/flight/hudPublisher';
import { InputGlyph, useActiveDevice } from '@/input/InputGlyph';
import type { FlightDifficulty } from '@/types';
import { cx } from '@/ui';

const T = STRINGS.flight;

/** O aviso da curva aparece com o portal a este tempo (real) ou menos. */
export const TURN_PROMPT_S = 3;
/** A barra da janela vai deste tempo antes do portal (à esquerda)... */
export const TURN_BAR_FROM_S = 2.5;
/** ...até este tempo depois dele (à direita). */
export const TURN_BAR_TO_S = -1;

/** Posição (0–1, da esquerda) de um tempo até o portal na barra da janela. */
export function turnBarPos(toGateS: number): number {
  const k = (TURN_BAR_FROM_S - toGateS) / (TURN_BAR_FROM_S - TURN_BAR_TO_S);
  return Math.min(1, Math.max(0, k));
}

function Key({ label }: { label: string }) {
  return (
    <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-b-2 border-slate-500 bg-slate-800 px-1.5 font-mono text-[11px] leading-none text-slate-100">
      {label}
    </kbd>
  );
}

/** As teclas da manobra para o lado, no dispositivo em uso. */
function TurnKeys({ side }: { side: -1 | 1 }) {
  const device = useActiveDevice();
  if (device !== 'KEYBOARD') {
    return (
      <span
        className="flex items-center gap-1.5 text-xs text-slate-300"
        data-testid="turn-keys-pad"
      >
        <kbd className="inline-flex h-6 items-center justify-center rounded-full border-2 border-slate-400 bg-slate-800 px-1.5 font-mono text-[11px] leading-none text-slate-100">
          {side > 0 ? 'L ↗' : 'L ↖'}
        </kbd>
        +
        <InputGlyph action={side > 0 ? 'TURN_RIGHT' : 'TURN_LEFT'} />
        <span className="text-[11px] text-slate-400">{T.turn.pad}</span>
      </span>
    );
  }
  // Os três toques de cada lado da mão: W, o lado e a tecla de cima do lado.
  const chord = side > 0 ? ['W', 'E', 'D'] : ['W', 'A', 'Q'];
  const sequence = side > 0 ? ['D', 'E', 'W'] : ['A', 'Q', 'W'];
  return (
    <span
      className="flex flex-wrap items-center justify-center gap-1.5 text-xs text-slate-300"
      data-testid="turn-keys"
    >
      {chord.map((k, i) => (
        <span key={k} className="flex items-center gap-1.5">
          {i > 0 && '+'}
          <Key label={k} />
        </span>
      ))}
      <span className="text-[11px] text-slate-400">{T.turn.chord}</span>
      <span className="text-[11px] text-slate-400">· {T.turn.sequence}</span>
      {sequence.map((k, i) => (
        <span key={k} className="flex items-center gap-1.5">
          {i > 0 && '→'}
          <Key label={k} />
        </span>
      ))}
    </span>
  );
}

/**
 * O aviso da curva: o lado, as teclas e a barra da janela (o cursor anda até o portal; a zona
 * acesa é a janela, mais estreita na dificuldade difícil).
 */
export function TurnPrompt({ snap, calm }: { snap: FlightHudSnapshot; calm: boolean }) {
  const t = snap.turn;
  if (!t || snap.phase !== 'RUN' || t.judged !== null || t.toGateS > TURN_PROMPT_S) return null;
  const inWindow = t.toGateS <= t.window.earlyS && t.toGateS >= -t.window.lateS;
  const zoneFrom = turnBarPos(t.window.earlyS);
  const zoneTo = turnBarPos(-t.window.lateS);
  return (
    <div
      className="flex flex-col items-center gap-1.5 rounded-xl border border-amber-400/80 bg-slate-950/85 px-4 py-2"
      data-testid="hud-turn"
      data-side={t.side}
      data-to-gate={t.toGateS.toFixed(2)}
      data-in-window={inWindow}
    >
      <span
        className={cx(
          'font-mono text-lg font-black tracking-widest text-amber-300',
          inWindow && !calm && 'animate-pulse',
        )}
      >
        {T.turn.prompt(t.side)}
      </span>
      <TurnKeys side={t.side} />
      <div
        className="relative mt-0.5 h-2.5 w-64 rounded-full bg-slate-800"
        aria-label={T.turn.window}
      >
        <span
          className={cx(
            'absolute inset-y-0 rounded-full',
            inWindow ? 'bg-amber-300' : 'bg-amber-500/50',
          )}
          style={{
            left: `${zoneFrom * 100}%`,
            width: `${Math.max(2, (zoneTo - zoneFrom) * 100)}%`,
          }}
        />
        <span
          className="absolute top-1/2 h-4 w-1 -translate-x-1/2 -translate-y-1/2 rounded bg-slate-100 transition-[left] duration-100 ease-linear"
          style={{ left: `${turnBarPos(t.toGateS) * 100}%` }}
        />
      </div>
    </div>
  );
}

const TURN_CLASS = {
  ON_TIME: 'text-emerald-300',
  EARLY: 'text-amber-300',
  LATE: 'text-rose-400',
  WRONG_SIDE: 'text-rose-400',
} as const;

/** A marca do julgamento da manobra: sobe e some como a da nota (só some com "Reduzir flashes"). */
export function TurnMark({ snap, calm }: { snap: FlightHudSnapshot; calm: boolean }) {
  const m = snap.lastTurn;
  if (!m || (snap.phase !== 'RUN' && snap.phase !== 'TURN' && snap.phase !== 'GO_AROUND')) {
    return null;
  }
  return (
    <span
      key={m.seq}
      data-testid="hud-turn-mark"
      data-result={m.result}
      className={cx(
        'absolute top-[44%] left-1/2 -translate-x-1/2 font-mono text-xl font-black tracking-widest drop-shadow',
        TURN_CLASS[m.result],
        calm ? 'grade-fade' : 'grade-pop',
      )}
    >
      {T.turn.result[m.result]}
    </span>
  );
}

/** A arremetida: de volta ao portal da curva, com as curvas perdidas até o retorno automático. */
export function GoAroundCard({ snap }: { snap: FlightHudSnapshot }) {
  if (snap.phase !== 'GO_AROUND') return null;
  return (
    <div
      className="flex flex-col items-center gap-0.5 rounded-xl border border-rose-500 bg-rose-950/85 px-5 py-2"
      data-testid="hud-go-around"
    >
      <span className="font-mono text-sm font-bold tracking-widest text-rose-100">
        {T.turn.goAround}
      </span>
      <span className="font-mono text-xs text-rose-200">
        {T.turn.misses(snap.turnMisses, TURN_FAILSAFE_MISSES)}
      </span>
    </div>
  );
}

/** O vento vertical das rajadas e correntes na aeronave, quando passa de 0,3 m/s. */
export function VerticalWind({ snap }: { snap: FlightHudSnapshot }) {
  const w = snap.windVerticalMs;
  if (Math.abs(w) < 0.3) return null;
  const gust = snap.gust?.active === true && snap.gust.axis === 'VERTICAL';
  return (
    <span
      className={cx(
        'font-mono text-sm font-bold tabular-nums',
        gust ? 'text-amber-300' : 'text-cyan-200',
      )}
      data-testid="hud-vertical-wind"
      aria-label={T.verticalWindLabel(w > 0)}
    >
      {T.verticalWind(w)}
    </span>
  );
}

const DIFFICULTY_CLASS: Readonly<Record<FlightDifficulty, string>> = {
  EASY: 'border-emerald-400 text-emerald-200',
  MEDIUM: 'border-slate-500 text-slate-200',
  HARD: 'border-rose-500 text-rose-200',
};

/** O selo da dificuldade do voo, na barra de cima. */
export function DifficultyChip({ difficulty }: { difficulty: FlightDifficulty }) {
  return (
    <span
      className={cx(
        'rounded border px-1.5 font-mono text-[10px] font-bold tracking-widest',
        DIFFICULTY_CLASS[difficulty],
      )}
      data-testid="hud-difficulty"
      data-difficulty={difficulty}
    >
      {T.difficulty[difficulty]}
    </span>
  );
}
