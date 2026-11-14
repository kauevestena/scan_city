/** LiDAR — domain-math §4. */

/** Largura da faixa varrida: 2H·tan(FOV/2). */
export function lidarSwathM(heightM: number, fovRad: number): number {
  return 2 * heightM * Math.tan(fovRad / 2);
}

/** Densidade de pontos por passada (pts/m²): PRR / (v · faixa). */
export function lidarDensity(
  prrHz: number,
  speedMs: number,
  heightM: number,
  fovRad: number,
): number {
  return prrHz / (speedMs * lidarSwathM(heightM, fovRad));
}

/** Densidade média com sobreposição lateral q entre faixas: ρ / (1 − q/100). */
export function lidarDensityWithOverlap(
  prrHz: number,
  speedMs: number,
  heightM: number,
  fovRad: number,
  sideOverlapPct: number,
): number {
  return lidarDensity(prrHz, speedMs, heightM, fovRad) / (1 - sideOverlapPct / 100);
}

/** Probabilidade de um pulso chegar ao solo sob dossel c com n retornos. */
export function groundReturnProbability(canopy: number, maxReturns: number): number {
  return 1 - canopy + canopy * 0.02 * (maxReturns - 1);
}

export function groundDensity(density: number, canopy: number, maxReturns: number): number {
  return density * groundReturnProbability(canopy, maxReturns);
}

/** Fração do solo visível em fotos sob dossel c: precisa aparecer em 2 fotos, (1 − c)². */
export function photoGroundVisibility(canopy: number): number {
  return (1 - canopy) ** 2;
}

/** σ vertical do LiDAR (m), §4.3. `rtkFixFraction` ≥ 0,5 conta como RTK. */
export function lidarRmseZ(
  rangeAccuracyM: number,
  aglM: number,
  imuScore: number,
  lidarNoiseMod: number,
  rtkFixFraction: number,
  emFactor: number,
): number {
  return (
    rangeAccuracyM *
    (1 + aglM / 200) *
    (1 - 0.12 * imuScore) *
    lidarNoiseMod *
    (rtkFixFraction >= 0.5 ? 1 : 1.8) *
    emFactor
  );
}

/** σ planimétrico do LiDAR por eixo (m), §4.3. */
export function lidarRmseXY(aglM: number, rtkFixFraction: number, emFactor: number): number {
  return (0.02 + aglM / 5500) * (rtkFixFraction >= 0.5 ? 1 : 2.5) * emFactor;
}
