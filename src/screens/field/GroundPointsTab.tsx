import { Crosshair, Eraser, Sparkles, Triangle } from 'lucide-react';
import { STRINGS } from '@/data/strings';
import { formatNumber, formatPct } from '@/lib/format';
import { useGameStore } from '@/state/store';
import { Button, cx, Stat, Tabs, type StatusTone, type TabDef } from '@/ui';
import { useEffect } from 'react';
import { distribution, suggestGcps, type Light, type PointTool } from './fieldModel';
import { completeTutorialStep } from '../common/TutorialHint';
import type { FieldContext } from './useFieldContext';

const F = STRINGS.field;

const TOOL_TABS: ReadonlyArray<TabDef<PointTool>> = [
  { id: 'GCP', label: F.tools.GCP, icon: Crosshair },
  { id: 'CP', label: F.tools.CP, icon: Triangle },
  { id: 'ERASER', label: F.tools.ERASER, icon: Eraser },
];

const LIGHT_TONE: Record<Light, StatusTone> = { GREEN: 'ok', AMBER: 'warn', RED: 'danger' };
const LIGHT_DOT: Record<Light, string> = {
  GREEN: 'bg-emerald-400',
  AMBER: 'bg-amber-400',
  RED: 'bg-rose-500',
};

export interface GroundPointsTabProps {
  field: FieldContext;
  tool: PointTool;
  onTool: (tool: PointTool) => void;
}

/** Aba 1 (field-setup §5.2): ferramentas, instrumento, distribuição e sugestão do C00. */
export function GroundPointsTab({ field, tool, onTool }: GroundPointsTabProps) {
  const { mission, contract, equipment } = field;
  const d = distribution(mission.groundPoints, contract);
  // Tutorial: a dica dos GCPs some quando há ao menos 3.
  useEffect(() => {
    if (d.gcps >= 3) completeTutorialStep(1);
  }, [d.gcps]);

  const suggest = () => {
    const points = suggestGcps(
      mission.groundPoints,
      contract,
      field.terrain,
      field.vehicles,
      field.rules,
      equipment,
    );
    useGameStore.getState().setGroundPoints(points);
  };

  return (
    <div className="flex flex-col gap-5" data-testid="ground-points-tab">
      <section className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold tracking-widest text-slate-400 uppercase">
          {F.toolsLabel}
        </h3>
        <Tabs tabs={TOOL_TABS} value={tool} onChange={onTool} ariaLabel={F.toolsLabel} />
      </section>
      <Stat
        label={F.instrument}
        value={F.instrumentValue(
          equipment.name,
          formatNumber(equipment.sigmaBaseM * 100, 1),
          equipment.maxPoints,
        )}
      />
      <section className="grid grid-cols-2 gap-3" data-testid="distribution">
        <Stat
          label={F.gcpCount}
          value={F.countValue(d.gcps, d.minGcp)}
          status={d.gcps >= d.minGcp ? 'ok' : 'warn'}
        />
        <Stat
          label={F.cpCount}
          value={F.countValue(d.cps, d.minCp)}
          status={d.cps >= d.minCp ? 'ok' : 'warn'}
        />
        <Stat label={F.hullCoverage} value={formatPct(d.coverage, 0)} />
        <Stat
          label={F.collinearity}
          value={formatNumber(d.collinearity, 2)}
          status={d.collinearity < 0.05 ? 'danger' : d.collinearity < 0.3 ? 'warn' : 'ok'}
        />
      </section>
      <div
        className="flex items-start gap-3 rounded-md border border-slate-700 bg-slate-900 p-3"
        data-testid="distribution-light"
        data-light={d.light}
      >
        <span className={cx('mt-1 size-3 shrink-0 rounded-full', LIGHT_DOT[d.light])} aria-hidden />
        <div className="flex flex-col gap-0.5">
          <Stat label={F.distribution} value={F.lights[d.light]} status={LIGHT_TONE[d.light]} />
          <p className="text-sm text-slate-300" data-testid="distribution-hint">
            {d.hint}
          </p>
        </div>
      </div>
      {contract.id === 'C00' && (
        <Button icon={Sparkles} onClick={suggest} data-testid="suggest-gcps">
          {F.suggest}
        </Button>
      )}
    </div>
  );
}
