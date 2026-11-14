import { useEffect, useState } from 'react';
import { FpsMeter } from '@/engines/loop';
import { formatNumber } from '@/lib/format';
import { useGameStore } from '@/state/store';
import { cx } from '@/ui';
import { getDebugFlags } from './debugFlags';

const PUBLISH_INTERVAL_MS = 500;

/** Mede a cadência real de `requestAnimationFrame` da página e publica a 2 Hz. */
function FpsReadout() {
  const [fps, setFps] = useState(0);

  useEffect(() => {
    const meter = new FpsMeter();
    let lastPublish = 0;
    let handle = requestAnimationFrame(function frame(timeMs) {
      meter.tick(timeMs);
      if (timeMs - lastPublish >= PUBLISH_INTERVAL_MS) {
        lastPublish = timeMs;
        setFps(meter.fps);
      }
      handle = requestAnimationFrame(frame);
    });
    return () => cancelAnimationFrame(handle);
  }, []);

  return (
    <div
      data-testid="fps-overlay"
      className={cx(
        'pointer-events-none fixed bottom-2 left-2 z-[70] rounded-md bg-slate-950/80 px-2 py-1 font-mono text-xs tabular-nums',
        fps >= 55 ? 'text-emerald-400' : fps >= 30 ? 'text-amber-400' : 'text-rose-500',
      )}
    >
      {formatNumber(fps, 0)} FPS
    </div>
  );
}

/** Overlay de FPS, visível com `?debug=1` ou com a configuração `showFps`. */
export function FpsOverlay() {
  const showFps = useGameStore((s) => s.settings.showFps);
  return getDebugFlags().debug || showFps ? <FpsReadout /> : null;
}
