import { getAircraft } from '@/data/catalog';
import { STRINGS } from '@/data/strings';
import { blurClass } from '@/domain/photogrammetry';
import { estimateFromPlan, predictRequirements } from '@/domain/requirements';
import { formatCm, formatDuration, formatMm, formatNumber, formatUm } from '@/lib/format';
import { useGameStore } from '@/state/store';
import type { ReactNode } from 'react';
import { Stat, type StatusTone } from '@/ui';
import type { FieldContext } from './useFieldContext';
import { resolveRuleEffects } from '@/domain/specialRules';

const S = STRINGS.field.stats;

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold tracking-widest text-slate-400 uppercase">{title}</h3>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">{children}</div>
    </section>
  );
}

/** Energia disponível: baterias (1 + reservas) ou milho (papo + estoque), em unidades. */
export function energyFor(
  aircraftId: string,
  inventory: { corn: { crop: number; stock: number } },
  flightTimeS: number,
  batteriesNeeded: number,
): { corn: boolean; needed: number; available: number } {
  const aircraft = getAircraft(aircraftId);
  if (aircraft.energyUnit === 'CORN') {
    return {
      corn: true,
      needed: Math.ceil(flightTimeS / 60),
      available: inventory.corn.crop + inventory.corn.stock,
    };
  }
  return { corn: false, needed: batteriesNeeded, available: 1 + aircraft.spareBatteries };
}

/** Estatísticas ao vivo da aba 2 (field-setup §5.3, REQ-FLD-007), todas calculadas pelo domínio. */
export function PlanStats({ field }: { field: FieldContext }) {
  const corn = useGameStore((s) => s.inventory.corn);
  const { mission, contract, predict } = field;
  const { plan } = mission;
  const st = plan.stats;
  const results = predictRequirements(plan, contract, mission.groundPoints, predict);
  const gsdResult = contract.requirements.find((r) => r.check.type === 'MAX_GSD_CM');
  const gsdPass = gsdResult ? results.find((r) => r.id === gsdResult.id)?.pass : undefined;
  const pec = contract.requirements.find((r) => r.check.type === 'ACCURACY_PEC');
  const pecText = pec ? results.find((r) => r.id === pec.id)?.valueText : undefined;
  const estimate = estimateFromPlan(plan, contract, mission.groundPoints, predict);
  const blur = blurClass(st.blurPx);
  const blurTone: StatusTone = blur === 'OK' ? 'ok' : blur === 'WARN' ? 'warn' : 'danger';
  const cross = plan.lines.filter((l) => l.pass === 'CROSS').length;
  const energy = energyFor(plan.params.aircraftId, { corn }, st.flightTimeS, st.batteriesNeeded);
  const fog =
    contract.lightingOptions.includes('MAGIC_FOG') ||
    resolveRuleEffects(contract.specialRules).coverage.fog;
  const aircraft = getAircraft(plan.params.aircraftId);
  const teardrop = aircraft.turnRadiusM > 0 && st.spacingM < 2 * aircraft.turnRadiusM;

  return (
    <div className="flex flex-col gap-5" data-testid="plan-stats">
      <Group title={S.geometry}>
        <Stat label={S.focal} value={formatMm(st.focalM, 1)} />
        <Stat label={S.pixel} value={formatUm(st.pixelPitchM, 2)} />
        <Stat
          label={S.gsd}
          value={<span data-testid="stat-gsd">{formatCm(st.gsdM, 2)}</span>}
          status={gsdPass === undefined ? 'neutral' : gsdPass ? 'ok' : 'danger'}
        />
        <Stat
          label={S.footprint}
          value={`${formatNumber(st.footprintWM, 1)} × ${formatNumber(st.footprintHM, 1)}`}
          unit="m"
        />
        <Stat label={S.base} value={formatNumber(st.baseM, 1)} unit="m" />
        <Stat label={S.spacing} value={formatNumber(st.spacingM, 1)} unit="m" />
        <Stat label={S.interval} value={formatNumber(st.intervalS, 2)} unit="s" />
      </Group>
      <Group title={S.mission}>
        <Stat
          label={S.lines}
          value={
            <span data-testid="stat-lines">{S.linesValue(plan.lines.length - cross, cross)}</span>
          }
        />
        <Stat label={S.photosPerLine} value={st.photosPerLine} />
        <Stat
          label={S.totalPhotos}
          value={<span data-testid="stat-photos">{st.totalPhotos}</span>}
        />
        <Stat label={S.lineLength} value={formatNumber(st.lineLengthM, 0)} unit="m" />
        <Stat
          label={S.turnTime}
          value={formatNumber(st.turnTimeS, 1)}
          unit="s"
          hint={teardrop ? S.teardrop : undefined}
        />
        <Stat
          label={S.flightTime}
          value={<span data-testid="stat-time">{formatDuration(st.flightTimeS)}</span>}
        />
        <Stat
          label={energy.corn ? S.corn : S.batteries}
          value={S.energyValue(energy.needed, energy.available)}
          status={energy.needed > energy.available ? 'danger' : 'ok'}
        />
      </Group>
      <Group title={S.quality}>
        <Stat
          label={S.blur}
          value={`${formatNumber(st.blurPx, 2)} px (${S.blurClass[blur]})`}
          status={blurTone}
        />
        <Stat label={S.skew} value={formatNumber(st.skewPx, 2)} unit="px" />
        <Stat label={S.rmseXy} value={formatCm(estimate.rmse.r, 1)} />
        <Stat label={S.rmseZ} value={formatCm(estimate.rmse.z, 1)} />
        {pecText && <Stat label={S.pecClass} value={pecText} />}
      </Group>
      {st.lidarDensity !== undefined && (
        <Group title={S.lidar}>
          <Stat label={S.swath} value={formatNumber(st.lidarSwathM ?? 0, 1)} unit="m" />
          <Stat label={S.density} value={formatNumber(st.lidarDensity, 1)} unit="pts/m²" />
          <Stat
            label={S.groundDensity}
            value={formatNumber(st.groundDensity ?? 0, 1)}
            unit="pts/m²"
          />
        </Group>
      )}
      {fog && plan.params.primarySensor === 'RGB' && (
        <p className="rounded-md border border-amber-400/60 bg-amber-400/10 p-2 text-sm text-amber-200">
          {S.fogWarning}
        </p>
      )}
    </div>
  );
}
