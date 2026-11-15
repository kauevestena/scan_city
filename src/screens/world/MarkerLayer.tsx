import { getContract } from '@/data/contracts';
import { STRINGS } from '@/data/strings';
import type { InteractTarget } from '@/engines/overworld/OverworldEngine';
import { InputGlyph } from '@/input/InputGlyph';
import { cx } from '@/ui';

const W = STRINGS.world;

/**
 * Camada de interação sobre o canvas (world-map §5.4): o prompt com o glyph de `INTERACT`
 * para o alvo atual — a porta da sede ou o marcador de contrato no raio de 0,8 tile.
 * Os marcadores em si são desenhados pelo engine, na cor do status.
 */
export function MarkerLayer({ target }: { target: InteractTarget | null }) {
  if (!target) return null;
  const marker = target.kind === 'MARKER' ? target.marker : null;
  const text = marker ? W.viewContract(getContract(marker.contractId).title) : W.enterHq;
  return (
    <div
      className={cx(
        'absolute bottom-4 left-4 flex items-center gap-2 rounded-lg border bg-slate-950/90 px-3 py-2 text-sm',
        marker?.status === 'LOCKED'
          ? 'border-slate-500/60 text-slate-300'
          : 'border-cyan-400/60 text-cyan-200',
      )}
      data-testid="world-prompt"
      data-target={marker ? marker.contractId : 'DOOR'}
    >
      <InputGlyph action="INTERACT" />
      {text}
    </div>
  );
}
