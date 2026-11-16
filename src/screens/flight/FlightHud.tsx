import { Heart } from 'lucide-react';
import { STRINGS } from '@/data/strings';
import type { FlightHudSnapshot } from '@/engines/flight/hudPublisher';
import { InputGlyph } from '@/input/InputGlyph';
import { formatDuration, formatNumber, formatPct } from '@/lib/format';
import type { AoiPoint } from '@/types';
import { useGameStore } from '@/state/store';
import { cx, ProgressBar } from '@/ui';

const T = STRINGS.flight;

function Readout({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'bad' }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-[10px] tracking-widest text-slate-400">{label}</span>
      <span
        className={cx(
          'font-mono text-sm tabular-nums',
          tone === 'ok' ? 'text-emerald-300' : tone === 'bad' ? 'text-rose-400' : 'text-slate-100',
        )}
      >
        {value}
      </span>
    </span>
  );
}

function Minimap({ snap }: { snap: FlightHudSnapshot }) {
  const pts: AoiPoint[] = snap.minimap.lines.flat();
  const us = pts.map((p) => p.u);
  const vs = pts.map((p) => p.v);
  const minU = Math.min(...us);
  const minV = Math.min(...vs);
  const w = Math.max(1, Math.max(...us) - minU);
  const h = Math.max(1, Math.max(...vs) - minV);
  const pad = Math.max(w, h) * 0.05;
  return (
    <svg
      role="img"
      aria-label={T.minimap}
      viewBox={`${minU - pad} ${minV - pad} ${w + 2 * pad} ${h + 2 * pad}`}
      className="h-24 w-36 rounded-md border border-slate-700 bg-slate-950/80"
      data-testid="flight-minimap"
    >
      {snap.minimap.lines.map(([a, b], i) => (
        <line
          key={i}
          x1={a.u}
          y1={a.v}
          x2={b.u}
          y2={b.v}
          className="stroke-cyan-400/50"
          strokeWidth={Math.max(w, h) / 120}
        />
      ))}
      {snap.minimap.shots.map((s, i) => (
        <circle key={i} cx={s.u} cy={s.v} r={Math.max(w, h) / 150} className="fill-cyan-200" />
      ))}
      <circle
        cx={snap.minimap.pos.u}
        cy={snap.minimap.pos.v}
        r={Math.max(w, h) / 50}
        className="fill-amber-400"
      />
    </svg>
  );
}

/** HUD do voo (survey-flight §4), lido do snapshot publicado a 10 Hz. */
export function FlightHud({ snap, rift = false }: { snap: FlightHudSnapshot; rift?: boolean }) {
  // Glitch de scanlines da interferência EM; desligado com `reduceFlashes`.
  const reduceFlashes = useGameStore((s) => s.settings.reduceFlashes);
  const glitch = snap.emGlitch && !reduceFlashes;
  const phaseLabel = T.phases[snap.phase];
  // O Atlas voa a milho (papo); os demais, a bateria.
  const energyText =
    snap.energyUnit === 'CORN'
      ? `🌽 × ${snap.cornLeft ?? 0} · ${formatPct(snap.energy, 0)} ${formatDuration(snap.timeLeftS)}`
      : `${formatPct(snap.energy, 0)} ${formatDuration(snap.timeLeftS)}`;
  const deviation = Math.max(-1, Math.min(1, snap.crossTrackM / 20));
  return (
    <div
      className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3"
      data-testid="flight-hud"
      data-glitch={glitch}
      data-rift={rift}
    >
      {rift && (
        // Moldura de fenda: um filete violeta em volta de todo o HUD (contracts-rifts §1).
        <div
          aria-hidden
          className="absolute inset-1 rounded-lg border-2 border-violet-500/70 shadow-[inset_0_0_32px_rgba(139,92,246,0.35)]"
          data-testid="rift-hud-frame"
        />
      )}
      {glitch && (
        <div
          aria-hidden
          data-testid="hud-glitch"
          className="absolute inset-0 animate-pulse opacity-30"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg, rgba(34,211,238,0.35) 0 1px, transparent 1px 4px)',
          }}
        />
      )}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-4 rounded-lg bg-slate-950/70 px-3 py-2 text-sm text-slate-200">
          <span>{snap.aircraftName}</span>
          <span className="text-slate-400">·</span>
          <span>{snap.sensorName}</span>
          <span className="text-slate-400">·</span>
          <span data-testid="hud-rtk">{T.rtk(snap.rtk)}</span>
          {snap.timeScale > 1 && (
            <span className="font-mono font-bold text-amber-400" data-testid="hud-warp">
              {T.warp(snap.timeScale)}
            </span>
          )}
          {snap.rings !== undefined && (
            <span className="font-mono text-amber-300" data-testid="hud-rings">
              {T.rings}: {snap.rings}
            </span>
          )}
          <span className="ml-auto font-mono text-cyan-300" data-testid="hud-line">
            {T.line(snap.lineIndex, snap.nLines)}
          </span>
          <div className="w-40">
            <ProgressBar value={snap.lineProgress} />
          </div>
          <span className="font-mono tabular-nums" data-testid="hud-energy">
            {energyText}
          </span>
        </div>
        {snap.detectedProgress !== undefined && snap.detectedProgress > 0 && (
          <div className="mx-auto flex w-64 items-center gap-2" data-testid="hud-detection">
            <span className="text-[10px] tracking-widest text-rose-300">{T.detection}</span>
            <div className="flex-1">
              <ProgressBar value={snap.detectedProgress} />
            </div>
          </div>
        )}
        <div className="flex items-center justify-center gap-3">
          <span className="text-[10px] tracking-widest text-slate-400">{T.deviation}</span>
          <div className="relative h-2 w-48 rounded-full bg-slate-800">
            <span
              className={cx(
                'absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full',
                snap.outOfLane ? 'bg-amber-400' : 'bg-cyan-400',
              )}
              style={{ left: `${50 + deviation * 50}%` }}
            />
          </div>
          <span className="w-16 font-mono text-xs text-slate-200 tabular-nums">
            {`${snap.crossTrackM >= 0 ? '+' : ''}${formatNumber(snap.crossTrackM, 1)} m`}
          </span>
          <span className="flex gap-0.5" aria-label={T.hull(snap.hull, snap.hullMax)}>
            {Array.from({ length: snap.hullMax }, (_, i) => (
              <Heart
                key={i}
                size={14}
                aria-hidden
                className={i < snap.hull ? 'fill-rose-500 text-rose-500' : 'text-slate-500'}
              />
            ))}
          </span>
        </div>
        <div className="flex flex-col items-center gap-1" role="alert" data-testid="hud-alerts">
          {snap.alerts.map((a) => (
            <span
              key={a.id}
              data-alert={a.id}
              className={cx(
                'rounded-md border px-3 py-1 text-sm font-semibold tracking-wide',
                a.level === 'critical'
                  ? 'border-rose-500 bg-rose-950/80 text-rose-200'
                  : a.level === 'warn'
                    ? 'border-amber-400 bg-amber-950/80 text-amber-200'
                    : 'border-cyan-400 bg-slate-950/80 text-cyan-200',
              )}
            >
              {T.alerts[a.id](a.value)}
            </span>
          ))}
          {snap.rthConfirm && (
            <span
              className="flex items-center gap-2 rounded-md border border-amber-400 bg-slate-950/90 px-3 py-1 text-sm text-amber-100"
              data-testid="hud-rth-confirm"
            >
              {T.rthConfirm}
              <InputGlyph action="RTH" label={T.rthConfirmKeys} />
              <InputGlyph action="PAUSE" label={T.rthCancelKeys} />
            </span>
          )}
          {phaseLabel && (
            <span
              className="font-mono text-xs tracking-widest text-cyan-300"
              data-testid="hud-phase"
            >
              {phaseLabel}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-end gap-6">
          <div className="flex flex-col gap-1 rounded-lg bg-slate-950/70 px-3 py-2">
            <div className="flex gap-4">
              <Readout label={T.alt} value={`${formatNumber(snap.altM, 0)} m`} />
              <Readout label={T.agl} value={`${formatNumber(snap.aglM, 0)} m`} />
            </div>
            <Readout label={T.speed} value={`${formatNumber(snap.speedMs, 1)} m/s`} />
            <div className="flex gap-4">
              <Readout label={T.wind} value={`${formatNumber(snap.windCrossMs, 1)} m/s`} />
              <Readout label={T.crab} value={`${formatNumber(snap.crabDeg, 0)}°`} />
            </div>
          </div>
          <div className="flex flex-col gap-1 rounded-lg bg-slate-950/70 px-3 py-2">
            <Readout
              label={T.gsd}
              value={`${formatNumber(snap.gsdCm, 2)} cm/px`}
              tone={snap.gsdOk ? 'ok' : 'bad'}
            />
            <div className="flex gap-4">
              <Readout
                label="p"
                value={snap.pRealPct === null ? '—' : `${formatNumber(snap.pRealPct, 0)} %`}
              />
              <Readout label="q" value={`${formatNumber(snap.qEstPct, 0)} %`} />
            </div>
          </div>
          <div className="flex flex-col gap-1 rounded-lg bg-slate-950/70 px-3 py-2">
            {/* O contador pulsa a cada foto (a chave reinicia a animação). */}
            <span
              key={snap.photos}
              data-testid="hud-photos"
              className={reduceFlashes ? undefined : 'photo-pulse'}
            >
              <Readout label={T.photos} value={`${snap.photos} / ${snap.photosPlanned}`} />
            </span>
            {snap.lidarDensity !== undefined && (
              <Readout
                label="LiDAR"
                value={`${formatNumber(snap.lidarDensity, 0)} pts/m² · solo ${formatNumber(snap.groundDensity ?? 0, 0)}`}
              />
            )}
            <Readout
              label={T.blur}
              value={`${formatNumber(snap.blurPx, 1)} px`}
              tone={snap.blurPx > 1 ? 'bad' : 'ok'}
            />
          </div>
          <div className="ml-auto">
            <Minimap snap={snap} />
          </div>
        </div>
        <div className="flex justify-center gap-4 text-xs text-slate-300">
          <InputGlyph action="FIRE" label={T.hints.photo} />
          <InputGlyph action="RTH" label={T.hints.rth} />
          <InputGlyph action="TIME_WARP" label={T.hints.warp} />
          <InputGlyph action="PAUSE" label={T.hints.pause} />
        </div>
      </div>
    </div>
  );
}
