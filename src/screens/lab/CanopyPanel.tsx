import { Wrench } from 'lucide-react';
import { useMemo } from 'react';
import { STRINGS } from '@/data/strings';
import { formatNumber, formatPct } from '@/lib/format';
import { Button, Slider } from '@/ui';
import { Formulas, Reading, Section, Tip } from './LabParts';
import { canopyFormulas, densityText } from './labels';
import { canopyReadings, LIDAR_FOV_DEG, type CanopyInput } from './readings';

const L = STRINGS.lab.canopy;

/** Faixas dos sliders (infographic-lab §5.3). */
export const CANOPY_RANGES = {
  canopyPct: { min: 0, max: 98, step: 1 },
  maxReturns: { min: 1, max: 5, step: 1 },
  prrKHz: { min: 50, max: 500, step: 10 },
  heightM: { min: 40, max: 300, step: 5 },
  speedMs: { min: 5, max: 25, step: 1 },
} as const;

export interface CanopyPanelProps {
  value: CanopyInput;
  onChange: (next: CanopyInput) => void;
  onUseEquipment: () => void;
  equipmentNote: string | null;
}

/** Coluna lateral do painel de LiDAR vs. Fotogrametria no Dossel. */
export function CanopyPanel({ value, onChange, onUseEquipment, equipmentNote }: CanopyPanelProps) {
  const readings = useMemo(() => canopyReadings(value), [value]);
  const formulas = useMemo(() => canopyFormulas(value, readings), [value, readings]);
  const set = (patch: Partial<CanopyInput>) => onChange({ ...value, ...patch });
  const r = CANOPY_RANGES;
  return (
    <div className="flex flex-col gap-5" data-testid="canopy-panel">
      <Section title={STRINGS.lab.controls}>
        <Slider
          label={L.cover}
          unit="%"
          {...r.canopyPct}
          value={value.canopyPct}
          onChange={(canopyPct) => set({ canopyPct })}
        />
        <Slider
          label={L.returns}
          {...r.maxReturns}
          value={value.maxReturns}
          onChange={(maxReturns) => set({ maxReturns })}
        />
        <Slider
          label={L.prr}
          unit="kHz"
          {...r.prrKHz}
          value={value.prrKHz}
          onChange={(prrKHz) => set({ prrKHz })}
        />
        <Slider
          label={L.height}
          unit="m"
          {...r.heightM}
          value={value.heightM}
          onChange={(heightM) => set({ heightM })}
        />
        <Slider
          label={L.speed}
          unit="m/s"
          {...r.speedMs}
          value={value.speedMs}
          onChange={(speedMs) => set({ speedMs })}
        />
        <p className="text-xs text-slate-400">
          {L.fov}: {LIDAR_FOV_DEG}°
        </p>
        <Button size="sm" icon={Wrench} onClick={onUseEquipment} data-testid="use-equipment">
          {STRINGS.lab.useEquipment}
        </Button>
        {equipmentNote && (
          <p className="text-xs text-slate-400" data-testid="equipment-note">
            {equipmentNote}
          </p>
        )}
      </Section>
      <Section title={STRINGS.lab.readings} testId="canopy-readings">
        <dl className="flex flex-col gap-1.5">
          <Reading
            label={L.groundProbability}
            value={formatPct(readings.groundProbability, 2)}
            testId="reading-p-ground"
            tone="warn"
          />
          <Reading
            label={L.groundDensity}
            value={densityText(readings.groundDensityPtsM2)}
            testId="reading-ground-density"
            tone="warn"
          />
          <Reading
            label={L.density}
            value={densityText(readings.densityPtsM2)}
            testId="reading-density"
          />
          <Reading
            label={L.swath}
            value={`${formatNumber(readings.swathM, 1)} m`}
            testId="reading-swath"
          />
          <Reading
            label={L.photoVisibility}
            value={formatPct(readings.photoVisibility, 2)}
            testId="reading-photo-visibility"
          />
          <Reading
            label={L.verdict}
            value={readings.reliable ? L.reliable : L.insufficient}
            testId="reading-verdict"
            tone={readings.reliable ? 'ok' : 'danger'}
          />
        </dl>
        <p className="text-xs text-slate-400">{L.verdictNote}</p>
      </Section>
      <Section title={STRINGS.lab.formulas}>
        <Formulas lines={formulas} />
      </Section>
      <Tip>{L.tip}</Tip>
    </div>
  );
}
