import {
  Bird,
  CircleHelp,
  Compass,
  Globe,
  Map as MapIcon,
  Mountain,
  Plane,
  Ruler,
  Satellite,
  type LucideIcon,
  type LucideProps,
} from 'lucide-react';
import { createElement } from 'react';
import type { EmblemIcon } from '@/types';

/**
 * Ícones referenciados **por nome** nos dados (emblemas, retratos, souvenirs).
 * O registro é explícito para o bundler incluir só os ícones usados.
 */
const REGISTRY: Record<string, LucideIcon> = {
  Bird,
  Compass,
  Globe,
  Map: MapIcon,
  Mountain,
  Plane,
  Ruler,
  Satellite,
} satisfies Record<EmblemIcon, LucideIcon>;

export const FALLBACK_ICON: LucideIcon = CircleHelp;

export function hasIcon(name: string): boolean {
  return Object.hasOwn(REGISTRY, name);
}

/** Resolve um nome lucide vindo dos dados; nomes fora do registro usam o ícone de reserva. */
export function iconByName(name: string): LucideIcon {
  return REGISTRY[name] ?? FALLBACK_ICON;
}

/** Renderiza um ícone pelo nome usado nos dados. */
export function NamedIcon({ name, ...props }: LucideProps & { name: string }) {
  return createElement(iconByName(name), props);
}

/** Acrescenta ícones ao registro (arquivos de dados registram os que usam). */
export function registerIcons(icons: Record<string, LucideIcon>): void {
  Object.assign(REGISTRY, icons);
}
