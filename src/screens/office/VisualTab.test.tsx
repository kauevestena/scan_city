import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { TopBar } from '@/app/TopBar';
import { brl } from '@/data/catalog/money';
import { EMBLEM_PALETTE } from '@/data/cosmetics';
import { C00 } from '@/data/contracts';
import { saveFromGameData, gameDataFromSave } from '@/state/initialState';
import { serializeSave, validateSave } from '@/state/persistence';
import { useGameStore } from '@/state/store';
import { syntheticMission } from '@/test/fixtures/syntheticMission';
import { resetGameStore } from '@/test/resetStore';
import { createTerrain } from '@/world/terrain/createTerrain';
import { evaluateForState } from '../processing/evaluate';
import { ReportSummary } from '../processing/ReportSummary';
import { CareerPanel } from './CareerPanel';
import { OfficeScreen } from './OfficeScreen';

const get = () => useGameStore.getState();
const setMoney = (cents: number) =>
  act(() => useGameStore.setState((s) => ({ player: { ...s.player, money: cents } })));
const card = (id: string) => screen.getByTestId(`shop-item-${id}`);

function openVisual() {
  render(
    <>
      <TopBar />
      <CareerPanel onClose={() => undefined} />
    </>,
  );
  fireEvent.click(screen.getByRole('tab', { name: 'Visual' }));
}

beforeEach(() => resetGameStore());

describe('aba Visual — skins do personagem', () => {
  it('lista as skins: a do colete equipada, as pagas à venda e as bloqueadas com o motivo', () => {
    openVisual();
    expect(card('CHAR_VEST')).toHaveAttribute('data-state', 'OWNED');
    expect(within(card('CHAR_VEST')).getByRole('button', { name: 'Equipado' })).toBeDisabled();
    expect(card('CHAR_LABCOAT')).toHaveAttribute('data-state', 'BUY');
    expect(card('CHAR_UNIFORM')).toHaveAttribute('data-state', 'LOCKED');
    expect(within(card('CHAR_UNIFORM')).getByTestId('locked-reason')).toHaveTextContent('nível 3');
    expect(card('CHAR_GRANDPA_HAT')).toHaveAttribute('data-state', 'LOCKED');
  });

  it('comprar e equipar o jaleco: a skin equipada muda (é a que o avatar do mapa usa)', () => {
    openVisual();
    setMoney(brl(2_000));
    fireEvent.click(within(card('CHAR_LABCOAT')).getByRole('button', { name: 'Comprar' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Comprar' }));
    expect(get().player.money).toBe(brl(1_200));
    fireEvent.click(within(card('CHAR_LABCOAT')).getByRole('button', { name: 'Equipar' }));
    expect(get().inventory.equipped.character).toBe('CHAR_LABCOAT');
  });
});

describe('editor de emblema', () => {
  const editor = () => screen.getByTestId('emblem-editor');
  const preview = () => within(screen.getByTestId('emblem-preview')).getByRole('img');
  const topBarBadge = () =>
    within(screen.getByTestId('top-bar')).getByRole('img', { name: 'GeoSurvey' });

  it('forma, ícone e cores mudam a pré-visualização e a TopBar ao vivo', () => {
    openVisual();
    expect(preview()).toHaveAttribute('data-shape', 'SHIELD');
    fireEvent.click(within(editor()).getByRole('button', { name: 'Hexágono' }));
    expect(get().inventory.emblem.shape).toBe('HEXAGON');
    expect(preview()).toHaveAttribute('data-shape', 'HEXAGON');
    expect(topBarBadge()).toHaveAttribute('data-shape', 'HEXAGON');
    expect(within(editor()).getByRole('button', { name: 'Hexágono' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    fireEvent.click(within(editor()).getByRole('button', { name: 'Montanha' }));
    expect(get().inventory.emblem.icon).toBe('Mountain');

    const other = EMBLEM_PALETTE.find((c) => c !== get().inventory.emblem.primary) as string;
    fireEvent.click(screen.getByRole('button', { name: `Cor principal: ${other}` }));
    expect(get().inventory.emblem.primary).toBe(other);
    const second = EMBLEM_PALETTE.find((c) => c !== get().inventory.emblem.secondary) as string;
    fireEvent.click(screen.getByRole('button', { name: `Cor secundária: ${second}` }));
    expect(get().inventory.emblem.secondary).toBe(second);
  });

  it('a sigla é validada: maiúsculas, no máximo 4, sem símbolos', () => {
    openVisual();
    const input = screen.getByRole('textbox', { name: /Sigla/ });
    expect(input).toHaveValue('GS');
    expect(input).toHaveAttribute('maxlength', '4');
    fireEvent.change(input, { target: { value: 'scan!city' } });
    expect(input).toHaveValue('SCAN');
    expect(get().inventory.emblem.initials).toBe('SCAN');
    expect(topBarBadge()).toHaveTextContent('SCAN');
  });

  it('sigla vazia fica inválida na tela e não é gravada', () => {
    openVisual();
    const input = screen.getByRole('textbox', { name: /Sigla/ });
    fireEvent.change(input, { target: { value: '' } });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(get().inventory.emblem.initials).toBe('GS');
    fireEvent.change(input, { target: { value: 'x' } });
    expect(input).toHaveAttribute('aria-invalid', 'false');
    expect(get().inventory.emblem.initials).toBe('X');
  });

  it('a store também recusa siglas inválidas (mantém a anterior)', () => {
    get().setEmblem({ ...get().inventory.emblem, initials: '' });
    expect(get().inventory.emblem.initials).toBe('GS');
    get().setEmblem({ ...get().inventory.emblem, initials: 'ab-cdef' });
    expect(get().inventory.emblem.initials).toBe('ABCD');
  });

  it('o emblema persiste: vai para o save e volta igual', () => {
    get().setEmblem({
      shape: 'DIAMOND',
      icon: 'Globe',
      primary: EMBLEM_PALETTE[2] as string,
      secondary: EMBLEM_PALETTE[0] as string,
      initials: 'sc',
    });
    const save = saveFromGameData(get());
    expect(validateSave(save)).toBe(true);
    const back = gameDataFromSave(JSON.parse(serializeSave(save)));
    expect(back.inventory.emblem).toEqual({
      shape: 'DIAMOND',
      icon: 'Globe',
      primary: EMBLEM_PALETTE[2],
      secondary: EMBLEM_PALETTE[0],
      initials: 'SC',
    });
  });
});

describe('o emblema aparece no escritório e no relatório', () => {
  it('escritório: a placa da parede usa o emblema do jogador', () => {
    get().setFlags({ introSeen: true });
    get().setEmblem({ ...get().inventory.emblem, shape: 'CIRCLE', initials: 'ZZ' });
    render(<OfficeScreen />);
    const badge = within(screen.getByTestId('office-emblem')).getByRole('img');
    expect(badge).toHaveAttribute('data-shape', 'CIRCLE');
    expect(badge).toHaveTextContent('ZZ');
  });

  it('relatório: o resumo traz o emblema da empresa', () => {
    get().setEmblem({ ...get().inventory.emblem, shape: 'HEXAGON', initials: 'RL' });
    const mission = {
      ...syntheticMission(C00, createTerrain(C00)),
      status: 'PENDING_PROCESSING' as const,
    };
    const report = evaluateForState(get(), mission, false);
    render(<ReportSummary report={report} mission={mission} />);
    const badge = within(screen.getByTestId('report-emblem')).getByRole('img');
    expect(badge).toHaveAttribute('data-shape', 'HEXAGON');
    expect(badge).toHaveTextContent('RL');
  });
});
