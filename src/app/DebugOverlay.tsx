import { useEffect, useState } from 'react';
import { useGameStore } from '@/state/store';
import { DebugPanel } from './DebugPanel';
import { getDebugFlags } from './debugFlags';
import { SCREEN_COMPONENTS } from './ScreenRouter';

/**
 * Painel de depuração flutuante (architecture §7), aberto com F9 sobre as telas reais.
 * As telas servidas pelo `DebugScreenShell` já mostram o painel embutido.
 */
export function DebugOverlay() {
  const [open, setOpen] = useState(false);
  const screen = useGameStore((s) => s.session.screen);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'F9') return;
      e.preventDefault();
      setOpen((o) => !o);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  if (!getDebugFlags().debug || !open || !SCREEN_COMPONENTS[screen]) return null;
  return (
    <div
      className="fixed top-14 left-2 z-[65] max-h-[calc(100vh-4rem)] overflow-y-auto"
      data-testid="debug-overlay"
    >
      <DebugPanel />
    </div>
  );
}
