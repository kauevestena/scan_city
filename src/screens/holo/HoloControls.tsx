import { Globe, Image as ImageIcon, Landmark, Mountain, ScanLine, Sparkles } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { STRINGS } from '@/data/strings';
import { HOLO_MODES, type HoloDimension, type HoloMode } from '@/engines/holo/sceneBuilder';
import { Button, Tabs, type TabDef } from '@/ui';

const H = STRINGS.holo;

const MODE_ICONS: Record<HoloMode, LucideIcon> = {
  ORTHO: ImageIcon,
  HYPSO: Mountain,
  NEON: ScanLine,
};

export interface HoloControlsProps {
  dimension: HoloDimension;
  mode: HoloMode;
  /** O Multiverso só abre com uma fenda descoberta (ou já mapeada). */
  riftsAvailable: boolean;
  panelOpen: boolean;
  onDimension: (dimension: HoloDimension) => void;
  onMode: (mode: HoloMode) => void;
  onTogglePanel: () => void;
}

/**
 * Barra superior da mesa (holo-table §4): chave Terra Real ↔ Multiverso, os três modos de
 * exibição (1 Ortofoto, 2 Hipsometria, 3 LiDAR Neon) e o botão do painel de alas.
 */
export function HoloControls({
  dimension,
  mode,
  riftsAvailable,
  panelOpen,
  onDimension,
  onMode,
  onTogglePanel,
}: HoloControlsProps) {
  const tabs: Array<TabDef<HoloDimension>> = [
    { id: 'REAL', label: H.dimensionReal, icon: Globe },
    {
      id: 'RIFT',
      label: H.dimensionRift,
      icon: Sparkles,
      disabled: !riftsAvailable,
      reason: H.noRifts,
    },
  ];
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-3 p-3">
      <div className="pointer-events-auto rounded-lg bg-slate-950/80 px-2 pt-1">
        <Tabs tabs={tabs} value={dimension} onChange={onDimension} ariaLabel={H.dimensionLabel} />
      </div>
      <div
        role="group"
        aria-label={H.modeLabel}
        className="pointer-events-auto flex items-center gap-1.5 rounded-lg bg-slate-950/80 p-1.5"
      >
        <span className="px-1 text-xs tracking-widest text-slate-400 uppercase">{H.modeLabel}</span>
        {HOLO_MODES.map((m, k) => (
          <Button
            key={m}
            size="sm"
            icon={MODE_ICONS[m]}
            variant={m === mode ? 'primary' : 'secondary'}
            aria-pressed={m === mode}
            aria-keyshortcuts={String(k + 1)}
            data-mode={m}
            onClick={() => onMode(m)}
          >
            {k + 1} {H.modes[m]}
          </Button>
        ))}
      </div>
      <div className="pointer-events-auto rounded-lg bg-slate-950/80 p-1.5">
        <Button
          size="sm"
          icon={Landmark}
          variant={panelOpen ? 'primary' : 'secondary'}
          aria-expanded={panelOpen}
          aria-keyshortcuts="W"
          data-testid="wings-toggle"
          onClick={onTogglePanel}
        >
          {H.wingsToggle}
        </Button>
      </div>
    </div>
  );
}
