import { itemName } from '@/data/catalog';
import { getContract } from '@/data/contracts';
import { STRINGS } from '@/data/strings';
import { estimatedSideOverlapPct, medianForwardOverlapPct } from '@/domain/mission';
import { formatCm, formatDuration, formatNumber } from '@/lib/format';
import type { MissionData, QualityReport } from '@/types';
import { useGameStore } from '@/state/store';
import { ChecklistItem, cx, DialogueBox, EmblemBadge } from '@/ui';

const P = STRINGS.processing;

/** Ficha técnica da missão (§5.4), a partir dos disparos registrados. */
export function technicalSheet(mission: MissionData): Array<[string, string]> {
  const { plan, shots } = mission;
  const R = P.sheetRows;
  const meanAgl =
    shots.length > 0 ? shots.reduce((s, x) => s + x.aglM, 0) / shots.length : plan.params.heightM;
  const gsd = (meanAgl * plan.stats.pixelPitchM) / plan.stats.focalM;
  const blurred = shots.filter((s) => s.blurred).length;
  const water = shots.filter((s) => s.overWater).length;
  const fog = shots.filter((s) => s.inFog).length;
  const valid = shots.length - shots.filter((s) => s.blurred || s.overWater || s.inFog).length;
  const p = medianForwardOverlapPct(shots);
  const q = estimatedSideOverlapPct(mission);
  const pulses = mission.lidar?.grid.pulses.reduce((a, b) => a + b, 0) ?? 0;
  const rows: Array<[string, string]> = [
    [R.aircraft, itemName(plan.params.aircraftId)],
    [R.sensor, itemName(plan.params.sensorId)],
  ];
  if (plan.params.lensId) rows.push([R.lens, itemName(plan.params.lensId)]);
  rows.push(
    [R.agl, `${formatNumber(meanAgl, 1)} m`],
    [R.gsd, formatCm(gsd, 2)],
    [R.p, p === null ? '—' : `${formatNumber(p, 0)} %`],
    [R.q, q === null ? '—' : `${formatNumber(q, 0)} %`],
    [R.photos, `${valid} / ${blurred} / ${water} / ${fog}`],
  );
  if (pulses > 0) rows.push([R.pulses, formatNumber(Math.round(pulses), 0)]);
  rows.push(
    [R.sorties, String(mission.sorties.length)],
    [R.collisions, String(mission.events.collisions)],
    [R.duration, formatDuration(mission.sorties.reduce((a, s) => a + s.durationS, 0))],
  );
  return rows;
}

export function ReportSummary({
  report,
  mission,
}: {
  report: QualityReport;
  mission: MissionData;
}) {
  const emblem = useGameStore((s) => s.inventory.emblem);
  const contract = getContract(report.contractId);
  const cls = report.pec?.planimetric.achieved;
  return (
    <div className="grid gap-6 lg:grid-cols-2" data-testid="report-summary">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <span data-testid="report-emblem">
            <EmblemBadge emblem={emblem} size={44} title={STRINGS.topBar.company} />
          </span>
          <span
            className={cx(
              'text-3xl font-bold tracking-widest',
              report.approved ? 'text-emerald-400' : 'text-rose-500',
            )}
            data-testid="report-status"
          >
            {report.approved ? P.approved : P.rejected}
          </span>
          {cls && (
            <span className="font-mono text-lg text-slate-100" data-testid="report-class">
              {P.classAchieved(cls)}
            </span>
          )}
          <span className="font-mono text-lg text-slate-300">
            {P.score(Math.round(report.qualityScore * 100))}
          </span>
        </div>
        <section>
          <h3 className="mb-1 text-xs font-semibold tracking-widest text-slate-400 uppercase">
            {P.requirements}
          </h3>
          <ul data-testid="report-requirements">
            {report.requirements.map((r) => (
              <ChecklistItem
                key={r.id}
                status={r.pass ? 'pass' : 'fail'}
                label={r.label}
                severity={r.severity}
                detail={r.valueText}
              />
            ))}
          </ul>
        </section>
        <DialogueBox
          speaker={{ ...contract.client.portrait, name: contract.client.name }}
          lines={report.approved ? contract.dialogs.success : contract.dialogs.failure}
          onDone={() => undefined}
        />
      </div>
      <section>
        <h3 className="mb-2 text-xs font-semibold tracking-widest text-slate-400 uppercase">
          {P.sheet}
        </h3>
        <dl
          className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm"
          data-testid="report-sheet"
        >
          {technicalSheet(mission).map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-slate-400">{k}</dt>
              <dd className="font-mono text-slate-100 tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
