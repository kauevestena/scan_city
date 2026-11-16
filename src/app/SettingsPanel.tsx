import { STRINGS } from '@/data/strings';
import { useGameStore } from '@/state/store';
import type { Settings } from '@/types';
import { Button, cx, FOCUS_RING, Slider } from '@/ui';

const P = STRINGS.pause;

const QUALITIES: ReadonlyArray<Settings['quality']> = ['LOW', 'MEDIUM', 'HIGH'];

/** Interruptor acessível (`role="switch"`): rótulo à esquerda, estado à direita. */
function SwitchRow({
  label,
  checked,
  onChange,
  testId,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      data-focusable
      data-testid={testId}
      onClick={() => onChange(!checked)}
      className={cx(
        'flex h-10 items-center justify-between gap-3 rounded-md border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 hover:bg-slate-700',
        FOCUS_RING,
      )}
    >
      <span>{label}</span>
      <span
        className={cx(
          'rounded-full px-2 py-0.5 font-mono text-xs',
          checked ? 'bg-cyan-400 text-slate-950' : 'bg-slate-700 text-slate-300',
        )}
      >
        {checked ? P.on : P.off}
      </span>
    </button>
  );
}

/**
 * Configurações (REQ-AUD-003, REQ-NFR-007): volumes geral e de efeitos, mudo, qualidade gráfica,
 * "Reduzir flashes e tremores" e o overlay de FPS. Mudam na hora e são gravadas à parte do save
 * (`scan-city-settings`), por isso sobrevivem ao "Novo jogo".
 */
export function SettingsPanel() {
  const settings = useGameStore((s) => s.settings);
  const setSetting = useGameStore((s) => s.setSetting);
  return (
    <div className="flex flex-col gap-4" data-testid="settings-panel">
      <Slider
        label={P.masterVolume}
        unit="%"
        min={0}
        max={100}
        step={5}
        value={Math.round(settings.masterVolume * 100)}
        onChange={(v) => setSetting('masterVolume', v / 100)}
      />
      <Slider
        label={P.sfxVolume}
        unit="%"
        min={0}
        max={100}
        step={5}
        value={Math.round(settings.sfxVolume * 100)}
        onChange={(v) => setSetting('sfxVolume', v / 100)}
      />
      <SwitchRow
        label={P.muted}
        checked={settings.muted}
        onChange={(v) => setSetting('muted', v)}
        testId="setting-muted"
      />
      <div role="group" aria-label={P.quality} className="flex flex-col gap-1.5">
        <span className="text-sm text-slate-300">{P.quality}</span>
        <div className="flex gap-2">
          {QUALITIES.map((q) => (
            <Button
              key={q}
              size="sm"
              variant={settings.quality === q ? 'primary' : 'secondary'}
              aria-pressed={settings.quality === q}
              data-testid={`setting-quality-${q}`}
              className="flex-1"
              onClick={() => setSetting('quality', q)}
            >
              {P.qualityNames[q]}
            </Button>
          ))}
        </div>
      </div>
      <SwitchRow
        label={P.reduceFlashes}
        checked={settings.reduceFlashes}
        onChange={(v) => setSetting('reduceFlashes', v)}
        testId="setting-reduce-flashes"
      />
      <SwitchRow
        label={P.showFps}
        checked={settings.showFps}
        onChange={(v) => setSetting('showFps', v)}
        testId="setting-show-fps"
      />
    </div>
  );
}
