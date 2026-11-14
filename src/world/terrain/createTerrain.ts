import { BIOMES } from './biomes';
import { buildTerrain, type TerrainContract, type TerrainSampler } from './TerrainSampler';

const cache = new Map<string, TerrainSampler>();

/** Terreno do contrato, gerado uma vez e memoizado por `contract.id` (terrain §2). */
export function createTerrain(contract: TerrainContract): TerrainSampler {
  const cached = cache.get(contract.id);
  if (cached) return cached;
  const recipe = BIOMES[contract.biome];
  if (!recipe) throw new RangeError(`Bioma sem receita: ${contract.biome}`);
  const terrain = buildTerrain(contract, recipe);
  cache.set(contract.id, terrain);
  return terrain;
}

/** Descarta os terrenos memoizados (testes e novo jogo). */
export function clearTerrainCache(): void {
  cache.clear();
}
