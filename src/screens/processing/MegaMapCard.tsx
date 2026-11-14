import { useEffect, useMemo, useRef } from 'react';
import { getContract } from '@/data/contracts';
import { STRINGS } from '@/data/strings';
import { distortOrtho, megaMapParams } from '@/engines/raster/megaMap';
import { aoiRasterSize, orthoPixels } from '@/engines/raster/orthoPreview';
import { formatNumber } from '@/lib/format';
import { hashString } from '@/lib/rng';
import type { MissionData, QualityReport } from '@/types';
import { createTerrain } from '@/world/terrain/createTerrain';

const P = STRINGS.processing.megamap;
const LONG_SIDE = 192;

/** Comparativo MegaMap (REQ-PRG-011c): a orto deformada, o RMSE que a rival declara e o selo. */
export function MegaMapCard({ report, mission }: { report: QualityReport; mission: MissionData }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contract = getContract(report.contractId);
  const size = useMemo(() => aoiRasterSize(contract.aoi, LONG_SIDE), [contract]);
  const params = useMemo(() => megaMapParams(hashString(mission.id)), [mission.id]);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const src = orthoPixels(createTerrain(contract), size);
    const pixels = distortOrtho(src, size.width, size.height, params, {
      x: contract.aoi.lengthM / size.width,
      y: contract.aoi.widthM / size.height,
    });
    const image = ctx.createImageData(size.width, size.height);
    image.data.set(pixels);
    ctx.putImageData(image, 0, 0);
  }, [contract, size, params]);

  const cmH = (report.rmse.cp ?? report.rmse.gcp).r * 100;
  const cls = report.pec?.planimetric.achieved;
  return (
    <div className="flex flex-col gap-2" data-testid="megamap-card">
      <h3 className="text-xs font-semibold tracking-widest text-slate-400 uppercase">{P.title}</h3>
      <div className="relative w-fit">
        <canvas
          ref={canvasRef}
          width={size.width}
          height={size.height}
          role="img"
          aria-label={P.canvasLabel}
          className="block w-72 rounded-md border border-slate-700"
          style={{ aspectRatio: `${contract.aoi.lengthM} / ${contract.aoi.widthM}` }}
          data-testid="megamap-canvas"
        />
        <span
          className="absolute top-2 right-2 rotate-6 rounded border-2 border-rose-500 bg-slate-950/80 px-2 py-0.5 text-xs font-bold tracking-wider text-rose-400 uppercase"
          data-testid="megamap-stamp"
        >
          {P.failed}
        </span>
      </div>
      <ul className="flex flex-col gap-0.5 text-sm text-slate-200">
        <li className="font-semibold text-slate-100">{P.mapLabel}</li>
        <li data-testid="megamap-declared">{P.declared}</li>
        <li className="text-xs text-slate-400" data-testid="megamap-offset">
          {P.offset(formatNumber(params.offsetM, 1))}
        </li>
        <li className="text-emerald-300" data-testid="megamap-yours">
          {cls ? P.yours(formatNumber(cmH, 1), cls) : P.yoursNoClass(formatNumber(cmH, 1))}
        </li>
      </ul>
    </div>
  );
}
