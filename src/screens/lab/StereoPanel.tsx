import { Wrench } from 'lucide-react';
import { useMemo } from 'react';
import { STRINGS } from '@/data/strings';
import { formatCm, formatMm, formatNumber } from '@/lib/format';
import { Button, Slider } from '@/ui';
import { Formulas, Reading, Section, Tip, type ReadingTone } from './LabParts';
import { stereoFormulas } from './labels';
import { MAX_OBJECT_FRACTION, stereoReadings, type StereoInput } from './readings';

const L = STRINGS.lab.stereo;

/** Faixas dos sliders (infographic-lab §5.2); o máximo de h acompanha H. */
export const STEREO_RANGES = {
  baseM: { min: 5, max: 100, step: 1 },
  heightM: { min: 50, max: 300, step: 1 },
  focalMm: { min: 10, max: 50, step: 0.5 },
  sigmaPx: { min: 0.1, max: 1, step: 0.05 },
} as const;

/** Teto do slider de h: 0,8·H, em passos de 0,5 m. */
export function maxObjectM(heightM: number): number {
  return Math.floor((heightM * MAX_OBJECT_FRACTION) / 0.5) * 0.5;
}

/** Ajusta o h quando H muda (ou quando o equipamento troca H): nunca passa de 0,8·H. */
export function withHeight(value: StereoInput, heightM: number): StereoInput {
  return { ...value, heightM, objectM: Math.min(value.objectM, maxObjectM(heightM)) };
}

const RATIO_TONE: Record<ReturnType<typeof stereoReadings>['ratioClass'], ReadingTone> = {
  WEAK: 'danger',
  GOOD: 'ok',
  STRONG: 'warn',
};

export interface StereoPanelProps {
  value: StereoInput;
  onChange: (next: StereoInput) => void;
  onUseEquipment: () => void;
  equipmentNote: string | null;
}

/** Coluna lateral do painel de Estereoscopia & Paralaxe. */
export function StereoPanel({ value, onChange, onUseEquipment, equipmentNote }: StereoPanelProps) {
  const readings = useMemo(() => stereoReadings(value), [value]);
  const formulas = useMemo(() => stereoFormulas(value, readings), [value, readings]);
  const set = (patch: Partial<StereoInput>) => onChange({ ...value, ...patch });
  const r = STEREO_RANGES;
  return (
    <div className="flex flex-col gap-5" data-testid="stereo-panel">
      <Section title={STRINGS.lab.controls}>
        <Slider
          label={L.base}
          unit="m"
          {...r.baseM}
          value={value.baseM}
          onChange={(baseM) => set({ baseM })}
        />
        <Slider
          label={L.height}
          unit="m"
          {...r.heightM}
          value={value.heightM}
          onChange={(heightM) => onChange(withHeight(value, heightM))}
        />
        <Slider
          label={L.object}
          unit="m"
          min={0}
          max={maxObjectM(value.heightM)}
          step={0.5}
          value={value.objectM}
          onChange={(objectM) => set({ objectM })}
        />
        <Slider
          label={L.focal}
          unit="mm"
          {...r.focalMm}
          value={value.focalMm}
          onChange={(focalMm) => set({ focalMm })}
        />
        <Slider
          label={L.sigma}
          unit="px"
          {...r.sigmaPx}
          value={value.sigmaPx}
          onChange={(sigmaPx) => set({ sigmaPx })}
        />
        <Button size="sm" icon={Wrench} onClick={onUseEquipment} data-testid="use-equipment">
          {STRINGS.lab.useEquipment}
        </Button>
        {equipmentNote && (
          <p className="text-xs text-slate-400" data-testid="equipment-note">
            {equipmentNote}
          </p>
        )}
      </Section>
      <Section title={STRINGS.lab.readings} testId="stereo-readings">
        <dl className="flex flex-col gap-1.5">
          <Reading
            label={L.photoBase}
            value={formatMm(readings.photoBaseM, 2)}
            testId="reading-b"
            tone="warn"
          />
          <Reading
            label={L.parallax}
            value={formatMm(readings.parallaxDiffM, 3)}
            testId="reading-dp"
            tone="warn"
          />
          <Reading
            label={L.reconstructed}
            value={`${formatNumber(readings.reconstructedM, 2)} m`}
            testId="reading-h"
          />
          <Reading
            label={L.ratio}
            value={`${formatNumber(readings.ratio, 2)} · ${L.ratioClass[readings.ratioClass]}`}
            testId="reading-ratio"
            tone={RATIO_TONE[readings.ratioClass]}
          />
          <Reading
            label={L.depth}
            value={formatCm(readings.depthPrecisionM, 2)}
            testId="reading-sigma-z"
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
