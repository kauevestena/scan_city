# Scan City — Especificação para Spec-Driven Development

Esta pasta é a **fonte da verdade** para implementar o **Scan City**, um simulador RPG de fotogrametria e LiDAR com mundo aberto 2D, voo arcade 2.5D, mesa holográfica 3D e fendas dimensionais paródicas. Ela foi derivada do documento de visão [`../spec_inicial.md`](../spec_inicial.md), que permanece intocado como referência histórica.

O desenvolvimento segue **Spec-Driven Development (SDD)**: primeiro a spec, depois o código, sempre verificado contra a spec.

---

## 1. Mapa dos documentos

| Ordem | Documento | Para quê |
| :-: | :--- | :--- |
| 1 | [constitution.md](constitution.md) | Regras imutáveis: stack, princípios, convenções, Definition of Done, guarda de conteúdo |
| 2 | [product.md](product.md) | Visão, narrativa, loop de jogo, pilares e glossário técnico |
| 3 | [requirements.md](requirements.md) | 141 requisitos `REQ-<ÁREA>-NNN` (formato EARS) com critério de aceite |
| 4 | [design/architecture.md](design/architecture.md) | Pastas, máquina de 7 telas (16 transições), store, game loop, persistência, debug, testes |
| 4 | [design/data-model.md](design/data-model.md) | Interfaces TypeScript canônicas |
| 4 | [design/domain-math.md](design/domain-math.md) | Todas as fórmulas e modelos, com **32 golden values** para testes |
| 4 | [design/terrain.md](design/terrain.md) | Terreno procedural, 18 biomas e formas de colisão |
| 4 | [design/input.md](design/input.md) | Teclado, mouse e Gamepad API (Xbox/PS5), glyphs, navegação de UI |
| 4 | [design/audio.md](design/audio.md) | Receitas de síntese de cada efeito sonoro |
| 4 | [design/ui-style.md](design/ui-style.md) | Tokens visuais, kit de componentes, padrões de HUD |
| 5 | [features/office.md](features/office.md) | `OFFICE`: sede e hub |
| 5 | [features/world-map.md](features/world-map.md) | `WORLD_MAP`: mundo aberto 2D |
| 5 | [features/field-setup.md](features/field-setup.md) | `FIELD_SETUP`: GCPs, plano de voo, mini-games |
| 5 | [features/survey-flight.md](features/survey-flight.md) | `SURVEY_FLIGHT`: motor 2.5D |
| 5 | [features/processing-results.md](features/processing-results.md) | `PROCESSING_RESULTS`: SfM, relatório, produtos |
| 5 | [features/holo-table.md](features/holo-table.md) | `HOLO_TABLE_VIEW`: o Museu 3D |
| 5 | [features/infographic-lab.md](features/infographic-lab.md) | `INFOGRAPHIC_LAB`: os 4 infográficos |
| 5 | [features/progression.md](features/progression.md) | Economia, loja, skills, equipe, museu, rival |
| 6 | [content/catalog.md](content/catalog.md) | Números de equipamentos, skills, cosméticos, souvenirs, eventos, balanceamento |
| 6 | [content/contracts-real.md](content/contracts-real.md) | Regras especiais + C00–C06 com planos de referência verificados |
| 6 | [content/contracts-rifts.md](content/contracts-rifts.md) | R01–R11 (Fendas) com planos de referência |
| 7 | [tasks.md](tasks.md) | **103 tarefas**: T001–T098 em 12 fases (F0–F11, com o pós-release T080–T083), a manutenção (T099, T103) e o backlog (T100–T102); mais a matriz de rastreabilidade |
| — | [decisions.md](decisions.md) | ADRs (20 da conversão; 38 ao todo) |
| — | [open-questions.md](open-questions.md) | Ambiguidades e padrões provisórios |
| — | [qa-manual.md](qa-manual.md) | Roteiro dos testes que só uma pessoa faz: Firefox e Edge, controle real, FPS com GPU, som e campanha jogada |

---

## 2. Fluxo SDD

```
  spec_inicial.md (visão)
          │  conversão (esta pasta)
          ▼
  constitution ─▶ requirements ─▶ design/* ─▶ features/* + content/* ─▶ tasks.md
                                                                         │
           ┌─────────────────────────────────────────────────────────────┘
           ▼
  [pegar a próxima tarefa ☐] → ler as specs citadas → testes primeiro (domínio) → implementar
           → verificar (DoD) → marcar ✅ + atualizar a matriz → ADR se decidiu algo → próxima
```

**Regra de mudança:** se a implementação revelar que a spec está errada ou incompleta:
1. atualize a spec (o documento certo);
2. registre uma ADR em [decisions.md](decisions.md);
3. só então mude o código.

O código nunca diverge silenciosamente da spec.

---

## 3. Protocolo do agente implementador (por tarefa)

1. **Selecionar** a primeira tarefa `☐` em [tasks.md](tasks.md) cujas dependências estejam `✅`. Marcá-la `◐`.
2. **Ler** a constitution (sempre), a tarefa inteira e **todas** as seções listadas em "Spec".
3. **Planejar** os arquivos e os testes. Em tarefas de `domain/`, **escrever os testes com os golden values antes** do código.
4. **Implementar** só o escopo da tarefa (constitution §4.2). Sem `TODO`, sem funções vazias.
5. **Verificar:**
   ```bash
   npm run verify          # typecheck + lint + test + build + check:placeholders (+ check:terms após T059)
   # mais os comandos do campo "Verificação" da tarefa, e npm run e2e quando indicado
   ```
6. **Marcar** os critérios de aceite `[x]`, o status `✅` e, na matriz de rastreabilidade, os REQs cujas tarefas estejam todas concluídas.
7. **Registrar** as decisões novas como ADR e as dúvidas em [open-questions.md](open-questions.md). Se a dúvida for bloqueante, marcar a tarefa `⛔` e **parar**.
8. **Commit** (se houver git): `feat(T0NN): <título da tarefa>`, uma tarefa por commit.

---

## 4. Quadro de marcos

| Marco | Conteúdo | Tarefas | Status |
| :--- | :--- | :--- | :-: |
| **M0** Fundação | Projeto, UI kit, store, máquina de estados, save, loop, input, áudio | T001–T009 | ✅ |
| (F1) Domínio | Toda a matemática, com golden values | T010–T019 | ✅ |
| **M1** Vertical Slice | C00 jogável de ponta a ponta | T020–T027 | ✅ (E2E; revisão manual pendente) |
| **M2** Voo completo | Obstáculos, clima, vento, energia, Atlas, LiDAR, modos, alertas, *time warp* | T028–T036 | ✅ |
| (F4–F6) Sistemas | Mini-games, veículos, eventos, produtos, Van, loja, skills, equipe, cosméticos, museu, rival | T037–T051 | ✅ |
| **M3** Conteúdo | 7 contratos reais + 11 fendas + campanha | T052–T071 | ✅ |
| (F8) Museu & Lab | Mesa completa, 4 infográficos | T072–T074 | ✅ |
| **M4** Release | Pausa, juice, performance, acessibilidade, regressão | T075–T079 | ✅ |
| Pós-release | Verificação extra, resiliência do navegador, publicação e Firefox | T080–T083 | ✅ |
| **M5** Voo com desafio | Fase 1 do replanejamento do voo: corredor, nota de execução, rajadas, revoo e cruzeiro ([ADR-029 a 032](decisions.md)) | T084–T092 | ✅ |
| (F11) Desempenho e o teste humano | Resolução adaptativa, voo mais rápido com vento vertical e curva na mão, três dificuldades, sede no mapa e navegação GNSS, o Atlas, os souvenirs que se examinam ([ADR-033 a 036](decisions.md)) | T093–T098 | ✅ |
| Manutenção | Reconciliação da spec com o código depois da F11 ([ADR-037](decisions.md)); o D-pad nos mini-games ([ADR-038](decisions.md)) | T099, T103 | ✅ |
| Backlog | Trabalho adiado que só existia nas notas: Fases 2 e 3 do voo, duração das surtidas e o rival no domínio | T100–T102 | ☐ |

---

## 5. Cobertura do spec original → documentos

| Seção do `spec_inicial.md` | Onde está especificado |
| :--- | :--- |
| §1 Enredo, universo e loop | [product §2, §4](product.md) |
| §2 Arquitetura de telas (7 estados) | [architecture §2](design/architecture.md) + uma feature por tela em [features/](features/) |
| §2.1 OFFICE (Workstation, Garagem, Poleiro, Estante, Laboratório, Mesa) | [office](features/office.md) |
| §2.2 WORLD_MAP (veículos, eventos, seletor de dimensão) | [world-map](features/world-map.md), [catalog §5, §12](content/catalog.md) |
| §2.3 FIELD_SETUP (GCPs, sensores, plano, mini-games RTK e IMU) | [field-setup](features/field-setup.md) |
| §2.4 SURVEY_FLIGHT (transição cinematográfica) | [survey-flight §3, §5](features/survey-flight.md) |
| §2.5 PROCESSING_RESULTS | [processing-results](features/processing-results.md) |
| §2.6 HOLO_TABLE_VIEW | [holo-table](features/holo-table.md) |
| §2.7 INFOGRAPHIC_LAB | [infographic-lab](features/infographic-lab.md) |
| §3 Motor 2.5D (projeção, relevo, altitude, sensores, clima, energia) | [survey-flight §5](features/survey-flight.md), [domain-math §2, §4, §5, §7](design/domain-math.md), [terrain](design/terrain.md) |
| §4A Fórmulas (GSD, pegada, B, S, Δt) | [domain-math §1, §2](design/domain-math.md) (golden values G1–G7) |
| §4B Pipeline SfM, RMSE, PEC-PCD/ASPRS, heatmap, visualizador | [processing-results](features/processing-results.md), [domain-math §6, §8, §9](design/domain-math.md) |
| §4C Laboratório (4 painéis) | [infographic-lab §5](features/infographic-lab.md), [domain-math §3, §4](design/domain-math.md) |
| §5A Campanha principal (6 contratos) | [contracts-real](content/contracts-real.md) (+ C00, ADR-006) |
| §5B Fendas (11 side-quests) | [contracts-rifts](content/contracts-rifts.md), [constitution §6](constitution.md) |
| §6 Tiers de aeronaves e sensores | [catalog §1–§3](content/catalog.md), ADR-013, ADR-014 |
| §6 Frota terrestre | [catalog §5](content/catalog.md) |
| §6 Upgrades (hardware, equipe) | [catalog §6, §7](content/catalog.md), [progression §5, §7](features/progression.md) |
| §6 Cosméticos | [catalog §10](content/catalog.md), [progression §11](features/progression.md) |
| §6 Árvore de habilidades (3 ramos) | [catalog §9](content/catalog.md), [progression §6](features/progression.md) |
| §6 Mesa (névoa, chave dimensional, modos, estante, renda passiva) | [holo-table](features/holo-table.md), [progression §10, §11](features/progression.md) |
| §6 Áudio procedural | [audio](design/audio.md) |
| §7 Controles (PC, Xbox, PS5) | [input](design/input.md) |
| §8 Requisitos estritos | [constitution](constitution.md) (arquivo único → ADR-001) |

### Adições e ajustes em relação ao original (todos com ADR)
- C00 tutorial (ADR-006);
- múltiplas surtidas (ADR-012);
- *time warp* (ADR-020, substituída pela ADR-031);
- ações de input extras (ADR-010);
- transição T16 (ADR-011);
- Pod LiDAR como carga (ADR-013);
- sensores multiespectral, termal e RGB do pod (ADR-014);
- combo T2 (ADR-015);
- Estação Total inicial (ADR-019);
- só o sensor ativo grava (ADR-009);
- guarda de paródias (ADR-008);
- projeto modular (ADR-001);
- voo com desafio: corredor, nota de execução, revoo e entrada de faixa (ADR-029), vento em duas partes (ADR-030), cruzeiro automático no lugar do *time warp* (ADR-031, substitui a ADR-020) e pilotos simulados como meta verificável (ADR-032);
- resolução adaptativa e menos chamadas de desenho (ADR-033);
- voo mais rápido, rajadas só visuais com contragolpe e degraus de detalhe (ADR-034);
- vento vertical, troca de faixa na mão, três dificuldades e voo mais alto (ADR-035);
- souvenirs que se examinam (ADR-036);
- foco do voo limitado pela altura em telas mais largas que 16:9 (ADR-037);
- o mini-game da calibração como camada de input própria, com o Voltar que o interrompe (ADR-038).

---

## 6. Verificação desta suíte de specs

Checagens feitas na conversão, que podem ser repetidas:
- **Rastreabilidade:** os 141 REQs aparecem em ≥ 1 documento de design, feature ou conteúdo **e** em ≥ 1 tarefa. A matriz está no final de [tasks.md](tasks.md).
- **Tarefas:** todas têm "Aceite", "Verificação" e "Status". As tarefas T053–T058 e T060–T070 herdam a verificação comum declarada no início de F7.
- **Golden values:** recalculados de forma independente em Python. Os 18 planos de referência dos contratos atendem aos próprios requisitos de GSD, tempo de voo, baterias e acurácia prevista.
- **Balanceamento:** a simulação manual da campanha é viável ([catalog §13](content/catalog.md)).
