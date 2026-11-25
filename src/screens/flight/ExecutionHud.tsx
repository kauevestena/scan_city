/**
 * A execução do voo no HUD (survey-flight §4, §5.13 e §5.21): a nota da passada e a sequência,
 * a marca de cada amostra e de cada contragolpe, a biruta com a rajada e o boletim da linha
 * durante a curva.
 */
import { STRINGS } from '@/data/strings';
import type { FlightHudSnapshot } from '@/engines/flight/hudPublisher';
import type { ShotGrade } from '@/types';
import { cx } from '@/ui';

const T = STRINGS.flight;

/** Cores das notas (survey-flight §5.21). */
export const GRADE_CLASS: Readonly<Record<ShotGrade, string>> = {
  PERFECT: 'text-emerald-400',
  GOOD: 'text-cyan-300',
  WEAK: 'text-amber-400',
  REJECTED: 'text-rose-500',
};

/** A sequência só aparece a partir de 3 amostras boas seguidas. */
export const STREAK_MIN = 3;

/** EXECUÇÃO A 88 % · sequência ×7 · REVOO. */
export function ExecutionStrip({ snap }: { snap: FlightHudSnapshot }) {
  if (snap.passLetter === null && !snap.refly) return null;
  return (
    <span className="flex items-baseline gap-2" data-testid="hud-execution">
      <span className="text-[10px] tracking-widest text-slate-400">{T.execution}</span>
      {snap.passLetter !== null && snap.passScore !== null && (
        <span className="font-mono text-sm text-slate-100 tabular-nums">
          {T.executionValue(snap.passLetter, Math.round(snap.passScore * 100))}
        </span>
      )}
      {snap.streak >= STREAK_MIN && (
        <span className="font-mono text-xs text-emerald-300" data-testid="hud-streak">
          {T.streak(snap.streak)}
        </span>
      )}
      {snap.refly && (
        <span className="rounded bg-rose-950/80 px-1.5 text-[10px] font-bold tracking-widest text-rose-200">
          {T.refly}
        </span>
      )}
    </span>
  );
}

/**
 * A marca da última amostra: o nome da nota (e o eixo que a derrubou) sobe e some. A chave
 * reinicia a animação a cada amostra; com "Reduzir flashes e tremores", só some, sem subir.
 */
export function GradeMark({ snap, calm }: { snap: FlightHudSnapshot; calm: boolean }) {
  const g = snap.lastGrade;
  if (!g || snap.phase !== 'RUN') return null;
  const axis = (g.grade === 'WEAK' || g.grade === 'REJECTED') && g.axis ? T.axes[g.axis] : null;
  return (
    <span
      key={g.seq}
      data-testid="hud-grade"
      data-grade={g.grade}
      className={cx(
        'absolute top-[58%] left-1/2 -translate-x-1/2 font-mono text-lg font-bold tracking-widest drop-shadow',
        GRADE_CLASS[g.grade],
        calm ? 'grade-fade' : 'grade-pop',
      )}
    >
      {axis ? `${T.grades[g.grade]} · ${axis}` : T.grades[g.grade]}
    </span>
  );
}

/** Cores da marca do contragolpe; sem reação, não há marca (o empurrão já diz tudo). */
export const COUNTER_CLASS: Readonly<Record<'PERFECT' | 'EARLY' | 'LATE', string>> = {
  PERFECT: 'text-emerald-300',
  EARLY: 'text-amber-300',
  LATE: 'text-amber-300',
};

/**
 * A marca do último contragolpe ("NO TEMPO!", "CEDO", "TARDE"), acima da marca da nota, do lado
 * de onde a rajada veio. Some como a marca da nota.
 */
export function CounterMark({ snap, calm }: { snap: FlightHudSnapshot; calm: boolean }) {
  const c = snap.counter;
  if (!c || c.result === 'MISS' || snap.phase !== 'RUN') return null;
  return (
    <span
      key={c.seq}
      data-testid="hud-counter"
      data-result={c.result}
      className={cx(
        'absolute top-[48%] -translate-x-1/2 font-mono text-xl font-black tracking-widest drop-shadow',
        c.side > 0 ? 'left-[44%]' : 'left-[56%]',
        COUNTER_CLASS[c.result],
        calm ? 'grade-fade' : 'grade-pop',
      )}
    >
      {T.counter[c.result]}
    </span>
  );
}

/**
 * Biruta: para onde o vento sopra em relação à aeronave. Só a rajada que já sopra a faz girar,
 * crescer e ficar âmbar: o aviso da rajada é só a frente de vento na cena (ADR-034).
 */
export function Windsock({ snap, calm }: { snap: FlightHudSnapshot; calm: boolean }) {
  const gust = snap.gust?.active ? snap.gust : null;
  const deg = Math.round(gust ? (gust.side > 0 ? 90 : -90) : snap.windRelDeg);
  return (
    <svg
      viewBox="-12 -12 24 24"
      role="img"
      aria-label={T.windsock(deg)}
      data-testid="hud-windsock"
      data-gust={gust ? 'active' : 'none'}
      className={cx(
        'size-7',
        gust ? 'text-amber-400' : 'text-slate-300',
        gust && !calm && 'animate-pulse',
      )}
    >
      <g transform={`rotate(${deg}) scale(${gust ? 1.25 : 1})`}>
        <path d="M0 -9 L5 -1 L1.8 -1 L1.8 9 L-1.8 9 L-1.8 -1 L-5 -1 Z" fill="currentColor" />
      </g>
    </svg>
  );
}

/** O boletim da passada que fechou, no centro da tela, durante a curva (e no pouso). */
export function LineReportCard({ snap }: { snap: FlightHudSnapshot }) {
  const r = snap.lineReport;
  if (!r) return null;
  return (
    <div
      className={cx(
        'absolute top-1/3 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1 rounded-xl border px-6 py-3',
        r.accepted ? 'border-cyan-400 bg-slate-950/85' : 'border-rose-500 bg-rose-950/85',
      )}
      data-testid="hud-line-report"
      data-accepted={r.accepted}
    >
      <span className="font-mono text-2xl font-bold tracking-widest text-slate-100">
        {T.lineReport.title(r.lineNumber, r.letter)}
      </span>
      <span className="text-sm text-slate-300">{T.lineReport.counts(r.counts)}</span>
      <span
        className={cx(
          'text-sm font-semibold tracking-widest',
          r.accepted ? 'text-emerald-300' : 'text-rose-300',
        )}
      >
        {r.accepted ? T.lineReport.accepted : T.lineReport.refly}
      </span>
    </div>
  );
}
