import { Globe, Sparkles } from 'lucide-react';
import { STRINGS } from '@/data/strings';
import { xpToNext } from '@/domain/progression';
import { InputGlyph } from '@/input/InputGlyph';
import { InputManager } from '@/input/InputManager';
import { formatBRL } from '@/lib/format';
import { selectMuseumIncome } from '@/state/selectors';
import { useGameStore } from '@/state/store';
import { cx, EmblemBadge, FOCUS_RING, Gauge, MoneyText, ProgressBar } from '@/ui';

const T = STRINGS.topBar;

/** Barra superior (REQ-UI-003, ui-style §3): 48 px, da esquerda para a direita. */
export function TopBar() {
  const emblem = useGameStore((s) => s.inventory.emblem);
  const money = useGameStore((s) => s.player.money);
  const level = useGameStore((s) => s.player.level);
  const xp = useGameStore((s) => s.player.xp);
  const reputation = useGameStore((s) => s.player.reputation);
  const income = useGameStore(selectMuseumIncome);
  const dimension = useGameStore((s) => s.world.dimensionTab);
  const next = xpToNext(level);
  const rift = dimension === 'RIFT';
  const DimensionIcon = rift ? Sparkles : Globe;

  return (
    <header
      data-testid="top-bar"
      className="flex h-12 shrink-0 items-center gap-6 border-b border-slate-800 bg-slate-900/95 px-4"
    >
      <div className="flex items-center gap-2">
        <EmblemBadge emblem={emblem} size={32} title={T.company} />
        <span className="text-sm font-semibold tracking-widest text-slate-100 uppercase">
          {T.company}
        </span>
      </div>
      <MoneyText cents={money} className="text-sm" />
      <div className="flex items-center gap-2" title={T.xp(xp, next)}>
        <span className="font-mono text-xs text-slate-300 tabular-nums" data-testid="top-bar-level">
          {T.level(level)}
        </span>
        <div className="w-[120px]">
          <ProgressBar value={xp / next} />
        </div>
      </div>
      <div className="w-28">
        <Gauge value={reputation / 100} label={T.reputation} valueText={String(reputation)} />
      </div>
      <div className="flex flex-col leading-tight">
        <span className="text-[10px] text-slate-400">{T.museumLabel}</span>
        <span className="font-mono text-xs text-lime-300 tabular-nums" data-testid="top-bar-income">
          {T.museumIncome(formatBRL(Math.round(income)))}
        </span>
      </div>
      <span
        className={cx(
          'flex items-center gap-1.5 text-xs',
          rift ? 'text-violet-400' : 'text-cyan-400',
        )}
        data-testid="top-bar-dimension"
      >
        <DimensionIcon size={16} strokeWidth={1.75} aria-hidden />
        {T.dimensions[dimension]}
      </span>
      <button
        type="button"
        aria-label={T.pause}
        onClick={() => {
          if (!InputManager.get().hasModalLayer) useGameStore.getState().setPaused(true);
        }}
        className={cx(
          'ml-auto flex h-8 items-center gap-2 rounded-md px-2 text-xs text-slate-300 hover:bg-slate-800',
          FOCUS_RING,
        )}
      >
        <InputGlyph action="PAUSE" />
      </button>
    </header>
  );
}
