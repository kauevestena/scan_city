import { Cloud, CloudFog, Snowflake, Sun, Sunset, type LucideIcon } from 'lucide-react';
import { CATALOG, getAircraft, itemName } from '@/data/catalog';
import { STRINGS } from '@/data/strings';
import { aircraftMeetsCritical } from '@/domain/flightPlanner';
import {
  compatibleOwnedSensors,
  modeSupport,
  ownedLenses,
  planLimits,
  withAircraft,
  withSensor,
} from '@/domain/planEditing';
import { useGameStore } from '@/state/store';
import type { LightingId, PlanParams, SensorKind } from '@/types';
import type { ReactNode } from 'react';
import { cx, FOCUS_RING, Slider, Tabs, type TabDef } from '@/ui';
import { heightWarnRange, overlapWarnRange } from './fieldModel';
import { PlanStats } from './PlanStats';
import type { FieldContext } from './useFieldContext';

const F = STRINGS.field;

const LIGHT_ICONS: Record<LightingId, LucideIcon> = {
  SUN_HIGH: Sun,
  OVERCAST: Cloud,
  GOLDEN_HOUR: Sunset,
  BLIZZARD: Snowflake,
  MAGIC_FOG: CloudFog,
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="text-xs font-semibold tracking-widest text-slate-400 uppercase">{label}</h3>
      {children}
    </section>
  );
}

function Toggle({
  label,
  pressed,
  onChange,
  testId,
}: {
  label: string;
  pressed: boolean;
  onChange: (pressed: boolean) => void;
  testId?: string;
}) {
  return (
    <button
      type="button"
      data-focusable
      aria-pressed={pressed}
      data-testid={testId}
      onClick={() => onChange(!pressed)}
      className={cx(
        'rounded-md border px-3 py-1.5 text-sm',
        pressed
          ? 'border-cyan-400 bg-cyan-400/15 text-cyan-200'
          : 'border-slate-700 text-slate-300 hover:bg-slate-800',
        FOCUS_RING,
      )}
    >
      {label}
    </button>
  );
}

/** Aba 2 (field-setup §5.3): equipamento, sliders com faixas de aviso, modos e iluminação. */
export function FlightPlanTab({ field }: { field: FieldContext }) {
  const inventory = useGameStore((s) => s.inventory);
  const { mission, contract } = field;
  const params = mission.plan.params;
  const aircraft = getAircraft(params.aircraftId);
  const limits = planLimits(aircraft, contract);
  const modes = modeSupport(aircraft);
  const sensors = compatibleOwnedSensors(aircraft, inventory);
  const lenses = ownedLenses(params.sensorId, inventory, CATALOG);

  const update = (next: PlanParams) =>
    useGameStore.getState().updatePlan(next, { meanCanopy: field.meanCanopy });
  const set = <K extends keyof PlanParams>(key: K, value: PlanParams[K]) =>
    update({ ...params, [key]: value });

  const aircraftTabs: Array<TabDef<string>> = CATALOG.aircraft
    .filter((a) => inventory.aircraft.includes(a.id))
    .map((a) => {
      const ok = aircraftMeetsCritical(a, contract, inventory, CATALOG);
      return {
        id: a.id,
        label: a.name,
        disabled: !ok,
        reason: ok ? undefined : F.aircraftIncompatible,
      };
    });

  const changeAircraft = (id: string) => {
    const change = withAircraft(params, id, contract, inventory, CATALOG);
    update(change.params);
    if (change.sensorChanged) {
      useGameStore.getState().pushToast({
        type: 'info',
        title: F.sensorSwapped(itemName(change.params.sensorId)),
      });
    }
  };

  const sensorTabs: Array<TabDef<string>> = sensors.map((id) => ({ id, label: itemName(id) }));
  const lensTabs: Array<TabDef<string>> = lenses.map((id) => ({ id, label: itemName(id) }));
  const lightingTabs: Array<TabDef<LightingId>> = contract.lightingOptions.map((id) => ({
    id,
    label: STRINGS.lighting[id],
    icon: LIGHT_ICONS[id],
  }));
  const orientationTabs: Array<TabDef<PlanParams['orientation']>> = [
    { id: 'ALONG_LENGTH', label: F.orientations.ALONG_LENGTH },
    { id: 'ALONG_WIDTH', label: F.orientations.ALONG_WIDTH },
  ];
  const primaryTabs: Array<TabDef<SensorKind>> = [
    { id: 'RGB', label: STRINGS.requirements.sensorKinds.RGB },
    { id: 'LIDAR', label: STRINGS.requirements.sensorKinds.LIDAR },
  ];

  return (
    <div className="flex flex-col gap-5" data-testid="flight-plan-tab">
      <Field label={F.aircraft}>
        <Tabs
          tabs={aircraftTabs}
          value={params.aircraftId}
          onChange={changeAircraft}
          ariaLabel={F.aircraft}
        />
      </Field>
      <Field label={F.sensor}>
        <Tabs
          tabs={sensorTabs}
          value={params.sensorId}
          onChange={(id) => update(withSensor(params, id, inventory, CATALOG))}
          ariaLabel={F.sensor}
        />
      </Field>
      {params.sensorId === 'POD_LIDAR' && (
        <Field label={F.primarySensor}>
          <Tabs
            tabs={primaryTabs}
            value={params.primarySensor}
            onChange={(kind) => set('primarySensor', kind)}
            ariaLabel={F.primarySensor}
          />
        </Field>
      )}
      {lensTabs.length > 0 && params.lensId && (
        <Field label={F.lens}>
          <Tabs
            tabs={lensTabs}
            value={params.lensId}
            onChange={(id) => set('lensId', id as PlanParams['lensId'])}
            ariaLabel={F.lens}
          />
        </Field>
      )}
      <Slider
        label={F.height}
        value={params.heightM}
        min={limits.heightM.min}
        max={limits.heightM.max}
        unit="m"
        warnRange={heightWarnRange(contract, mission.plan.stats, limits.heightM.max)}
        onChange={(v) => set('heightM', v)}
      />
      <Slider
        label={F.forwardOverlap}
        value={params.forwardOverlapPct}
        min={limits.forwardOverlapPct.min}
        max={limits.forwardOverlapPct.max}
        unit="%"
        warnRange={overlapWarnRange(contract, 'MIN_FORWARD_OVERLAP', limits.forwardOverlapPct.min)}
        onChange={(v) => set('forwardOverlapPct', v)}
      />
      <Slider
        label={F.sideOverlap}
        value={params.sideOverlapPct}
        min={limits.sideOverlapPct.min}
        max={limits.sideOverlapPct.max}
        unit="%"
        warnRange={overlapWarnRange(contract, 'MIN_SIDE_OVERLAP', limits.sideOverlapPct.min)}
        onChange={(v) => set('sideOverlapPct', v)}
      />
      <Slider
        label={F.speed}
        value={params.speedMs}
        min={limits.speedMs.min}
        max={limits.speedMs.max}
        step={0.5}
        unit="m/s"
        onChange={(v) => set('speedMs', v)}
      />
      <Field label={F.orientation}>
        <Tabs
          tabs={orientationTabs}
          value={params.orientation}
          onChange={(o) => set('orientation', o)}
          ariaLabel={F.orientation}
        />
      </Field>
      {(modes.crossGrid || modes.terrainFollowing || modes.oblique) && (
        <Field label={F.modes}>
          <div className="flex flex-wrap gap-2" data-testid="plan-modes">
            {modes.terrainFollowing && (
              <Toggle
                label={STRINGS.requirements.modes.TERRAIN_FOLLOWING}
                pressed={params.terrainFollowing}
                onChange={(on) => set('terrainFollowing', on)}
              />
            )}
            {modes.crossGrid && (
              <Toggle
                label={STRINGS.requirements.modes.CROSS_GRID}
                pressed={params.crossGrid}
                onChange={(on) => set('crossGrid', on)}
                testId="toggle-cross-grid"
              />
            )}
            {modes.oblique &&
              ([45, 60] as const).map((deg) => (
                <Toggle
                  key={deg}
                  label={F.oblique(deg)}
                  pressed={params.obliqueDeg === deg}
                  onChange={(on) => {
                    const next: PlanParams = { ...params };
                    if (on) next.obliqueDeg = deg;
                    else delete next.obliqueDeg;
                    update(next);
                  }}
                />
              ))}
          </div>
        </Field>
      )}
      <Field label={F.lighting}>
        <Tabs
          tabs={lightingTabs}
          value={params.lighting}
          onChange={(l) => set('lighting', l)}
          ariaLabel={F.lighting}
        />
        <p className="text-xs text-slate-400" data-testid="lighting-hint">
          {F.lightingHints[params.lighting]}
        </p>
      </Field>
      <PlanStats field={field} />
    </div>
  );
}
