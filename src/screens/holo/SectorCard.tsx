import { Star } from 'lucide-react';
import { STRINGS } from '@/data/strings';
import { visitorsPerHour } from '@/domain/museum';
import type { HoloSector } from '@/engines/holo/sceneBuilder';
import { formatBRL, formatDateTime, formatNumber } from '@/lib/format';
import { useGameStore } from '@/state/store';
import { Button, Panel } from '@/ui';

const H = STRINGS.holo;

/** Cartão do setor selecionado (holo-table §4, REQ-HOL-008). */
export function SectorCard({ sector }: { sector: HoloSector }) {
  const featured = useGameStore((s) => s.museum.featured.REAL);
  const contract = sector.contract;
  if (!sector.mapped || !sector.museum || !contract) {
    return (
      <div data-testid="sector-card">
        <Panel className="w-80">
          <p className="text-sm text-slate-300">
            {contract ? H.unmapped(contract.title) : H.unknownSector}
          </p>
        </Panel>
      </div>
    );
  }
  const m = sector.museum;
  const isFeatured = featured === contract.id;
  return (
    <div data-testid="sector-card">
      <Panel title={contract.title} className="w-80">
        <div className="flex flex-col gap-1 text-sm text-slate-200">
          <span className="text-slate-400">{contract.client.name}</span>
          <span>{H.mappedAt(formatDateTime(m.mappedAt))}</span>
          <span className="font-mono">
            {m.className && `${H.className(m.className)} · `}
            {H.score(Math.round(m.qualityScore * 100))}
          </span>
          <span className="font-mono text-lime-300">
            {H.income(formatBRL(m.incomePerMinBRL * (isFeatured ? 2 : 1)))}
          </span>
          <span className="font-mono">
            {H.visitors(formatNumber(visitorsPerHour(m.incomePerMinBRL), 0))}
          </span>
          <Button
            size="sm"
            icon={Star}
            variant={isFeatured ? 'primary' : 'secondary'}
            className="mt-2 w-fit"
            onClick={() =>
              useGameStore.getState().setFeatured('REAL', isFeatured ? null : contract.id)
            }
          >
            {isFeatured ? H.featured : H.feature}
          </Button>
        </div>
      </Panel>
    </div>
  );
}
