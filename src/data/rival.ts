import type { PortraitSpec } from '@/types';

/**
 * Emblema da rival MegaMap (progression §8). As cores hex são exceção permitida, como nos
 * retratos dos clientes: são dados, não estilo de componente.
 */
export const MEGAMAP: PortraitSpec & { name: string } = {
  name: 'MegaMap',
  shape: 'HEXAGON',
  icon: 'Map',
  primary: '#e11d48',
  secondary: '#0f172a',
  initials: 'MM',
};
