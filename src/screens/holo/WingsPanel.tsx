import { Star, X } from 'lucide-react';
import { forwardRef } from 'react';
import { CONTRACTS, findContract } from '@/data/contracts';
import { STRINGS } from '@/data/strings';
import { visitorsPerHour, wingIncomePerMin } from '@/domain/museum';
import { formatBRL, formatNumber } from '@/lib/format';
import { selectModifiers } from '@/state/selectors';
import { useGameStore } from '@/state/store';
import type { Contract, Dimension } from '@/types';
import { Button, cx, Panel } from '@/ui';

const H = STRINGS.holo;

const WINGS: ReadonlyArray<{ id: Dimension; label: string }> = [
  { id: 'REAL', label: H.wingReal },
  { id: 'RIFT', label: H.wingRift },
];

const wingOf = (contractId: string): Dimension | undefined => findContract(contractId)?.museum.wing;

/** Contratos da ala, na ordem do catálogo (C00… e R01…). */
const wingContracts = (wing: Dimension): Contract[] =>
  CONTRACTS.filter((c) => c.museum.wing === wing);

export interface WingsPanelProps {
  onClose: () => void;
  /** Foca o setor do contrato na mesa (troca de dimensão, se for de outra ala). */
  onFocus: (contract: Contract) => void;
}

/**
 * Painel de alas (holo-table §5.5): uma seção por ala, com a renda dela, os setores (classe, nota,
 * renda, ★ de destaque — um por ala) e os não mapeados em névoa; no rodapé, os visitantes.
 */
export const WingsPanel = forwardRef<HTMLElement, WingsPanelProps>(function WingsPanel(
  { onClose, onFocus },
  ref,
) {
  const sectors = useGameStore((s) => s.museum.sectors);
  const featured = useGameStore((s) => s.museum.featured);
  const totalVisitors = useGameStore((s) => s.museum.totalVisitors);
  const discovered = useGameStore((s) => s.world.discoveredRifts);
  const visitorsMod = useGameStore((s) => selectModifiers(s).museumVisitors);

  const incomes = WINGS.map((w) => wingIncomePerMin(sectors, featured, w.id, wingOf, visitorsMod));
  const perHour = visitorsPerHour(incomes.reduce((a, b) => a + b, 0));

  return (
    <aside
      ref={ref}
      data-testid="wings-panel"
      aria-label={H.wingsTitle}
      className="absolute top-16 right-3 bottom-3 w-[26rem] max-w-[calc(100%-1.5rem)] overflow-y-auto"
    >
      <Panel
        title={H.wingsTitle}
        actions={
          <Button size="sm" variant="ghost" icon={X} aria-label={H.wingsClose} onClick={onClose} />
        }
      >
        <div className="flex flex-col gap-4 text-sm text-slate-200">
          {WINGS.map((wing, k) => (
            <section key={wing.id} data-testid={`wing-${wing.id}`} aria-label={wing.label}>
              <h3
                className={cx(
                  'flex items-baseline justify-between border-b pb-1 font-medium',
                  wing.id === 'RIFT'
                    ? 'border-violet-500/50 text-violet-300'
                    : 'border-slate-700 text-cyan-300',
                )}
              >
                <span>{wing.label}</span>
                <span className="font-mono text-lime-300" data-testid={`wing-income-${wing.id}`}>
                  {H.wingIncome(formatBRL(incomes[k] ?? 0))}
                </span>
              </h3>
              <ul className="mt-1 flex flex-col gap-1">
                {wingContracts(wing.id).map((contract) => {
                  const museum = sectors[contract.id];
                  const hidden = wing.id === 'RIFT' && !museum && !discovered.includes(contract.id);
                  const title = hidden ? H.unknownRift : contract.title;
                  if (!museum) {
                    return (
                      <li
                        key={contract.id}
                        data-testid={`wing-row-${contract.id}`}
                        className="pl-1 text-slate-400"
                      >
                        <span aria-hidden>░ </span>
                        {H.sectorNotMapped(title)}
                      </li>
                    );
                  }
                  const isFeatured = featured[wing.id] === contract.id;
                  const income = museum.incomePerMinBRL * (isFeatured ? 2 : 1) * visitorsMod;
                  return (
                    <li
                      key={contract.id}
                      data-testid={`wing-row-${contract.id}`}
                      className="flex items-center gap-2"
                    >
                      <button
                        type="button"
                        data-focusable
                        aria-pressed={isFeatured}
                        aria-label={isFeatured ? H.sectorUnfeature(title) : H.sectorFeature(title)}
                        onClick={() =>
                          useGameStore
                            .getState()
                            .setFeatured(wing.id, isFeatured ? null : contract.id)
                        }
                        className={cx(
                          'rounded p-1 focus-visible:outline-2 focus-visible:outline-cyan-400',
                          isFeatured ? 'text-amber-300' : 'text-slate-500 hover:text-slate-200',
                        )}
                      >
                        <Star
                          size={16}
                          strokeWidth={1.75}
                          fill={isFeatured ? 'currentColor' : 'none'}
                          aria-hidden
                        />
                      </button>
                      <button
                        type="button"
                        data-focusable
                        onClick={() => onFocus(contract)}
                        className="min-w-0 flex-1 truncate rounded text-left hover:text-cyan-300 focus-visible:outline-2 focus-visible:outline-cyan-400"
                      >
                        {contract.id} {title}
                      </button>
                      <span className="font-mono text-xs text-slate-400">
                        {museum.className} · {Math.round(museum.qualityScore * 100)}
                      </span>
                      <span className="font-mono text-xs text-lime-300">
                        {H.wingIncome(formatBRL(income))}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          <footer className="flex flex-col gap-0.5 border-t border-slate-700 pt-2 font-mono">
            <span data-testid="wings-visitors">{H.visitorsFooter(formatNumber(perHour, 0))}</span>
            <span className="text-xs text-slate-400" data-testid="wings-total-visitors">
              {H.visitorsTotal(formatNumber(totalVisitors, 0))}
            </span>
          </footer>
        </div>
      </Panel>
    </aside>
  );
});
