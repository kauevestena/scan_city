import { useEffect, useMemo, useRef, useState } from 'react';
import { getContract } from '@/data/contracts';
import { STRINGS } from '@/data/strings';
import { hypsometricColor } from '@/engines/raster/orthoPreview';
import {
  NDVI_MAX,
  NDVI_MIN,
  PRODUCT_KINDS,
  PRODUCT_SIZE,
  ProductJob,
  ndviColor,
  type ProductKind,
  type ProductRaster,
} from '@/engines/raster/products';
import { formatNumber } from '@/lib/format';
import type { MissionData, QualityReport } from '@/types';
import { ProgressBar, Tabs, type TabDef } from '@/ui';
import { COLORS } from '@/ui/tokens';
import { createTerrain } from '@/world/terrain/createTerrain';
import type { TerrainSampler } from '@/world/terrain/TerrainSampler';
import { productAvailability, productInputs } from './productModel';

const P = STRINGS.processing.products;
const CANVAS_W = 640;
/** Orçamento de cada fatia de geração, ms (a spec pede fatias < 8 ms). */
export const SLICE_BUDGET_MS = 4;

/** CSS `linear-gradient` a partir de uma função de rampa. */
function gradient(ramp: (t: number) => readonly [number, number, number], stops = 12): string {
  const parts = Array.from({ length: stops + 1 }, (_, k) => {
    const [r, g, b] = ramp(k / stops);
    return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}) ${(k / stops) * 100}%`;
  });
  return `linear-gradient(to right, ${parts.join(', ')})`;
}

const ndviRamp = (t: number) => ndviColor(NDVI_MIN + t * (NDVI_MAX - NDVI_MIN));

function Legend({ raster }: { raster: ProductRaster }) {
  const { kind } = raster;
  const min = formatNumber(raster.range.min, kind === 'NDVI' ? 2 : 1);
  const max = formatNumber(raster.range.max, kind === 'NDVI' ? 2 : 1);
  const hasNoData = raster.noData.some((v) => v === 1);
  const hasHatch = raster.hatched.some((v) => v === 1);
  return (
    <div className="flex flex-col gap-2 text-sm text-slate-200" data-testid="product-legend">
      {(kind === 'DSM' || kind === 'DTM') && (
        <div className="flex flex-col gap-1">
          <div
            className="h-3 w-64 rounded-sm border border-slate-700"
            style={{ backgroundImage: gradient(hypsometricColor) }}
            aria-hidden
          />
          <span className="font-mono text-xs">{P.elevation(min, max)}</span>
        </div>
      )}
      {kind === 'NDVI' && (
        <div className="flex flex-col gap-1">
          <div
            className="h-3 w-64 rounded-sm border border-slate-700"
            style={{ backgroundImage: gradient(ndviRamp) }}
            aria-hidden
          />
          <span className="font-mono text-xs">{P.ndviRange(min, max)}</span>
          {raster.histogram && <Histogram bins={raster.histogram} />}
        </div>
      )}
      <ul className="flex flex-wrap gap-4">
        {hasNoData && (
          <li className="flex items-center gap-2" data-testid="legend-nodata">
            <span
              className="size-3 rounded-sm border border-slate-500"
              style={{
                backgroundImage: `repeating-conic-gradient(${COLORS.textMuted} 0% 25%, ${COLORS.border} 0% 50%)`,
                backgroundSize: '6px 6px',
              }}
              aria-hidden
            />
            {P.legendNoData}
          </li>
        )}
        {hasHatch && (
          <li className="flex items-center gap-2" data-testid="legend-hatched">
            <span
              className="size-3 rounded-sm border border-slate-500"
              style={{
                backgroundImage: `repeating-linear-gradient(45deg, ${COLORS.bgBase} 0 2px, transparent 2px 5px)`,
              }}
              aria-hidden
            />
            {P.legendHatched}
          </li>
        )}
      </ul>
    </div>
  );
}

function Histogram({ bins }: { bins: readonly number[] }) {
  const peak = Math.max(1, ...bins);
  return (
    <div
      role="img"
      aria-label={P.histogram}
      className="flex h-12 w-64 items-end gap-px"
      data-testid="ndvi-histogram"
    >
      {bins.map((n, k) => (
        <span
          key={k}
          className="flex-1 bg-emerald-400/80"
          style={{ height: `${(n / peak) * 100}%` }}
        />
      ))}
    </div>
  );
}

export interface ProductViewerProps {
  report: QualityReport;
  mission: MissionData;
  /** Terreno da AOI; por padrão, o do contrato (testes injetam uma arena). */
  terrain?: TerrainSampler;
  /** Orçamento de cada fatia de geração, ms. */
  sliceBudgetMs?: number;
}

/** Aba Produtos: Ortofoto, MDS, MDT e NDVI, gerados em fatias (processing-results §5.7). */
export function ProductViewer({
  report,
  mission,
  terrain: injected,
  sliceBudgetMs = SLICE_BUDGET_MS,
}: ProductViewerProps) {
  const contract = getContract(report.contractId);
  const terrain = useMemo(() => injected ?? createTerrain(contract), [injected, contract]);
  const availability = useMemo(
    () => productAvailability(mission, report, contract, terrain),
    [mission, report, contract, terrain],
  );
  const tabs = useMemo<ReadonlyArray<TabDef<ProductKind>>>(
    () =>
      PRODUCT_KINDS.map((id) => {
        const a = availability[id];
        return {
          id,
          label: P.kinds[id],
          disabled: !a.available,
          ...(a.reason ? { reason: a.reason } : {}),
        };
      }),
    [availability],
  );
  const firstAvailable = PRODUCT_KINDS.find((k) => availability[k].available) ?? 'ORTHO';
  const [kind, setKind] = useState<ProductKind>(firstAvailable);
  const [raster, setRaster] = useState<ProductRaster | null>(null);
  const [progress, setProgress] = useState(0);
  const cache = useRef(new Map<ProductKind, ProductRaster>());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { aoi } = contract;

  // Gera o raster do produto atual em fatias, uma por frame.
  useEffect(() => {
    if (!availability[kind].available) return;
    const hit = cache.current.get(kind);
    if (hit) {
      setRaster(hit);
      setProgress(1);
      return;
    }
    setRaster(null);
    setProgress(0);
    const job = new ProductJob(kind, productInputs(mission, report, terrain));
    let frame = 0;
    const tick = () => {
      job.runSlice(sliceBudgetMs);
      setProgress(job.progress);
      if (job.done) {
        const done = job.raster;
        cache.current.set(kind, done);
        setRaster(done);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [kind, availability, mission, report, terrain, sliceBudgetMs]);

  // Pinta o raster pronto no canvas de 256 × 256 (o CSS o estica sobre a AOI).
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !raster) return;
    const image = ctx.createImageData(PRODUCT_SIZE, PRODUCT_SIZE);
    image.data.set(raster.rgba);
    ctx.putImageData(image, 0, 0);
  }, [raster]);

  const captured = terrain.features.filter((f) => mission.events.featuresCaptured.includes(f.id));
  const ready = raster !== null && raster.kind === kind;

  return (
    <div className="flex flex-col gap-3" data-testid="report-products">
      <Tabs tabs={tabs} value={kind} onChange={setKind} ariaLabel={P.label} />
      <div className="relative w-fit" style={{ width: CANVAS_W, maxWidth: '100%' }}>
        <canvas
          ref={canvasRef}
          width={PRODUCT_SIZE}
          height={PRODUCT_SIZE}
          role="img"
          aria-label={P.canvasLabel(P.kinds[kind])}
          className="block w-full rounded-md border border-slate-700 [image-rendering:pixelated]"
          style={{ aspectRatio: `${aoi.lengthM} / ${aoi.widthM}`, height: 'auto' }}
          data-testid="product-canvas"
          data-kind={kind}
          data-ready={ready}
        />
        {captured.map((f) => (
          <span
            key={f.id}
            data-testid="product-feature"
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-full"
            style={{ left: `${(f.u / aoi.lengthM) * 100}%`, top: `${(f.v / aoi.widthM) * 100}%` }}
          >
            <span className="flex flex-col items-center">
              <span className="rounded bg-slate-950/90 px-1.5 py-0.5 text-xs whitespace-nowrap text-amber-300">
                {f.name}
              </span>
              <span className="size-2 rotate-45 border border-slate-950 bg-amber-400" aria-hidden />
            </span>
          </span>
        ))}
      </div>
      {!ready && availability[kind].available && (
        <div className="flex w-64 flex-col gap-1" data-testid="product-progress" role="status">
          <span className="text-xs text-slate-300">
            {P.generating(formatNumber(progress * 100, 0))}
          </span>
          <ProgressBar value={progress} />
        </div>
      )}
      {ready && <Legend raster={raster} />}
      {captured.length > 0 && (
        <ul className="text-sm text-amber-200" data-testid="product-features">
          {captured.map((f) => (
            <li key={f.id}>{P.feature(f.name)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
