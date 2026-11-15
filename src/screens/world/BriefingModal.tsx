import { CircleCheck, CircleX } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { getDebugFlags } from '@/app/debugFlags';
import { itemName } from '@/data/catalog';
import { getContract } from '@/data/contracts';
import { SOUVENIRS } from '@/data/souvenirs';
import { STRINGS } from '@/data/strings';
import { REPLAY_FACTOR } from '@/domain/economy';
import { describeUnlock, evaluateUnlock, unlockStateFrom } from '@/domain/progression';
import { counterOfferFor } from '@/domain/rival';
import { formatBRL, formatNumber } from '@/lib/format';
import { selectModifiers } from '@/state/selectors';
import { useGameStore } from '@/state/store';
import type { Contract, UnlockCondition } from '@/types';
import { Button, ChecklistItem, cx, DialogueBox, EmblemBadge, Modal } from '@/ui';
import { CounterOfferModal } from './CounterOfferModal';

const B = STRINGS.briefing;

/** Partes de primeiro nível de uma condição (`ALL` vira uma lista). */
function unlockParts(cond: UnlockCondition): UnlockCondition[] {
  return cond.type === 'ALL' ? [...cond.of] : [cond];
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="text-xs font-semibold tracking-widest text-slate-400 uppercase">{title}</h3>
      {children}
    </section>
  );
}

function Owned({ name, owned }: { name: string; owned: boolean }) {
  const Icon = owned ? CircleCheck : CircleX;
  return (
    <li className="flex items-center gap-2 text-sm text-slate-200">
      <Icon
        size={16}
        strokeWidth={1.75}
        className={owned ? 'text-emerald-400' : 'text-rose-500'}
        aria-label={owned ? B.owned : B.notOwned}
      />
      {name}
    </li>
  );
}

function Conditions({ contract }: { contract: Contract }) {
  const rows: Array<[string, string]> = [
    [B.aoi, B.aoiValue(contract.aoi.widthM, contract.aoi.lengthM)],
    [B.ceiling, B.meters(contract.ceilingM)],
    [B.relief, B.meters(contract.terrainReliefM)],
    [B.lighting, contract.lightingOptions.map((l) => STRINGS.lighting[l]).join(', ')],
    [
      B.wind,
      B.windValue(
        formatNumber(contract.wind.meanMs, 0),
        formatNumber(contract.wind.gustMs, 0),
        contract.wind.directionDeg,
      ),
    ],
  ];
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-slate-400">{k}</dt>
          <dd className="font-mono text-slate-100 tabular-nums">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export interface BriefingModalProps {
  contractId: string;
  onClose: () => void;
}

/**
 * Briefing do contrato (world-map §5.4, REQ-WLD-005, REQ-WLD-008): cliente, diálogo e
 * objetivo à esquerda; requisitos, condições, equipamento e recompensa à direita.
 */
export function BriefingModal({ contractId, onClose }: BriefingModalProps) {
  const contract = getContract(contractId);
  const progress = useGameStore((s) => s.contracts[contractId]);
  const inventory = useGameStore((s) => s.inventory);
  const player = useGameStore((s) => s.player);
  const contracts = useGameStore((s) => s.contracts);
  const pending = useGameStore((s) => s.mission.pending.some((m) => m.contractId === contractId));

  const status = progress?.status ?? 'LOCKED';
  const replay = status === 'COMPLETED';
  const firstTime = (progress?.completions ?? 0) === 0;
  const unlock = unlockStateFrom({ contracts, player, inventory });
  const canAccept = (status === 'AVAILABLE' || replay) && !pending;
  const souvenir = SOUVENIRS.find((sv) => sv.id === contract.souvenirId);
  const payment = Math.round(contract.basePaymentBRL * (replay ? REPLAY_FACTOR : 1));
  const owns = new Set<string>([
    ...inventory.aircraft,
    ...inventory.sensors,
    ...inventory.payloads,
    ...inventory.vehicles,
  ]);

  const [counterOffer, setCounterOffer] = useState(false);
  const start = (rivalAdjustment: number) => {
    const { startMission, goTo } = useGameStore.getState();
    startMission(contractId, rivalAdjustment);
    goTo('FIELD_SETUP', { contractId, rivalAdjustment });
  };
  const accept = () => {
    const state = useGameStore.getState();
    // A MegaMap pode fazer uma contraproposta (20 % × `rivalChance`), nunca em replay.
    const offered = counterOfferFor({
      globalSeed: getDebugFlags().seed ?? state.createdAt,
      contractId,
      // Cada aceite tem o seu sorteio: contam os contratos concluídos e o histórico da rival.
      salt: state.stats.contractsCompleted + state.rival.history.length,
      rivalChanceMod: selectModifiers(state).rivalChance,
      isReplay: replay,
    });
    if (offered) setCounterOffer(true);
    else start(1);
  };

  const footer = (
    <>
      <Button variant="ghost" glyph="UI_BACK" onClick={onClose}>
        {B.refuse}
      </Button>
      <Button
        variant="primary"
        disabled={!canAccept}
        onClick={accept}
        data-testid="briefing-accept"
      >
        {replay ? B.replay : B.accept}
      </Button>
    </>
  );

  // A contraproposta toma o lugar do briefing até o jogador decidir.
  if (counterOffer) {
    return (
      <CounterOfferModal
        contractId={contractId}
        client={{ ...contract.client.portrait, name: contract.client.name }}
        onResolve={start}
      />
    );
  }

  return (
    <Modal open title={contract.title} onClose={onClose} size="lg" footer={footer}>
      <div className="grid gap-6 md:grid-cols-2" data-testid="briefing" data-status={status}>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <EmblemBadge emblem={contract.client.portrait} size={48} title={contract.client.name} />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-100">{contract.client.name}</p>
              <p className="text-xs text-slate-400">{contract.client.role}</p>
            </div>
          </div>
          <DialogueBox
            speaker={{ ...contract.client.portrait, name: contract.client.name }}
            lines={contract.dialogs.briefing}
            onDone={() => undefined}
          />
          <Section title={B.objective}>
            <p className="text-sm text-slate-200">{contract.objective}</p>
          </Section>
          {status === 'LOCKED' && (
            <Section title={B.locked}>
              <ul data-testid="briefing-unlock">
                {unlockParts(contract.unlock).map((cond, i) => (
                  <ChecklistItem
                    key={i}
                    status={evaluateUnlock(cond, unlock) ? 'pass' : 'fail'}
                    label={describeUnlock(cond, itemName)}
                  />
                ))}
              </ul>
            </Section>
          )}
          {status === 'STOLEN' && (
            <p className="rounded-md border border-rose-500/60 bg-rose-500/10 p-3 text-sm text-rose-200">
              {B.stolen}
            </p>
          )}
          {pending && (
            <p className="rounded-md border border-amber-400/60 bg-amber-400/10 p-3 text-sm text-amber-200">
              {B.pending}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <Section title={B.requirements}>
            <ul data-testid="briefing-requirements">
              {contract.requirements.map((r) => (
                <ChecklistItem key={r.id} status="pending" label={r.label} severity={r.severity} />
              ))}
            </ul>
          </Section>
          <Section title={B.conditions}>
            <Conditions contract={contract} />
          </Section>
          <Section title={B.recommended}>
            <ul className="flex flex-col gap-1" data-testid="briefing-recommended">
              {[
                ...contract.recommended.aircraft,
                ...contract.recommended.sensors,
                contract.recommended.vehicle,
              ].map((id) => (
                <Owned key={id} name={itemName(id)} owned={owns.has(id)} />
              ))}
            </ul>
            {contract.recommended.notes && (
              <p className="text-xs text-slate-400 italic">{contract.recommended.notes}</p>
            )}
          </Section>
          <Section title={B.reward}>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-slate-400">{B.payment}</dt>
              <dd
                className={cx('font-mono text-lime-300 tabular-nums')}
                data-testid="briefing-payment"
              >
                {replay ? B.replayPayment(formatBRL(payment)) : formatBRL(payment)}
              </dd>
              <dt className="text-slate-400">{B.xp}</dt>
              <dd className="font-mono text-slate-100 tabular-nums">{contract.xp}</dd>
              {firstTime && souvenir && (
                <>
                  <dt className="text-slate-400">{B.souvenir}</dt>
                  <dd className="text-slate-100" data-testid="briefing-souvenir">
                    {souvenir.name}
                  </dd>
                </>
              )}
            </dl>
          </Section>
        </div>
      </div>
    </Modal>
  );
}
