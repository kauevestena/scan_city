import { Check, Play } from 'lucide-react';
import { STRINGS } from '@/data/strings';
import { formatDuration } from '@/lib/format';
import type { RefObject } from 'react';
import { cx, ProgressBar } from '@/ui';
import type { PipelineProgress } from './pipelineModel';

const P = STRINGS.processing;

/** Lista das etapas com barras e o canvas do visual da etapa corrente (§4, §5.2). */
export function Pipeline({
  progress,
  stages,
  canvasRef,
}: {
  progress: PipelineProgress;
  stages: number;
  canvasRef: RefObject<HTMLCanvasElement | null>;
}) {
  return (
    <div className="flex flex-wrap gap-6" data-testid="pipeline">
      <ol className="flex min-w-80 flex-1 flex-col gap-2">
        {P.stages.slice(0, stages).map((name, k) => {
          const done = k < progress.stage;
          const current = k === progress.stage;
          const value = done ? 1 : current ? progress.progress : 0;
          return (
            <li
              key={name}
              className="flex items-center gap-3"
              data-stage={k}
              data-state={done ? 'done' : current ? 'current' : 'todo'}
            >
              <span
                className={cx(
                  'w-5 text-center',
                  done ? 'text-emerald-400' : current ? 'text-cyan-300' : 'text-slate-600',
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
                  done || current ? 'text-slate-100' : 'text-slate-500',
                )}
              >
                {k + 1} {name}
              </span>
              <div className="w-40">
                <ProgressBar value={value} />
              </div>
              <span className="w-12 text-right font-mono text-xs text-slate-300 tabular-nums">
                {Math.round(value * 100)} %
              </span>
            </li>
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
