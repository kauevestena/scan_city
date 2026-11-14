import { useSyncExternalStore } from 'react';
import { cx } from '@/ui/classes';
import type { InputDevice } from './actions';
import { glyphFor, type GlyphAction, type GlyphShape, type GlyphTone } from './glyphs';
import { InputManager } from './InputManager';

export interface InputGlyphProps {
  action: GlyphAction;
  label?: string;
  /** Força um dispositivo (galeria); por padrão, o último usado. */
  device?: InputDevice;
}

const SHAPE: Record<GlyphShape, string> = {
  key: 'min-w-6 h-6 px-1.5 rounded-md border border-slate-500 border-b-2 bg-slate-800 text-slate-100',
  face: 'w-6 h-6 rounded-full text-slate-950 font-bold',
  pill: 'h-6 px-2 rounded-full border border-slate-500 bg-slate-800 text-slate-100',
  stick: 'w-6 h-6 rounded-full border-2 border-slate-400 bg-slate-800 text-slate-100',
  dpad: 'w-6 h-6 rounded-sm border border-slate-500 bg-slate-800 text-slate-100',
};

const TONE: Record<GlyphTone, string> = {
  green: 'bg-emerald-400',
  red: 'bg-rose-500',
  blue: 'bg-sky-400',
  yellow: 'bg-amber-400',
  pink: 'bg-pink-400',
};

export function useActiveDevice(): InputDevice {
  const manager = InputManager.get();
  return useSyncExternalStore(
    (fn) => manager.subscribe(fn),
    () => manager.activeDevice,
  );
}

/** Ícone do botão da ação no dispositivo ativo; troca em tempo real (REQ-INP-004). */
export function InputGlyph({ action, label, device }: InputGlyphProps) {
  const active = useActiveDevice();
  const spec = glyphFor(action, device ?? active);
  return (
    <span className="inline-flex items-center gap-1.5" data-glyph-action={action}>
      <kbd
        data-glyph-shape={spec.shape}
        className={cx(
          'inline-flex shrink-0 items-center justify-center font-mono leading-none whitespace-nowrap',
          spec.shape === 'face' ? 'text-[13px]' : 'text-[11px]',
          SHAPE[spec.shape],
          spec.tone && TONE[spec.tone],
        )}
      >
        {spec.label}
      </kbd>
      {label && <span className="text-xs text-slate-300">{label}</span>}
    </span>
  );
}
