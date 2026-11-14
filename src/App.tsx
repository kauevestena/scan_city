import { Radar } from 'lucide-react';
import { STRINGS } from '@/data/strings';

export function App() {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 overflow-hidden bg-slate-950 text-slate-100 select-none">
      <Radar size={48} strokeWidth={1.75} className="text-cyan-400" aria-hidden />
      <h1 className="text-2xl font-semibold tracking-wide uppercase">{STRINGS.app.title}</h1>
      <p className="text-sm text-slate-400">{STRINGS.app.tagline}</p>
      <p className="font-mono text-xs text-slate-400 tabular-nums" data-testid="app-version">
        {STRINGS.app.version(__APP_VERSION__)}
      </p>
    </div>
  );
}
