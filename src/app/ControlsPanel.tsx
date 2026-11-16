import { STRINGS } from '@/data/strings';
import { InputGlyph, useActiveDevice } from '@/input/InputGlyph';

const P = STRINGS.pause;

type Row = keyof typeof P.controlRows;

/** As ações que o jogador usa, na ordem de uma partida: mover, agir e navegar. */
const ROWS: readonly Row[] = [
  'MOVE',
  'LOOK',
  'ZOOM',
  'ALT_UP',
  'ALT_DOWN',
  'INTERACT',
  'FIRE',
  'TOGGLE_SENSOR',
  'RTH',
  'TOGGLE_DIMENSION',
  'CYCLE_VEHICLE',
  'TIME_WARP',
  'UI_CONFIRM',
  'UI_BACK',
  'UI_TAB_PREV',
  'UI_TAB_NEXT',
  'PAUSE',
];

/** Tabela de controles: cada ação com o glyph do dispositivo ativo (REQ-INP-004). */
export function ControlsPanel() {
  const device = useActiveDevice();
  return (
    <div className="flex flex-col gap-3" data-testid="controls-panel">
      <p className="text-xs text-slate-400" data-testid="controls-device">
        {P.controlsDevice(P.devices[device])}
      </p>
      <ul className="flex flex-col divide-y divide-slate-800">
        {ROWS.map((action) => (
          <li key={action} className="flex items-center justify-between gap-3 py-1.5 text-sm">
            <span className="text-slate-200">{P.controlRows[action]}</span>
            <InputGlyph action={action} />
          </li>
        ))}
      </ul>
    </div>
  );
}
