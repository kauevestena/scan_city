/** Marcadores visíveis no mapa e seus status (world-map §5.2, §5.4). */
import { contractByMarker } from '@/data/contracts';
import type { ContractProgress, ContractStatus, Dimension } from '@/types';
import { WORLD_MAP, type MapMarker, type OverworldMap } from './tiles';

export interface MarkerView extends MapMarker {
  contractId: string;
  status: ContractStatus;
}

/**
 * Na aba Real, os contratos `0`–`6` que existem no catálogo; na aba Fendas, só as fendas
 * descobertas. Contrato sem progresso salvo conta como bloqueado.
 */
export function markerViews(
  contracts: Readonly<Record<string, ContractProgress>>,
  dimension: Dimension,
  discoveredRifts: readonly string[],
  map: OverworldMap = WORLD_MAP,
): MarkerView[] {
  const kind = dimension === 'REAL' ? 'CONTRACT' : 'RIFT';
  const views: MarkerView[] = [];
  for (const marker of map.markers) {
    if (marker.kind !== kind) continue;
    const contract = contractByMarker(marker.char);
    if (!contract) continue;
    if (kind === 'RIFT' && !discoveredRifts.includes(contract.id)) continue;
    views.push({
      ...marker,
      contractId: contract.id,
      status: contracts[contract.id]?.status ?? 'LOCKED',
    });
  }
  return views;
}
