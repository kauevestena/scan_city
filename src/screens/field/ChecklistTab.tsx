import { Play } from 'lucide-react';
import { CATALOG } from '@/data/catalog';
import { STRINGS } from '@/data/strings';
import { DIFFICULTIES, DIFFICULTY, missionDifficulty } from '@/domain/difficulty';
import { validatePlan } from '@/domain/flightPlanner';
import { predictRequirements } from '@/domain/requirements';
import { useGameStore } from '@/state/store';
import type { FlightDifficulty } from '@/types';
import { Button, ChecklistItem, cx, FOCUS_RING, type ChecklistStatus } from '@/ui';
import type { FieldContext } from './useFieldContext';

const F = STRINGS.field;

const D = F.difficulty;

/**
 * A dificuldade do voo (survey-flight §5.22, ADR-035): três opções com o que muda e o efeito no
 * pagamento. A média vem marcada; a escolha vale para todas as surtidas da missão.
 */
function DifficultyPicker({ value }: { value: FlightDifficulty }) {
  const set = useGameStore((s) => s.setFlightDifficulty);
  return (
    <section className="flex flex-col gap-1.5" data-testid="checklist-difficulty">
      <h3
        id="difficulty-title"
        className="text-xs font-semibold tracking-widest text-slate-400 uppercase"
      >
        {D.title}
      </h3>
      <div role="radiogroup" aria-labelledby="difficulty-title" className="flex flex-col gap-1.5">
        {DIFFICULTIES.map((d) => {
          const checked = d === value;
          return (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={checked}
              data-difficulty={d}
              onClick={() => set(d)}
              className={cx(
                'flex flex-col items-start rounded-lg border px-3 py-1.5 text-left',
                FOCUS_RING,
                checked
                  ? 'border-cyan-400 bg-cyan-950/60 text-slate-100'
                  : 'border-slate-700 bg-slate-900/60 text-slate-300 hover:border-slate-500',
              )}
            >
              <span className="flex w-full items-baseline justify-between gap-2 text-sm font-semibold">
                {D.options[d].label}
                <span
                  className={cx(
                    'font-mono text-xs',
                    DIFFICULTY[d].paymentFactor > 1
                      ? 'text-emerald-300'
                      : DIFFICULTY[d].paymentFactor < 1
                        ? 'text-amber-300'
                        : 'text-slate-400',
                  )}
                >
                  {D.pay(DIFFICULTY[d].paymentFactor)}
                </span>
              </span>
              <span className="text-xs text-slate-400">{D.options[d].detail}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** Aba 4 (field-setup §5.5): requisitos previstos, bloqueantes, avisos, dificuldade e decolagem. */
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
      <DifficultyPicker value={missionDifficulty(mission)} />
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
