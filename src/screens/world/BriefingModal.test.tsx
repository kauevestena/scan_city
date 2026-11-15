import { fireEvent, render, screen, within } from '@testing-library/react';
import { createDebugMission } from '@/app/debugFixtures';
import type { Contract, ContractStatus } from '@/types';
import { resetGameStore } from '@/test/resetStore';

// Um segundo contrato com condições compostas, para o estado bloqueado.
vi.mock('@/data/contracts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/contracts')>();
  const C01: Contract = {
    ...actual.C00,
    id: 'C01',
    title: 'Metrópole Vertical',
    overworldMarker: '1',
    recommended: { ...actual.C00.recommended, aircraft: ['DRONE_T1'], notes: 'Voe alto!' },
    specialRules: ['URBAN_CANYON_RTK_LOSS', 'COLLECTIBLE_RINGS'],
    unlock: {
      type: 'ALL',
      of: [
        { type: 'CONTRACT_DONE', contractId: 'C00' },
        { type: 'REPUTATION', min: 30 },
        { type: 'OWNS', itemId: 'COMPACT_CAR' },
      ],
    },
  };
  const CONTRACTS = [actual.C00, C01];
  return {
    ...actual,
    CONTRACTS,
    getContract: (id: string) => CONTRACTS.find((c) => c.id === id) ?? actual.getContract(id),
  };
});

const { useGameStore } = await import('@/state/store');
const { BriefingModal } = await import('./BriefingModal');
const get = () => useGameStore.getState();

function setStatus(id: string, status: ContractStatus, completions = 0) {
  useGameStore.setState((s) => ({
    contracts: { ...s.contracts, [id]: { status, completions, bestScore: 0 } },
  }));
}

function open(id = 'C00') {
  const onClose = vi.fn();
  render(<BriefingModal contractId={id} onClose={onClose} />);
  return {
    onClose,
    dialog: screen.getByRole('dialog', {
      name: id === 'C00' ? 'Sítio do Avô' : 'Metrópole Vertical',
    }),
  };
}

beforeEach(() => {
  resetGameStore();
  get().goTo('WORLD_MAP');
});

describe('BriefingModal', () => {
  it('disponível: cliente, diálogo, 6 requisitos, condições, equipamento, recompensa; Aceitar leva ao campo', () => {
    const { dialog } = open();
    const d = within(dialog);
    // Nome no cabeçalho do cliente e na caixa de diálogo.
    expect(d.getAllByText('Seu Zé Bento')).toHaveLength(2);
    expect(d.getByText('Caseiro do sítio')).toBeInTheDocument();
    expect(d.getByRole('button', { name: 'Avançar diálogo' })).toHaveFocus();
    expect(d.getByText(/Levantamento planialtimétrico/)).toBeInTheDocument();
    const reqs = within(d.getByTestId('briefing-requirements')).getAllByRole('listitem');
    expect(reqs).toHaveLength(6);
    expect(reqs[0]).toHaveTextContent('Cobertura verde ≥ 70 %');
    expect(d.getByText('160 × 240 m')).toBeInTheDocument();
    expect(d.getByText('Sol alto, Nublado')).toBeInTheDocument();
    expect(d.getByText('2 m/s, rajadas de +1 m/s, de 90°')).toBeInTheDocument();
    const recommended = d.getByTestId('briefing-recommended');
    expect(within(recommended).getAllByLabelText('Possuído')).toHaveLength(3);
    expect(d.getByTestId('briefing-payment').textContent?.replace(/\s/g, ' ')).toBe('R$ 2.500,00');
    expect(d.getByTestId('briefing-souvenir')).toHaveTextContent(/Caderneta/);

    const accept = d.getByRole('button', { name: 'Aceitar' });
    expect(accept).toBeEnabled();
    fireEvent.click(accept);
    expect(get().session.screen).toBe('FIELD_SETUP');
    expect(get().session.payload).toEqual({ contractId: 'C00', rivalAdjustment: 1 });
    expect(get().mission.active).toMatchObject({
      contractId: 'C00',
      status: 'PLANNING',
      isReplay: false,
    });
  });

  it('o diálogo de briefing pode ser pulado e avançado', () => {
    const { dialog } = open();
    const next = within(dialog).getByRole('button', { name: 'Avançar diálogo' });
    fireEvent.click(next);
    expect(within(dialog).getByTestId('dialogue-text')).toHaveTextContent(
      'Seu avô mediu essas cercas com teodolito e paciência.',
    );
    fireEvent.click(next);
    fireEvent.click(next);
    expect(within(dialog).getByTestId('dialogue-text')).toHaveTextContent(
      'Agora é sua vez — e com um pombo, quem diria!',
    );
  });

  it('bloqueado: lista as condições (✓/✗) e não deixa aceitar', () => {
    const { dialog } = open('C01');
    const d = within(dialog);
    expect(d.getByTestId('briefing')).toHaveAttribute('data-status', 'LOCKED');
    const items = within(d.getByTestId('briefing-unlock')).getAllByRole('listitem');
    expect(items.map((li) => [li.textContent, li.getAttribute('data-status')])).toEqual([
      ['Não atendido:concluir o contrato C00', 'fail'],
      ['Atendido:reputação 30', 'pass'],
      ['Não atendido:possuir Carro Compacto', 'fail'],
    ]);
    expect(d.getByRole('button', { name: 'Aceitar' })).toBeDisabled();
    // Equipamento recomendado que falta aparece marcado, e a nota do cliente aparece.
    expect(
      within(d.getByTestId('briefing-recommended')).getAllByLabelText('Não possuído'),
    ).toHaveLength(1);
    expect(d.getByText('Voe alto!')).toBeInTheDocument();
  });

  it('roubado: avisa da MegaMap e não deixa aceitar', () => {
    setStatus('C00', 'STOLEN');
    const { dialog } = open();
    expect(within(dialog).getByText(/fechou com a MegaMap/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Aceitar' })).toBeDisabled();
  });

  it('concluído: repetição a 40 %, sem souvenir; aceitar cria missão de replay', () => {
    setStatus('C00', 'COMPLETED', 1);
    const { dialog } = open();
    const d = within(dialog);
    expect(d.getByTestId('briefing-payment').textContent?.replace(/\s/g, ' ')).toBe(
      'R$ 1.000,00 (repetição: 40 %)',
    );
    expect(d.queryByTestId('briefing-souvenir')).not.toBeInTheDocument();
    fireEvent.click(d.getByRole('button', { name: /^Repetir/ }));
    expect(get().mission.active?.isReplay).toBe(true);
    expect(get().session.screen).toBe('FIELD_SETUP');
  });

  it('com dados pendentes do mesmo contrato, avisa e não deixa aceitar; Recusar fecha', () => {
    useGameStore.setState((s) => ({
      mission: { ...s.mission, pending: [createDebugMission('C00', true)] },
    }));
    const { dialog, onClose } = open();
    expect(within(dialog).getByText(/aguardam processamento/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Aceitar' })).toBeDisabled();
    fireEvent.click(within(dialog).getByRole('button', { name: /Recusar/ }));
    expect(onClose).toHaveBeenCalled();
  });

  it('regras especiais: ícone, nome e descrição de cada uma; sem regras, a seção não aparece', () => {
    const { dialog } = open('C01');
    const rules = within(within(dialog).getByTestId('briefing-rules')).getAllByRole('listitem');
    expect(rules.map((li) => li.getAttribute('data-rule'))).toEqual([
      'URBAN_CANYON_RTK_LOSS',
      'COLLECTIBLE_RINGS',
    ]);
    expect(rules[0]).toHaveTextContent('Cânions urbanos');
    expect(rules[0]).toHaveTextContent('o RTK cai para FLOAT');
    expect(rules[1]).toHaveTextContent('Anéis coletáveis');
    expect(rules[1]).toHaveTextContent('R$ 50 extras');
    // O ícone vem do registro (não o de reserva) e é um SVG.
    expect(
      within(rules[0] as HTMLElement)
        .getByTestId('rule-icon-URBAN_CANYON_RTK_LOSS')
        .querySelector('svg'),
    ).not.toBeNull();
    expect(within(dialog).getByText('Regras especiais')).toBeInTheDocument();
  });

  it('C00 não tem regras: sem a seção "Regras especiais"', () => {
    const { dialog } = open();
    expect(within(dialog).queryByTestId('briefing-rules')).not.toBeInTheDocument();
    expect(within(dialog).queryByText('Regras especiais')).not.toBeInTheDocument();
  });
});
