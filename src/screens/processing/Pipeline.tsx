import { Check, Play } from 'lucide-react';
import { STRINGS } from '@/data/strings';
import { formatDuration } from '@/lib/format';
import { Fragment, type RefObject } from 'react';
import { cx, ProgressBar } from '@/ui';
import type { PipelineProgress, PlannedStage } from './pipelineModel';

const P = STRINGS.processing;

/** Lista das etapas com barras e o canvas do visual da etapa corrente (§4, §5.2). */
export function Pipeline({
  progress,
  stages,
  canvasRef,
}: {
  progress: PipelineProgress;
  stages: readonly PlannedStage[];
  canvasRef: RefObject<HTMLCanvasElement | null>;
}) {
  return (
    <div className="flex flex-wrap gap-6" data-testid="pipeline">
      <ol className="flex min-w-80 flex-1 flex-col gap-2">
        {stages.map((st, k) => {
          const name = st.track === 'LIDAR' ? P.stagesLidar[st.index] : P.stages[st.index];
          // Com as duas esteiras, cada uma abre com o seu título.
          const header =
            st.track !== 'STAFF' &&
            stages.some((o) => o.track === 'LIDAR') &&
            stages.some((o) => o.track === 'SFM') &&
            st.index === 0;
          const done = k < progress.stage;
          const current = k === progress.stage;
          const value = done ? 1 : current ? progress.progress : 0;
          return (
            <Fragment key={`${st.track}-${st.index}`}>
              {header && (
                <li
                  className="mt-1 text-xs font-semibold tracking-widest text-cyan-400 uppercase"
                  data-testid={`pipeline-track-${st.track}`}
                >
                  {P.tracks[st.track as 'SFM' | 'LIDAR']}
                </li>
              )}
              <li
                className="flex items-center gap-3"
                data-stage={k}
                data-state={done ? 'done' : current ? 'current' : 'todo'}
              >
                <span
                  className={cx(
                    'w-5 text-center',
                    done ? 'text-emerald-400' : current ? 'text-cyan-300' : 'text-slate-400',
                  )}
                >
                  {done ? (
                    <Check size={16} aria-hidden />
                  ) : current ? (
                    <Play size={14} aria-hidden />
                  ) : (
                    '·'
                  )}
                </span>
                <span
                  className={cx(
                    'w-72 text-sm',
                    done || current ? 'text-slate-100' : 'text-slate-400',
                  )}
                >
                  {st.index + 1} {name}
                </span>
                <div className="w-40">
                  <ProgressBar value={value} />
                </div>
                <span className="w-12 text-right font-mono text-xs text-slate-300 tabular-nums">
                  {Math.round(value * 100)} %
                </span>
              </li>
            </Fragment>
          );
        })}
        <li className="mt-2 font-mono text-sm text-slate-300" data-testid="pipeline-remaining">
          {P.remaining(formatDuration(progress.remainingS))}
        </li>
      </ol>
      <canvas
        ref={canvasRef}
        width={640}
        height={360}
        className="rounded-md border border-slate-700"
        data-testid="pipeline-canvas"
      />
    </div>
  );
}
