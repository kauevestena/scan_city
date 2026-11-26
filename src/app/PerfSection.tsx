import { Gauge } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { acquirePerf, PERF, PERF_BUDGET_MS, type StageReading } from '@/engines/perf';
import { flightDetailLevel } from '@/engines/flight/detailLevel';
import { renderScaleOf } from '@/engines/useCanvas';
import { formatNumber } from '@/lib/format';
import { cx } from '@/ui';

const POLL_MS = 250;

interface Section {
  key: string;
  name: string;
  totalMs: number;
  budgetMs: number;
  stages: StageReading[];
  /** Escala do buffer do canvas (resolução adaptativa, ADR-033), nos que têm. */
  renderScale: number | null;
  /** Degrau de detalhe do voo (ADR-034); `null` nas outras telas. */
  detail: number | null;
}

/** As seções com quadros novos desde a leitura anterior: só a tela que está rodando aparece. */
export function activeSections(seen: Map<string, number>): Section[] {
  const out: Section[] = [];
  for (const [key, timer] of Object.entries(PERF) as Array<
    [keyof typeof PERF, (typeof PERF)[keyof typeof PERF]]
  >) {
    const frames = timer.frameCount;
    if (frames > (seen.get(key) ?? 0)) {
      out.push({
        key,
        name: timer.name,
        totalMs: timer.totalMs,
        budgetMs: PERF_BUDGET_MS[key],
        stages: timer.readings(),
        renderScale: renderScaleOf(key),
        detail: key === 'flight' ? flightDetailLevel() : null,
      });
    }
    seen.set(key, frames);
  }
  return out;
}

/**
 * Tempos por etapa do quadro (survey-flight §5.18), ao vivo: o painel liga os contadores ao abrir
 * e os desliga ao fechar, então o jogo normal não paga a medição.
 */
export function PerfSection() {
  const [sections, setSections] = useState<Section[]>([]);
  const seen = useRef(new Map<string, number>());

  useEffect(() => {
    const release = acquirePerf();
    const id = window.setInterval(() => setSections(activeSections(seen.current)), POLL_MS);
    return () => {
      window.clearInterval(id);
      release();
    };
  }, []);

  return (
    <div data-testid="debug-perf">
      <p className="mb-2 flex items-center gap-1.5 text-xs tracking-widest text-slate-400 uppercase">
        <Gauge size={14} aria-hidden /> Desempenho por etapa
      </p>
      {sections.length === 0 && (
        <p className="text-xs text-slate-400">Sem quadros: abra uma tela com animação.</p>
      )}
      {sections.map((sec) => {
        const over = sec.totalMs > sec.budgetMs;
        return (
          <div key={sec.key} className="mb-2" data-perf={sec.key}>
            <p className="mb-1 flex justify-between font-mono text-xs">
              <span className="text-slate-200">{sec.name}</span>
              <span className={cx('tabular-nums', over ? 'text-rose-500' : 'text-emerald-400')}>
                {formatNumber(sec.totalMs, 2)} ms / {formatNumber(sec.budgetMs, 1)} ms
              </span>
            </p>
            {sec.stages.map((st) => (
              <div key={st.stage} className="flex items-center gap-2 text-xs text-slate-300">
                <span className="w-44 shrink-0 truncate">{st.stage}</span>
                <span className="h-1.5 flex-1 rounded bg-slate-800">
                  <span
                    className="block h-full rounded bg-cyan-400"
                    style={{ width: `${Math.min(100, (100 * st.ms) / sec.budgetMs)}%` }}
                  />
                </span>
                <span className="w-16 text-right font-mono tabular-nums">
                  {formatNumber(st.ms, 2)} ms
                </span>
              </div>
            ))}
            {sec.renderScale !== null && (
              <p className="mt-1 font-mono text-xs text-slate-400" data-testid="perf-render-scale">
                Resolução do canvas ×{formatNumber(sec.renderScale, 2)}
              </p>
            )}
            {sec.detail !== null && (
              <p className="font-mono text-xs text-slate-400" data-testid="perf-detail">
                Degrau de detalhe {sec.detail} de 3
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
