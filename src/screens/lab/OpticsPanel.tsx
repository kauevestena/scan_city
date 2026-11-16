import { Wrench } from 'lucide-react';
import { useMemo } from 'react';
import { STRINGS } from '@/data/strings';
import { formatNumber } from '@/lib/format';
import { Button, cx, FOCUS_RING, Slider } from '@/ui';
import { snapToStep } from '@/ui/Slider';
import { CAMERA_PRESETS, type CameraPreset } from './equipment';
import { Formulas, Reading, Section, Tip } from './LabParts';
import { gsdText, opticsFormulas } from './labels';
import { opticsReadings, type OpticsInput } from './readings';

const L = STRINGS.lab.optics;

/** Faixas dos sliders (infographic-lab §5.1). */
export const OPTICS_RANGES = {
  heightM: { min: 20, max: 300, step: 1 },
  focalMm: { min: 4, max: 50, step: 0.5 },
  pixelUm: { min: 1.5, max: 17, step: 0.01 },
  sensorWidthMm: { min: 6, max: 36, step: 0.1 },
} as const;

/** O preset encaixado nas faixas e nos passos dos sliders. */
export function presetInput(preset: CameraPreset, heightM: number): OpticsInput {
  const r = OPTICS_RANGES;
  return {
    heightM,
    focalMm: snapToStep(preset.focalMm, r.focalMm.min, r.focalMm.max, r.focalMm.step),
    pixelUm: snapToStep(preset.pixelUm, r.pixelUm.min, r.pixelUm.max, r.pixelUm.step),
    sensorWidthMm: snapToStep(
      preset.sensorWidthMm,
      r.sensorWidthMm.min,
      r.sensorWidthMm.max,
      r.sensorWidthMm.step,
    ),
  };
}

/** O preset que casa com os sliders (ou `''` para "Personalizado"). */
function matchingPreset(value: OpticsInput): string {
  return (
    CAMERA_PRESETS.find((p) => {
      const snapped = presetInput(p, value.heightM);
      return (
        snapped.focalMm === value.focalMm &&
        snapped.pixelUm === value.pixelUm &&
        snapped.sensorWidthMm === value.sensorWidthMm
      );
    })?.id ?? ''
  );
}

export interface OpticsPanelProps {
  value: OpticsInput;
  onChange: (next: OpticsInput) => void;
  onUseEquipment: () => void;
  /** Aviso depois de "Usar valores do meu equipamento". */
  equipmentNote: string | null;
}

/** Coluna lateral do painel de Óptica & GSD: sliders, leituras, fórmulas e a dica. */
export function OpticsPanel({ value, onChange, onUseEquipment, equipmentNote }: OpticsPanelProps) {
  const readings = useMemo(() => opticsReadings(value), [value]);
  const formulas = useMemo(() => opticsFormulas(value, readings), [value, readings]);
  const set = (patch: Partial<OpticsInput>) => onChange({ ...value, ...patch });
  const r = OPTICS_RANGES;
  return (
    <div className="flex flex-col gap-5" data-testid="optics-panel">
      <Section title={STRINGS.lab.controls}>
        <label className="flex flex-col gap-1 text-sm text-slate-300">
          {L.preset}
          <select
            data-focusable
            value={matchingPreset(value)}
            onChange={(e) => {
              const preset = CAMERA_PRESETS.find((p) => p.id === e.target.value);
              if (preset) onChange(presetInput(preset, value.heightM));
            }}
            className={cx(
              'h-10 rounded-md border border-slate-700 bg-slate-800 px-2 text-sm text-slate-100',
              FOCUS_RING,
            )}
          >
            <option value="">{L.custom}</option>
            {CAMERA_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <Slider
          label={L.height}
          unit="m"
          {...r.heightM}
          value={value.heightM}
          onChange={(heightM) => set({ heightM })}
        />
        <Slider
          label={L.focal}
          unit="mm"
          {...r.focalMm}
          value={value.focalMm}
          onChange={(focalMm) => set({ focalMm })}
        />
        <Slider
          label={L.pixel}
          unit="µm"
          {...r.pixelUm}
          value={value.pixelUm}
          onChange={(pixelUm) => set({ pixelUm })}
        />
        <Slider
          label={L.sensor}
          unit="mm"
          {...r.sensorWidthMm}
          value={value.sensorWidthMm}
          onChange={(sensorWidthMm) => set({ sensorWidthMm })}
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
      <Section title={STRINGS.lab.readings} testId="optics-readings">
        <dl className="flex flex-col gap-1.5">
          <Reading label={L.gsd} value={gsdText(readings.gsdM)} testId="reading-gsd" tone="warn" />
          <Reading
            label={L.groundWidth}
            value={`${formatNumber(readings.footprintWidthM, 1)} m`}
            testId="reading-wg"
          />
          <Reading
            label={L.groundHeight}
            value={`${formatNumber(readings.footprintHeightM, 1)} m`}
            testId="reading-hg"
          />
          <Reading
            label={L.fov}
            value={`${formatNumber(readings.fovDeg, 1)}°`}
            testId="reading-fov"
          />
          <Reading
            label={L.scale}
            value={L.scaleValue(formatNumber(readings.pecScale, 0))}
            testId="reading-scale"
          />
        </dl>
        <p className="text-xs text-slate-500">{L.scaleNote}</p>
      </Section>
      <Section title={STRINGS.lab.formulas}>
        <Formulas lines={formulas} />
      </Section>
      <Tip>{L.tip}</Tip>
    </div>
  );
}
