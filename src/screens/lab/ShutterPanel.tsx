import { Wrench } from 'lucide-react';
import { useMemo } from 'react';
import { STRINGS } from '@/data/strings';
import { formatNumber } from '@/lib/format';
import { Button, Slider } from '@/ui';
import { Formulas, Reading, Section, Tip } from './LabParts';
import { shutterFormulas } from './labels';
import { shutterReadings, type ShutterInput } from './readings';

const L = STRINGS.lab.shutter;

/** Faixas dos sliders (infographic-lab §5.4). */
export const SHUTTER_RANGES = {
  speedMs: { min: 0, max: 25, step: 0.5 },
  readoutMs: { min: 5, max: 60, step: 1 },
  spinDegS: { min: 0, max: 90, step: 1 },
  gsdCm: { min: 0.5, max: 5, step: 0.01 },
} as const;

export interface ShutterPanelProps {
  value: ShutterInput;
  onChange: (next: ShutterInput) => void;
  onUseEquipment: () => void;
  equipmentNote: string | null;
}

const multiplier = (n: number) => L.multiplier(formatNumber(n, 2));

/** Coluna lateral do painel de Global Shutter vs. Rolling Shutter. */
export function ShutterPanel({
  value,
  onChange,
  onUseEquipment,
  equipmentNote,
}: ShutterPanelProps) {
  const readings = useMemo(() => shutterReadings(value), [value]);
  const formulas = useMemo(() => shutterFormulas(value, readings), [value, readings]);
  const set = (patch: Partial<ShutterInput>) => onChange({ ...value, ...patch });
  const r = SHUTTER_RANGES;
  return (
    <div className="flex flex-col gap-5" data-testid="shutter-panel">
      <Section title={STRINGS.lab.controls}>
        <Slider
          label={L.speed}
          unit="m/s"
          {...r.speedMs}
          value={value.speedMs}
          onChange={(speedMs) => set({ speedMs })}
        />
        <Slider
          label={L.readout}
          unit="ms"
          {...r.readoutMs}
          disabled={value.global}
          value={value.readoutMs}
          onChange={(readoutMs) => set({ readoutMs })}
        />
        <Slider
          label={L.spin}
          unit="°/s"
          {...r.spinDegS}
          value={value.spinDegS}
          onChange={(spinDegS) => set({ spinDegS })}
        />
        <Slider
          label={L.gsd}
          unit="cm"
          {...r.gsdCm}
          value={value.gsdCm}
          onChange={(gsdCm) => set({ gsdCm })}
        />
        <Button
          size="sm"
          variant={value.global ? 'primary' : 'secondary'}
          aria-pressed={value.global}
          data-testid="shutter-global"
          onClick={() => set({ global: !value.global })}
        >
          {L.global}: {value.global ? L.globalOn : L.globalOff}
        </Button>
        <Button size="sm" icon={Wrench} onClick={onUseEquipment} data-testid="use-equipment">
          {STRINGS.lab.useEquipment}
        </Button>
        {equipmentNote && (
          <p className="text-xs text-slate-400" data-testid="equipment-note">
            {equipmentNote}
          </p>
        )}
      </Section>
      <Section title={STRINGS.lab.readings} testId="shutter-readings">
        <dl className="flex flex-col gap-1.5">
          <Reading
            label={L.skew}
            value={`${formatNumber(readings.skewPx, 2)} px`}
            testId="reading-skew"
            tone="warn"
          />
          <Reading
            label={L.shear}
            value={`${formatNumber(readings.shearDeg, 2)}°`}
            testId="reading-shear"
          />
          <Reading
            label={L.groundHeight}
            value={`${formatNumber(readings.groundHeightM, 1)} m`}
            testId="reading-ground-height"
          />
          <Reading
            label={L.rmseNoRtk}
            value={multiplier(readings.rmseNoRtk)}
            testId="reading-rmse-no-rtk"
            tone={readings.rmseNoRtk > 1 ? 'danger' : 'ok'}
          />
          <Reading
            label={L.rmseRtk}
            value={multiplier(readings.rmseRtk)}
            testId="reading-rmse-rtk"
            tone={readings.rmseRtk > 1 ? 'warn' : 'ok'}
          />
        </dl>
      </Section>
      <Section title={STRINGS.lab.formulas}>
        <Formulas lines={formulas} />
      </Section>
      <Tip>{L.tip}</Tip>
    </div>
  );
}
