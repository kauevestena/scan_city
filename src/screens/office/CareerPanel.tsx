import { Award, Check, Lock, Palette, Sparkles, UserRound, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { STRINGS } from '@/data/strings';
import { reputationBand } from '@/domain/progression';
import { xpToNext } from '@/domain/progression';
import { useFocusNavigation } from '@/input/useFocusNavigation';
import { formatDuration, formatNumber } from '@/lib/format';
import { useGameStore } from '@/state/store';
import { Button, ConfirmDialog, cx, Panel, ProgressBar, Stat, Tabs } from '@/ui';
import { SKILL_BRANCHES, branchNodes, skillView, type SkillView } from './skillTreeModel';
import { VisualTab } from './VisualTab';

const C = STRINGS.office.career;
type CareerTab = 'SKILLS' | 'PROFILE' | 'VISUAL';

function SkillNodeCard({ view, onAcquire }: { view: SkillView; onAcquire: () => void }) {
  const { node, state } = view;
  const reduceFlashes = useGameStore((s) => s.settings.reduceFlashes);
  return (
    <li
      data-testid={`skill-${node.id}`}
      data-state={state}
      className={cx(
        'flex flex-col gap-1 rounded-md border bg-slate-800 p-2',
        state === 'ACQUIRED' && 'border-emerald-500/50',
        state === 'AVAILABLE' && 'border-cyan-400',
        state === 'AVAILABLE' && !reduceFlashes && 'animate-pulse',
        state === 'LOCKED' && 'border-slate-700 opacity-70',
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <span className="text-sm font-semibold text-slate-100">{node.name}</span>
        {state === 'ACQUIRED' && (
          <Check size={14} className="text-emerald-300" aria-label={C.states.ACQUIRED} />
        )}
        {state === 'LOCKED' && (
          <Lock size={14} className="text-slate-500" aria-label={C.states.LOCKED} />
        )}
      </div>
      <p className="text-xs text-slate-400">{node.description}</p>
      <p className="font-mono text-xs text-slate-300">{C.cost(node.cost)}</p>
      {view.reason && (
        <p className="text-xs text-slate-400" data-testid="skill-reason">
          {view.reason}
        </p>
      )}
      {state === 'AVAILABLE' && (
        <Button
          size="sm"
          variant="primary"
          icon={Sparkles}
          data-focus-id={`skill-${node.id}`}
          onClick={onAcquire}
        >
          {C.acquire}
        </Button>
      )}
    </li>
  );
}

function SkillsTab() {
  const skillPoints = useGameStore((s) => s.player.skillPoints);
  const owned = useGameStore((s) => s.skills);
  const [pending, setPending] = useState<string | null>(null);
  const pendingNode = SKILL_BRANCHES.flatMap(branchNodes).find((n) => n.id === pending);
  return (
    <div className="mt-3 flex flex-col gap-3" data-testid="skills-tab">
      <p className="font-mono text-sm text-cyan-300" data-testid="skill-points">
        {C.points(skillPoints)}
      </p>
      {/* 3 colunas × 4 nós: um ramo por coluna. */}
      <div className="grid grid-cols-3 gap-2">
        {SKILL_BRANCHES.map((branch) => (
          <section key={branch} className="flex flex-col gap-2" data-branch={branch}>
            <h3 className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
              {C.branches[branch]}
            </h3>
            <ul className="flex flex-col gap-2">
              {branchNodes(branch).map((node) => (
                <SkillNodeCard
                  key={node.id}
                  view={skillView(node, skillPoints, owned)}
                  onAcquire={() => setPending(node.id)}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>
      {pendingNode && (
        <ConfirmDialog
          title={C.confirmTitle(pendingNode.name)}
          message={C.confirmMessage(pendingNode.cost)}
          confirmLabel={C.acquire}
          onConfirm={() => {
            useGameStore.getState().unlockSkill(pendingNode.id);
            setPending(null);
          }}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  );
}

function ProfileTab() {
  const player = useGameStore((s) => s.player);
  const stats = useGameStore((s) => s.stats);
  const rival = useGameStore((s) => s.rival);
  const P = C.profile;
  const next = xpToNext(player.level);
  const steals = rival.history.filter((h) => h.kind === 'STEAL');
  return (
    <div className="mt-3 flex flex-col gap-4" data-testid="profile-tab">
      <section className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between">
          <span className="text-xs tracking-widest text-slate-400 uppercase">{P.level}</span>
          <span className="font-mono text-lg text-slate-100" data-testid="profile-level">
            {player.level}
          </span>
        </div>
        <ProgressBar value={Math.min(1, player.xp / next)} />
        <span className="text-right font-mono text-xs text-slate-300" data-testid="profile-xp">
          {P.xp(player.xp, next)}
        </span>
      </section>
      <Stat
        label={P.reputation}
        value={
          <span data-testid="profile-reputation">
            {P.reputationValue(player.reputation, reputationBand(player.reputation))}
          </span>
        }
      />
      <section className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold tracking-widest text-slate-400 uppercase">
          {P.stats}
        </h3>
        <dl
          className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-xs"
          data-testid="profile-stats"
        >
          {(
            [
              [P.contracts, String(stats.contractsCompleted)],
              [P.photos, formatNumber(stats.photosTaken, 0)],
              [P.flightTime, formatDuration(stats.flightTimeS)],
              [P.crashes, String(stats.crashes)],
              [P.distance, P.distanceValue(formatNumber(stats.distanceTiles, 0))],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-slate-400">{k}</dt>
              <dd className="text-right text-slate-100">{v}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="flex flex-col gap-1.5" data-testid="profile-rival">
        <h3 className="text-xs font-semibold tracking-widest text-slate-400 uppercase">
          {P.rival}
        </h3>
        <p className="font-mono text-xs text-slate-200" data-testid="rival-summary">
          {P.rivalSummary(steals.length, rival.history.length - steals.length)}
        </p>
        {steals.length === 0 ? (
          <p className="text-sm text-slate-400">{P.rivalNone}</p>
        ) : (
          <p className="text-sm text-rose-300">{P.rivalScore(rival.score)}</p>
        )}
        <ul className="flex flex-col gap-0.5 text-xs text-slate-300">
          {rival.history.map((h, i) => (
            <li key={i}>
              {h.kind === 'STEAL' ? P.rivalSteal(h.contractId) : P.rivalOffer(h.contractId)}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** Quadro de Carreira (office §5): árvore de habilidades, perfil e visual (skins e emblema). */
export function CareerPanel({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<CareerTab>('SKILLS');
  useFocusNavigation(ref, { onBack: onClose, autoFocus: true });
  return (
    <div
      ref={ref}
      className="absolute top-0 right-0 bottom-0 w-[28rem] overflow-y-auto p-3 max-[1500px]:w-96"
      data-testid="career-panel"
    >
      <Panel
        title={C.title}
        icon={Award}
        actions={
          <Button
            size="sm"
            variant="ghost"
            icon={X}
            aria-label={STRINGS.office.close}
            onClick={onClose}
          />
        }
      >
        <Tabs
          tabs={[
            { id: 'SKILLS', label: C.tabs.SKILLS, icon: Sparkles },
            { id: 'PROFILE', label: C.tabs.PROFILE, icon: UserRound },
            { id: 'VISUAL', label: C.tabs.VISUAL, icon: Palette },
          ]}
          value={tab}
          onChange={setTab}
          ariaLabel={C.title}
        />
        {tab === 'SKILLS' && <SkillsTab />}
        {tab === 'PROFILE' && <ProfileTab />}
        {tab === 'VISUAL' && <VisualTab />}
      </Panel>
    </div>
  );
}
