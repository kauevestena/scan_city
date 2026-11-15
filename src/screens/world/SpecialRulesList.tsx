import { getSpecialRule } from '@/data/specialRules';
import type { SpecialRuleId } from '@/types';
import { NamedIcon } from '@/ui/iconRegistry';

/** Regras especiais de um contrato, com ícone, nome e descrição (briefing, REQ-CNT-004). */
export function SpecialRulesList({ rules }: { rules: readonly SpecialRuleId[] }) {
  return (
    <ul className="flex flex-col gap-2" data-testid="briefing-rules">
      {rules.map((id) => {
        const rule = getSpecialRule(id);
        return (
          <li key={id} className="flex items-start gap-3" data-rule={id}>
            <span className="mt-0.5 text-amber-300" data-testid={`rule-icon-${id}`}>
              <NamedIcon name={rule.icon} size={20} strokeWidth={1.75} aria-hidden />
            </span>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-slate-100">{rule.name}</span>
              <span className="text-xs text-slate-300">{rule.description}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
