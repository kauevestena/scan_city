import type { ReactNode } from 'react';
import { STRINGS } from '@/data/strings';
import { formatNumber, formatPct } from '@/lib/format';
import type { MissionData, QualityReport, RmseSet } from '@/types';
import { MegaMapCard } from './MegaMapCard';
import { cx } from '@/ui';

const P = STRINGS.processing;
const cm = (m: number) => formatNumber(m * 100, 1);

/** "Poucos GCPs (×1,60)", "Geometria dos GCPs (Z ×3,00)" (§5.5). */
export function multiplierText(m: { label: string; xy: number; z: number }): string {
  const fmt = (v: number) => (Math.abs(v - 1) < 1e-9 ? null : formatNumber(v, 2));
  return `${m.label} (${P.multiplierValue(fmt(m.xy), fmt(m.z))})`;
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold tracking-widest text-slate-400 uppercase">{title}</h3>
      {children}
    </section>
  );
}

function RmseRow({ label, rmse }: { label: string; rmse: RmseSet }) {
  return (
    <tr>
      <th className="pr-4 text-left font-normal text-slate-400">{label}</th>
      {[rmse.x, rmse.y, rmse.z, rmse.r].map((v, k) => (
        <td key={k} className="pr-4 text-right font-mono tabular-nums">
          {cm(v)}
        </td>
      ))}
    </tr>
  );
}

export function ReportAccuracy({
  report,
  mission,
}: {
  report: QualityReport;
  mission: MissionData;
}) {
  const { pec, asprs, lens } = report;
  return (
    <div className="grid gap-6 lg:grid-cols-2" data-testid="report-accuracy">
      <div className="flex flex-col gap-6">
        {report.residuals.length === 0 ? (
          <Block title={P.residuals}>
            <p className="text-sm text-slate-300" data-testid="no-points">
              {P.noPoints}
            </p>
          </Block>
        ) : (
          <>
            <Block title={P.residuals}>
              <table className="text-sm text-slate-100" data-testid="residuals">
                <thead>
                  <tr>
                    {P.residualCols.map((c) => (
                      <th key={c} className="pr-4 text-left text-xs font-normal text-slate-400">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.residuals.map((r) => (
                    <tr key={r.pointId} className={cx(r.kind === 'CP' && 'text-amber-200')}>
                      <td className="pr-4 font-mono">{r.pointId}</td>
                      <td className="pr-4">{r.kind}</td>
                      <td className="pr-4 text-right font-mono tabular-nums">{cm(r.dxM)}</td>
                      <td className="pr-4 text-right font-mono tabular-nums">{cm(r.dyM)}</td>
                      <td className="pr-4 text-right font-mono tabular-nums">{cm(r.dzM)}</td>
                      <td className="pr-4 text-right font-mono tabular-nums">
                        {cm(Math.hypot(r.dxM, r.dyM))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Block>
            <Block title="RMSE (cm)">
              <table className="text-sm text-slate-100" data-testid="rmse">
                <thead>
                  <tr>
                    <th />
                    {P.rmseCols.map((c) => (
                      <th key={c} className="pr-4 text-right text-xs font-normal text-slate-400">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <RmseRow label={P.rmseGcp} rmse={report.rmse.gcp} />
                  {report.rmse.cp && <RmseRow label={P.rmseCp} rmse={report.rmse.cp} />}
                </tbody>
              </table>
              {!report.rmse.cp && (
                <p className="text-sm text-amber-300">{STRINGS.accuracy.notVerifiable}</p>
              )}
            </Block>
          </>
        )}
        <Block title={P.multipliers}>
          <ul className="flex flex-col gap-1 text-sm text-slate-200" data-testid="multipliers">
            {report.multipliers.length === 0 && (
              <li className="text-slate-400">{P.noMultipliers}</li>
            )}
            {report.multipliers.map((m) => (
              <li key={m.key}>{multiplierText(m)}</li>
            ))}
          </ul>
        </Block>
      </div>
      <div className="flex flex-col gap-6">
        {lens && (
          <Block title={P.lens}>
            <dl
              className="grid grid-cols-4 gap-x-3 gap-y-1 font-mono text-sm text-slate-100"
              data-testid="lens"
            >
              {(
                [
                  ['f', formatNumber(lens.fPx, 1)],
                  ['cx', formatNumber(lens.cxPx, 1)],
                  ['cy', formatNumber(lens.cyPx, 1)],
                  ['k₁', formatNumber(lens.k1, 4)],
                  ['k₂', formatNumber(lens.k2, 4)],
                  ['p₁', formatNumber(lens.p1, 5)],
                  ['p₂', formatNumber(lens.p2, 5)],
                  [P.reprojError, `${formatNumber(lens.reprojErrorPx, 2)} px`],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-slate-400">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </Block>
        )}
        {pec && (
          <Block title={P.pec}>
            <div className="flex flex-col gap-1 text-sm text-slate-200" data-testid="pec">
              <span>
                {P.pecScale(formatNumber(pec.scaleDenominator, 0))} ·{' '}
                {P.pecRequired(pec.requiredClass)}
              </span>
              {(
                [
                  [P.planimetry, pec.planimetric],
                  ...(pec.altimetric ? ([[P.altimetry, pec.altimetric]] as const) : []),
                ] as const
              ).map(([name, axis]) => (
                <span key={name} className={axis.pass ? 'text-emerald-300' : 'text-rose-300'}>
                  {name}: {P.pecAchieved} {axis.achieved} ·{' '}
                  {P.pecLimits(`${cm(axis.epM)} cm`, `${cm(axis.pecM)} cm`)} ·{' '}
                  {P.pecWithin(formatPct(axis.pct90, 0))}
                </span>
              ))}
            </div>
          </Block>
        )}
        {asprs && (
          <Block title={P.asprs}>
            <div className="flex flex-col gap-1 text-sm" data-testid="asprs">
              <span className={asprs.passH ? 'text-emerald-300' : 'text-rose-300'}>
                {P.asprsH(
                  `${formatNumber(asprs.rmseHcm, 1)} cm`,
                  `${formatNumber(asprs.horizontalCm, 1)} cm`,
                )}
              </span>
              <span className={asprs.passV ? 'text-emerald-300' : 'text-rose-300'}>
                {P.asprsV(
                  `${formatNumber(asprs.rmseVcm, 1)} cm`,
                  `${formatNumber(asprs.verticalCm, 1)} cm`,
                )}
              </span>
            </div>
          </Block>
        )}
        {report.lidarStats && (
          <Block title={P.lidar}>
            <p className="text-sm text-slate-200">
              {P.lidarValue(
                formatNumber(report.lidarStats.meanDensity, 1),
                formatNumber(report.lidarStats.meanGroundDensity, 1),
              )}
            </p>
          </Block>
        )}
        {report.volume && (
          <Block title={P.volume}>
            <p className="text-sm text-slate-200">
              {P.volumeValue(
                formatNumber(report.volume.referenceM3, 0),
                formatNumber(report.volume.measuredM3, 0),
                `${formatNumber(report.volume.errorPct, 1)} %`,
              )}
            </p>
          </Block>
        )}
        <MegaMapCard report={report} mission={mission} />
      </div>
    </div>
  );
}
