import type { CentsBRL } from '@/types';

/** Reais → centavos inteiros (os catálogos guardam preços em centavos). */
export const brl = (reais: number): CentsBRL => Math.round(reais * 100);
