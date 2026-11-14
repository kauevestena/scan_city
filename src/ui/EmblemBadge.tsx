import type { Emblem, EmblemShape, PortraitSpec } from '@/types';
import { NamedIcon } from './iconRegistry';

export interface EmblemBadgeProps {
  emblem: Emblem | PortraitSpec;
  /** Lado em px. */
  size?: number;
  title?: string;
}

/** Contornos em uma viewBox de 48 × 48. */
const SHAPE_PATH: Record<EmblemShape, string> = {
  SHIELD: 'M24 3 L43 10 V24 C43 35 34.5 42.5 24 45 C13.5 42.5 5 35 5 24 V10 Z',
  CIRCLE: 'M24 3 A21 21 0 1 1 23.99 3 Z',
  HEXAGON: 'M24 3 L42.2 13.5 V34.5 L24 45 L5.8 34.5 V13.5 Z',
  DIAMOND: 'M24 2 L46 24 L24 46 L2 24 Z',
};

/**
 * Emblema abstrato: forma geométrica + ícone lucide + iniciais em duas cores.
 * É o retrato de empresas e clientes (constitution §6: nunca um desenho de personagem).
 */
export function EmblemBadge({ emblem, size = 48, title }: EmblemBadgeProps) {
  const showInitials = size >= 32 && emblem.initials.length > 0;
  const iconSize = Math.round(size * (showInitials ? 0.36 : 0.5));
  return (
    <span
      role="img"
      aria-label={title ?? emblem.initials}
      data-shape={emblem.shape}
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size, color: emblem.primary }}
    >
      <svg viewBox="0 0 48 48" className="absolute inset-0 h-full w-full" aria-hidden>
        <path
          d={SHAPE_PATH[emblem.shape]}
          fill={emblem.secondary}
          stroke={emblem.primary}
          strokeWidth={2}
          strokeLinejoin="round"
        />
      </svg>
      <span className="relative flex flex-col items-center leading-none">
        <NamedIcon name={emblem.icon} size={iconSize} strokeWidth={1.75} aria-hidden />
        {showInitials && (
          <span
            className="font-mono font-bold tracking-tight"
            style={{ fontSize: Math.max(8, Math.round(size * 0.2)) }}
          >
            {emblem.initials}
          </span>
        )}
      </span>
    </span>
  );
}
