import { UserMinus, UserPlus, Users, X } from 'lucide-react';
import { useRef } from 'react';
import { STAFF } from '@/data/catalog';
import { STRINGS } from '@/data/strings';
import { useFocusNavigation } from '@/input/useFocusNavigation';
import { formatBRL, formatNumber } from '@/lib/format';
import { useGameStore } from '@/state/store';
import { Button, cx, Panel } from '@/ui';

const T = STRINGS.office.team;

/** Mesa da Equipe (office §5, progression §7): contratar e demitir por função, com os limites. */
export function StaffPanel({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const staff = useGameStore((s) => s.staff);
  useFocusNavigation(ref, { onBack: onClose });
  return (
    <div
      ref={ref}
      className="absolute top-0 right-0 bottom-0 w-80 overflow-y-auto p-3 min-[1600px]:w-[380px]"
      data-testid="staff-panel"
    >
      <Panel
        title={T.title}
        icon={Users}
        actions={
          <Button
            size="sm"
            variant="ghost"
            icon={X}
            aria-label={STRINGS.office.close}
            onClick={onClose}
          />
        }
      >
        <p className="text-xs text-slate-400">{T.hint}</p>
        <ul className="mt-3 flex flex-col gap-2">
          {STAFF.map((role) => {
            const n = staff[role.id];
            const full = n >= role.maxCount;
            return (
              <li
                key={role.id}
                data-testid={`staff-${role.id}`}
                data-count={n}
                className={cx(
                  'flex flex-col gap-2 rounded-md border bg-slate-800 p-3',
                  n > 0 ? 'border-cyan-400/50' : 'border-slate-700',
                )}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold text-slate-100">{role.name}</span>
                  <span
                    className="font-mono text-sm text-cyan-300"
                    data-testid={`staff-count-${role.id}`}
                  >
                    {T.count(n, role.maxCount)}
                  </span>
                </div>
                <dl className="flex flex-col gap-0.5 font-mono text-xs text-slate-300">
                  <dd>{T.hireCost(formatBRL(role.hireCostBRL))}</dd>
                  <dd>{T.perContract(formatBRL(role.costPerContractBRL))}</dd>
                  <dd className="text-emerald-300">
                    {T.paymentBonus(formatNumber(role.paymentBonus * 100, 0))}
                  </dd>
                  <dd className="text-emerald-300">
                    {T.speedBonus(formatNumber(role.processingSpeedBonus * 100, 0))}
                  </dd>
                </dl>
                {full && <p className="text-xs text-amber-300">{T.maxed}</p>}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="primary"
                    icon={UserPlus}
                    disabled={full}
                    data-focus-id={`hire-${role.id}`}
                    onClick={() => useGameStore.getState().hireStaff(role.id)}
                  >
                    {T.hire}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={UserMinus}
                    disabled={n === 0}
                    onClick={() => useGameStore.getState().fireStaff(role.id)}
                  >
                    {T.fire}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </Panel>
    </div>
  );
}
