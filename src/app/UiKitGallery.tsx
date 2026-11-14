import { Camera, Check, Map as MapIcon, Plane, Radar, Settings, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { PortraitSpec } from '@/types';
import {
  Button,
  ChecklistItem,
  COLORS,
  ConfirmDialog,
  DialogueBox,
  EmblemBadge,
  Gauge,
  Modal,
  MoneyText,
  Panel,
  ProgressBar,
  Slider,
  Stat,
  Tabs,
  Toast,
  Tooltip,
  type ButtonVariant,
  type ToastType,
} from '@/ui';
import { toastStore } from '@/ui/toastStore';

const BUTTON_VARIANTS: ButtonVariant[] = ['primary', 'secondary', 'ghost', 'danger', 'rift'];
const TOAST_TYPES: ToastType[] = ['info', 'success', 'warn', 'error', 'money', 'rift'];

const SPEAKER: PortraitSpec & { name: string } = {
  name: 'Atlas (via caderneta do avô)',
  shape: 'SHIELD',
  icon: 'Bird',
  primary: COLORS.radar,
  secondary: COLORS.bgPanel,
  initials: 'AT',
};

const EMBLEMS: PortraitSpec[] = [
  {
    shape: 'SHIELD',
    icon: 'Compass',
    primary: COLORS.radar,
    secondary: COLORS.bgPanel,
    initials: 'GS',
  },
  {
    shape: 'CIRCLE',
    icon: 'Globe',
    primary: COLORS.ok,
    secondary: COLORS.bgRaised,
    initials: 'ONG',
  },
  {
    shape: 'HEXAGON',
    icon: 'Map',
    primary: COLORS.danger,
    secondary: COLORS.bgPanel,
    initials: 'MM',
  },
  {
    shape: 'DIAMOND',
    icon: 'Mountain',
    primary: COLORS.warn,
    secondary: COLORS.bgBase,
    initials: 'MIN',
  },
];

const TABS = [
  { id: 'points', label: 'Pontos de apoio', icon: MapIcon },
  { id: 'plan', label: 'Plano de voo', icon: Plane },
  {
    id: 'calib',
    label: 'Calibração',
    icon: Settings,
    disabled: true,
    reason: 'Exige o kit GNSS RTK',
  },
] as const;

function Section({ name, children }: { name: string; children: ReactNode }) {
  return (
    <Panel title={name} className="break-inside-avoid">
      <div data-kit-component={name} className="flex flex-wrap items-start gap-4">
        {children}
      </div>
    </Panel>
  );
}

/** Galeria de componentes (ui-style §6), aberta com `?screen=UIKIT`. */
export function UiKitGallery() {
  const [height, setHeight] = useState(60);
  const [overlap, setOverlap] = useState(55);
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('points');
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [dialogueRun, setDialogueRun] = useState(0);
  const [dialogueDone, setDialogueDone] = useState(false);

  return (
    <div className="h-screen w-screen overflow-y-auto bg-slate-950 bg-[linear-gradient(to_right,rgba(30,41,59,0.5)_1px,transparent_1px),linear-gradient(to_bottom,rgba(30,41,59,0.5)_1px,transparent_1px)] bg-[size:32px_32px] p-6 text-slate-100">
      <h1 className="mb-6 flex items-center gap-3 text-2xl font-semibold tracking-wide uppercase">
        <Radar size={24} strokeWidth={1.75} className="text-cyan-400" aria-hidden />
        Kit de UI
      </h1>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Section name="Panel">
          <Panel title="Padrão" icon={Radar} className="w-56">
            <p className="text-sm text-slate-300">Painel tático com cantoneiras.</p>
          </Panel>
          <Panel title="Fenda" variant="rift" className="w-56">
            <p className="text-sm text-slate-300">Variante do Multiverso.</p>
          </Panel>
          <Panel
            title="Perigo"
            variant="danger"
            className="w-56"
            actions={<Button size="sm" variant="ghost" icon={Trash2} aria-label="Descartar" />}
          >
            <p className="text-sm text-slate-300">Com ações no cabeçalho.</p>
          </Panel>
        </Section>

        <Section name="Button">
          {BUTTON_VARIANTS.map((variant) => (
            <Button key={variant} variant={variant} icon={Camera}>
              {variant}
            </Button>
          ))}
          <Button size="sm">Pequeno</Button>
          <Button size="lg" variant="primary">
            Grande
          </Button>
          <Button disabled>Desabilitado</Button>
          <Button loading variant="primary">
            Carregando
          </Button>
          <Button variant="primary" glyph="INTERACT" icon={Check}>
            Com glyph
          </Button>
        </Section>

        <Section name="Slider">
          <div className="w-72">
            <Slider
              label="Altura de voo"
              value={height}
              min={20}
              max={120}
              step={5}
              unit="m"
              onChange={setHeight}
              marks={[40, 80]}
            />
          </div>
          <div className="w-72">
            <Slider
              label="Sobreposição lateral"
              value={overlap}
              min={30}
              max={90}
              step={1}
              unit="%"
              onChange={setOverlap}
              warnRange={[30, 59]}
            />
          </div>
          <div className="w-72">
            <Slider
              label="Desabilitado"
              value={3}
              min={0}
              max={10}
              onChange={() => undefined}
              disabled
            />
          </div>
        </Section>

        <Section name="Tabs">
          <div className="w-full">
            <Tabs tabs={TABS} value={tab} onChange={setTab} ariaLabel="Etapas do planejamento" />
            <p className="mt-3 text-sm text-slate-300">Aba ativa: {tab}</p>
          </div>
        </Section>

        <Section name="Modal">
          <Button onClick={() => setModalOpen(true)}>Abrir modal</Button>
          <Modal
            open={modalOpen}
            title="Briefing de exemplo"
            onClose={() => setModalOpen(false)}
            footer={
              <>
                <Button variant="ghost" onClick={() => setModalOpen(false)}>
                  Recusar
                </Button>
                <Button variant="primary" onClick={() => setModalOpen(false)}>
                  Aceitar
                </Button>
              </>
            }
          >
            <p>O foco fica preso aqui dentro. Esc fecha e devolve o foco ao botão.</p>
          </Modal>
        </Section>

        <Section name="ConfirmDialog">
          <Button variant="danger" onClick={() => setConfirmOpen(true)}>
            Novo jogo…
          </Button>
          {confirmOpen && (
            <ConfirmDialog
              title="Novo jogo"
              message="Todo o progresso será perdido. Um backup será guardado."
              confirmLabel="Apagar e recomeçar"
              danger
              onConfirm={() => setConfirmOpen(false)}
              onCancel={() => setConfirmOpen(false)}
            />
          )}
        </Section>

        <Section name="Toast">
          {TOAST_TYPES.map((type) => (
            <Toast key={type} type={type} title={`Toast ${type}`} body="Corpo opcional do aviso." />
          ))}
        </Section>

        <Section name="ToastHost">
          {TOAST_TYPES.map((type) => (
            <Button
              key={type}
              size="sm"
              onClick={() =>
                toastStore
                  .getState()
                  .pushToast({ type, title: `Aviso ${type}`, body: 'Some em 4 segundos.' })
              }
            >
              Disparar {type}
            </Button>
          ))}
        </Section>

        <Section name="Stat">
          <Stat label="GSD" value="2,7" unit="cm/px" status="ok" />
          <Stat label="Sobreposição" value="55" unit="%" status="warn" hint="Mínimo: 60 %" />
          <Stat label="Bateria" value="12" unit="%" status="danger" />
          <Stat label="Altura AGL" value="60,0" unit="m" />
        </Section>

        <Section name="Gauge">
          <div className="w-48">
            <Gauge value={0.82} label="Bateria" thresholds={{ warn: 0.4, danger: 0.2 }} />
          </div>
          <div className="w-48">
            <Gauge value={0.3} label="Cobertura" thresholds={{ warn: 0.4, danger: 0.2 }} />
          </div>
          <div className="w-48">
            <Gauge value={0.1} label="Milho" thresholds={{ warn: 0.4, danger: 0.2 }} />
          </div>
          <Gauge variant="arc" value={0.64} label="Reputação" />
          <Gauge variant="arc" value={0.9} label="Risco" thresholds={{ warn: 0.5, danger: 0.8 }} />
        </Section>

        <Section name="ProgressBar">
          <div className="flex w-72 flex-col gap-3">
            <ProgressBar value={0.35} label="XP" />
            <ProgressBar value={0.6} label="Alinhamento" striped />
            <ProgressBar value={0.8} label="Nuvem densa" striped animated />
            <ProgressBar value={1} />
          </div>
        </Section>

        <Section name="ChecklistItem">
          <ul className="w-full">
            <ChecklistItem
              status="pass"
              label="GSD ≤ 5 cm"
              severity="CRITICAL"
              detail="2,7 cm/px"
            />
            <ChecklistItem
              status="warn"
              label="Sobreposição lateral ≥ 60 %"
              severity="MAJOR"
              detail="55 %"
            />
            <ChecklistItem
              status="fail"
              label="Mínimo de 3 GCPs"
              severity="MAJOR"
              detail="2 de 3"
            />
            <ChecklistItem status="pending" label="Cobertura verde ≥ 90 %" severity="MINOR" />
          </ul>
        </Section>

        <Section name="Tooltip">
          <Tooltip content="Distância de amostragem no solo">
            <Button variant="ghost">Passe o mouse ou foque</Button>
          </Tooltip>
        </Section>

        <Section name="EmblemBadge">
          {EMBLEMS.map((emblem) => (
            <EmblemBadge key={emblem.shape} emblem={emblem} size={64} />
          ))}
          <EmblemBadge emblem={EMBLEMS[0] as PortraitSpec} size={32} />
          <EmblemBadge emblem={EMBLEMS[0] as PortraitSpec} size={24} />
        </Section>

        <Section name="MoneyText">
          <MoneyText cents={1234567} />
          <MoneyText cents={150000} signed />
          <MoneyText cents={-90000} signed />
        </Section>

        <Section name="DialogueBox">
          <div className="w-full">
            <DialogueBox
              key={dialogueRun}
              speaker={SPEAKER}
              lines={[
                'Seu avô media fronteiras com teodolito e paciência.',
                'Agora a oficina é sua. E o pombo também.',
              ]}
              onDone={() => setDialogueDone(true)}
            />
            <div className="mt-3 flex items-center gap-3 text-sm text-slate-300">
              <Button
                size="sm"
                onClick={() => {
                  setDialogueDone(false);
                  setDialogueRun((n) => n + 1);
                }}
              >
                Reiniciar diálogo
              </Button>
              {dialogueDone && <span>Diálogo concluído.</span>}
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
