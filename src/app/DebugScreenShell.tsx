import { Construction } from 'lucide-react';
import { useGameStore } from '@/state/store';
import { DebugCanvasDemo } from './DebugCanvasDemo';
import { DebugPanel } from './DebugPanel';

/**
 * Tela provisória (constitution §4.3): mostra o nome da tela, o payload e os botões
 * das transições válidas. Serve as telas que ainda não têm implementação.
 */
export function DebugScreenShell() {
  const screen = useGameStore((s) => s.session.screen);
  const payload = useGameStore((s) => s.session.payload);
  return (
    <main
      data-testid="debug-screen-shell"
      data-screen={screen}
      className="flex h-full w-full flex-col items-center gap-6 overflow-y-auto bg-slate-950 p-8 text-slate-100"
    >
      <header className="flex flex-col items-center gap-2">
        <Construction size={24} strokeWidth={1.75} className="text-amber-400" aria-hidden />
        <h1 className="text-2xl font-semibold tracking-wide uppercase" data-testid="screen-name">
          {screen}
        </h1>
        <pre className="font-mono text-xs text-slate-400" data-testid="screen-payload">
          {JSON.stringify(payload ?? null)}
        </pre>
      </header>
      <DebugCanvasDemo />
      <DebugPanel />
    </main>
  );
}
