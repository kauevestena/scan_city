import { useEffect, useState } from 'react';
import { DebugPanel } from './DebugPanel';
import { getDebugFlags } from './debugFlags';

/**
 * Painel de depuração flutuante (architecture §7), aberto com F9 sobre as telas reais. Só existe
 * com `?debug=1`.
 */
export function DebugOverlay() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'F9') return;
      e.preventDefault();
      setOpen((o) => !o);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  if (!getDebugFlags().debug || !open) return null;
  return (
    <div
      className="fixed top-14 left-2 z-[65] max-h-[calc(100vh-4rem)] overflow-y-auto"
      data-testid="debug-overlay"
    >
      <DebugPanel />
    </div>
  );
}
