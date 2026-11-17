import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { getContract } from '@/data/contracts';
import { STRINGS } from '@/data/strings';
import { rasterCanvas } from '@/engines/raster/orthoPreview';
import { formatNumber, formatPct } from '@/lib/format';
import type { MissionData, QualityReport, Shot } from '@/types';
import { COLORS, withAlpha } from '@/ui/tokens';
import { cx, FOCUS_RING } from '@/ui';
import { createTerrain } from '@/world/terrain/createTerrain';

const P = STRINGS.processing;
const CANVAS_W = 640;

/** Cor do centro da foto: rejeitada ou borrada em vermelho, fraca em âmbar (§5.6). */
export function centerColor(shot: Pick<Shot, 'blurred' | 'grade'>): string {
  if (shot.blurred || shot.grade === 'REJECTED') return COLORS.danger;
  return shot.grade === 'WEAK' ? COLORS.warn : COLORS.text;
}

/** Cor da célula pelo número de fotos (§5.6). */
export function cellColor(count: number): string {
  if (count >= 5) return withAlpha(COLORS.ok, 0.55);
  if (count >= 3) return withAlpha(COLORS.warn, 0.55);
  return withAlpha(COLORS.danger, 0.55);
}

/** Aba Cobertura: orto em cinza, grade 64 × 64 colorida, água hachurada e centros das fotos. */
export function ReportCoverage({
  report,
  mission,
}: {
  report: QualityReport;
  mission: MissionData;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [centers, setCenters] = useState(false);
  const [hover, setHover] = useState<{ count: number; x: number; y: number } | null>(null);
  const contract = getContract(report.contractId);
  const { aoi } = contract;
  const height = Math.round((CANVAS_W * aoi.widthM) / aoi.lengthM);
  const cov = report.coverage;

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(rasterCanvas(createTerrain(contract), 'GRAY'), 0, 0, CANVAS_W, height);
    const cw = CANVAS_W / cov.cols;
    const ch = height / cov.rows;
    const excluded = new Set(cov.excludedCells);
    for (let j = 0; j < cov.rows; j++) {
      for (let i = 0; i < cov.cols; i++) {
        const k = j * cov.cols + i;
        if (excluded.has(k)) {
          ctx.strokeStyle = withAlpha(COLORS.radarDim, 0.9);
          ctx.beginPath();
          ctx.moveTo(i * cw, (j + 1) * ch);
          ctx.lineTo((i + 1) * cw, j * ch);
          ctx.stroke();
          continue;
        }
        ctx.fillStyle = cellColor(cov.counts[k] ?? 0);
        ctx.fillRect(i * cw, j * ch, cw, ch);
      }
    }
    if (centers) {
      for (const s of mission.shots) {
        ctx.fillStyle = centerColor(s);
        ctx.beginPath();
        ctx.arc((s.u / aoi.lengthM) * CANVAS_W, (s.v / aoi.widthM) * height, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, [contract, cov, centers, mission.shots, height, aoi.lengthM, aoi.widthM]);

  const onMove = (e: MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const i = Math.floor((x / Math.max(1, rect.width)) * cov.cols);
    const j = Math.floor((y / Math.max(1, rect.height)) * cov.rows);
    const count = cov.counts[j * cov.cols + i];
    setHover(count === undefined ? null : { count, x, y });
  };

  const legend: Array<[string, string, number | null]> = [
    ['bg-emerald-400', P.coverageLegend.green, cov.green],
    ['bg-amber-400', P.coverageLegend.yellow, cov.yellow],
    ['bg-rose-500', P.coverageLegend.red, cov.red],
    ['bg-cyan-700', P.coverageLegend.water, null],
  ];

  return (
    <div className="flex flex-col gap-3" data-testid="report-coverage">
      <div className="relative w-fit">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={height}
          role="img"
          aria-label={P.coverageLabel}
          className="block max-w-full rounded-md border border-slate-700"
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
          data-testid="coverage-canvas"
        />
        {hover && (
          <span
            className="pointer-events-none absolute rounded bg-slate-950/90 px-2 py-1 text-xs text-slate-100"
            style={{ left: hover.x + 12, top: hover.y + 12 }}
            data-testid="coverage-tooltip"
          >
            {P.cellTooltip(
              Number.isInteger(hover.count) ? String(hover.count) : formatNumber(hover.count, 1),
            )}
          </span>
        )}
      </div>
      <ul className="flex flex-wrap gap-4 text-sm text-slate-200" data-testid="coverage-legend">
        {legend.map(([cls, text, frac]) => (
          <li key={text} className="flex items-center gap-2">
            <span className={cx('size-3 rounded-sm', cls)} aria-hidden />
            {text}
            {frac !== null && <span className="font-mono tabular-nums">{formatPct(frac, 0)}</span>}
          </li>
        ))}
      </ul>
      <label className="flex w-fit items-center gap-2 text-sm text-slate-200">
        <input
          type="checkbox"
          checked={centers}
          onChange={(e) => setCenters(e.target.checked)}
          className={cx('size-4 accent-cyan-400', FOCUS_RING)}
        />
        {P.showCenters}
      </label>
    </div>
  );
}
