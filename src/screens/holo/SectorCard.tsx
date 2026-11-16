import { Star } from 'lucide-react';
import { STRINGS } from '@/data/strings';
import { visitorsPerHour } from '@/domain/museum';
import type { HoloSector } from '@/engines/holo/sceneBuilder';
import { formatBRL, formatDateTime, formatNumber } from '@/lib/format';
import { selectModifiers } from '@/state/selectors';
import { useGameStore } from '@/state/store';
import { Button, Panel } from '@/ui';

const H = STRINGS.holo;

/**
 * Cartão do setor selecionado (holo-table §4, REQ-HOL-008), na ala dele: o destaque é por ala.
 * A renda mostrada já inclui o destaque (×2) e o modificador de visitantes.
 */
export function SectorCard({ sector }: { sector: HoloSector }) {
  const featured = useGameStore((s) => s.museum.featured[sector.wing]);
  const visitorsMod = useGameStore((s) => selectModifiers(s).museumVisitors);
  const discovered = useGameStore((s) => s.world.discoveredRifts);
  const contract = sector.contract;
  if (!sector.mapped || !sector.museum || !contract) {
    // Uma fenda ainda não descoberta não entrega o nome.
    const hidden = contract?.museum.wing === 'RIFT' && !discovered.includes(contract.id);
    return (
      <div data-testid="sector-card">
        <Panel className="w-80" variant={sector.wing === 'RIFT' ? 'rift' : 'default'}>
          <p className="text-sm text-slate-300">
            {contract && !hidden
              ? H.unmapped(contract.title)
              : hidden
                ? H.unknownRift
                : H.unknownSector}
          </p>
        </Panel>
      </div>
    );
  }
  const m = sector.museum;
  const isFeatured = featured === contract.id;
  const income = m.incomePerMinBRL * (isFeatured ? 2 : 1) * visitorsMod;
  return (
    <div data-testid="sector-card">
      <Panel
        title={contract.title}
        className="w-80"
        variant={sector.wing === 'RIFT' ? 'rift' : 'default'}
      >
        <div className="flex flex-col gap-1 text-sm text-slate-200">
          <span className="text-slate-400">{contract.client.name}</span>
          <span>{H.mappedAt(formatDateTime(m.mappedAt))}</span>
          <span className="font-mono">
            {m.className && `${H.className(m.className)} · `}
            {H.score(Math.round(m.qualityScore * 100))}
          </span>
          <span className="font-mono text-lime-300">{H.income(formatBRL(income))}</span>
          <span className="font-mono">{H.visitors(formatNumber(visitorsPerHour(income), 0))}</span>
          <Button
            size="sm"
            icon={Star}
            variant={isFeatured ? 'primary' : 'secondary'}
            className="mt-2 w-fit"
            onClick={() =>
              useGameStore.getState().setFeatured(sector.wing, isFeatured ? null : contract.id)
            }
          >
            {isFeatured ? H.featured : H.feature}
          </Button>
        </div>
      </Panel>
    </div>
  );
}
