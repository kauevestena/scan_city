import { Play } from 'lucide-react';
import { CATALOG } from '@/data/catalog';
import { STRINGS } from '@/data/strings';
import { validatePlan } from '@/domain/flightPlanner';
import { predictRequirements } from '@/domain/requirements';
import { useGameStore } from '@/state/store';
import { Button, ChecklistItem, type ChecklistStatus } from '@/ui';
import type { FieldContext } from './useFieldContext';

const F = STRINGS.field;

/** Aba 4 (field-setup §5.5): requisitos previstos, bloqueantes, avisos e decolagem. */
export function ChecklistTab({ field, onTakeoff }: { field: FieldContext; onTakeoff: () => void }) {
  const inventory = useGameStore((s) => s.inventory);
  const { mission, contract, predict } = field;
  const results = predictRequirements(mission.plan, contract, mission.groundPoints, predict);
  const validation = validatePlan(mission.plan, inventory, contract, CATALOG);
  const failed = results.filter((r) => !r.pass);
  const warnings = [...failed.map((r) => r.label), ...validation.warnings];
  const status = (pass: boolean, severity: string): ChecklistStatus =>
    pass ? 'pass' : severity === 'MINOR' ? 'warn' : 'fail';

  return (
    <div className="flex flex-col gap-5" data-testid="checklist-tab">
      <section className="flex flex-col gap-1.5">
        <h3 className="text-xs font-semibold tracking-widest text-slate-400 uppercase">
          {F.checklist}
        </h3>
        <ul data-testid="checklist-requirements">
          {results.map((r) => (
            <ChecklistItem
              key={r.id}
              status={status(r.pass, r.severity)}
              label={r.label}
              severity={r.severity}
              detail={r.valueText}
            />
          ))}
        </ul>
      </section>
      {validation.blocking.length > 0 && (
        <section className="flex flex-col gap-1.5" data-testid="checklist-blocking">
          <h3 className="text-xs font-semibold tracking-widest text-rose-400 uppercase">
            {F.blocking}
          </h3>
          <ul className="flex flex-col gap-1 text-sm text-rose-200">
            {validation.blocking.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </section>
      )}
      {warnings.length > 0 && (
        <section className="flex flex-col gap-1.5" data-testid="checklist-warnings">
          <h3 className="text-xs font-semibold tracking-widest text-amber-400 uppercase">
            {F.warnings}
          </h3>
          <ul className="flex flex-col gap-1 text-sm text-amber-200">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </section>
      )}
      <Button
        variant="primary"
        size="lg"
        icon={Play}
        glyph="INTERACT"
        disabled={validation.blocking.length > 0}
        onClick={onTakeoff}
        data-testid="takeoff"
      >
        {F.takeoff}
      </Button>
    </div>
  );
}
