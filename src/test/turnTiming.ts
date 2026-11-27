/**
 * Tempo de simulação que cada curva soma à linha no voo do piloto bom (ADR-035): o portal da
 * curva fica a `TURN_APPROACH_S` (ou a janela inteira) do fim dos dados, além do fim da linha
 * quando o lead-out é curto, e a manobra sai no centro da janela, um pouco antes do portal.
 */
import { DIFFICULTY } from '@/domain/difficulty';
import { windowCenterS } from '@/domain/turnManeuver';
import { TURN_APPROACH_S } from '@/engines/flight/FlightEngine';
import type { FlightPlan } from '@/types';

export function turnExtraS(plan: FlightPlan): number {
  const { tempo, turnWindow } = DIFFICULTY.MEDIUM;
  const v = plan.params.speedMs;
  // O lead-out da linha é igual ao lead-in (`aoiStartS`); os dados fecham em `aoiEndS + B`.
  const leadOutM = plan.lines[0]?.aoiStartS ?? 0;
  const beyondM = Math.max(
    0,
    Math.max(TURN_APPROACH_S, turnWindow.earlyS) * tempo * v - (leadOutM - plan.stats.baseM),
  );
  return beyondM / v - windowCenterS(turnWindow) * tempo;
}
