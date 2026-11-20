# Requisitos — Scan City

> Requisitos funcionais e não funcionais rastreáveis. Cada requisito tem um ID estável `REQ-<ÁREA>-NNN`, um enunciado no formato **EARS** (em pt-BR), um **critério de aceite verificável** e a **referência** à spec que o detalha. Não reutilize IDs removidos.

**Padrões EARS usados:**
- *Ubíquo:* "O sistema deve …"
- *Gatilho:* "Quando <evento>, o sistema deve …"
- *Estado:* "Enquanto <estado>, o sistema deve …"
- *Indesejado:* "Se <condição>, então o sistema deve …"
- *Opcional:* "Onde <característica>, o sistema deve …"

**Áreas:**
- `CORE`: núcleo e estado
- `INP`: controles
- `AUD`: áudio
- `UI`: interface
- `OFF`: escritório
- `WLD`: mapa-múndi
- `FLD`: planejamento de campo
- `FLT`: voo 2.5D
- `PRC`: processamento e resultados
- `HOL`: mesa holográfica
- `LAB`: laboratório
- `PRG`: progressão e economia
- `CNT`: conteúdo
- `NFR`: não funcionais

---

## CORE — Núcleo, estado e persistência

**REQ-CORE-001: Máquina de estados de telas.** O sistema deve manter exatamente uma tela ativa entre `OFFICE`, `WORLD_MAP`, `FIELD_SETUP`, `SURVEY_FLIGHT`, `PROCESSING_RESULTS`, `HOLO_TABLE_VIEW` e `INFOGRAPHIC_LAB`. As trocas só acontecem pelas transições da tabela de [architecture §2](design/architecture.md).
- *Aceite:* um teste unitário percorre a tabela, verifica que toda transição listada é aceita e que todas as outras 42 − N combinações são rejeitadas.

**REQ-CORE-002: Transição inválida.** Se uma transição fora da tabela ou com guarda falsa for solicitada, então o sistema deve:
- em desenvolvimento, lançar `InvalidTransitionError`;
- em produção, ignorar a solicitação e registrar um `console.warn`.
- *Aceite:* testes cobrem os dois modos (`import.meta.env.DEV`).

**REQ-CORE-003: Pausa.** Quando o jogador acionar Pausar (`Esc`/`M`/Menu/Options), o sistema deve:
- exibir o overlay de pausa sobre a tela atual;
- congelar loops de simulação, timers de jogo e renda passiva;
- retomar exatamente do mesmo estado ao fechar o overlay.
- *Aceite:* no voo, a posição da aeronave e a bateria não mudam durante 5 s de pausa (teste com relógio simulado).

**REQ-CORE-004: Persistência e autosave.** O sistema deve salvar o `SaveGame` versionado em `localStorage` (chave `scan-city-save`):
- a cada transição de tela;
- a cada 30 s de jogo não pausado;
- ao fechar a aba (`beforeunload`).

Se o navegador recusar o armazenamento (`localStorage` bloqueado pelos cookies ou por um iframe, cheio ou com erro), então o sistema deve abrir um jogo novo, seguir jogando sem salvar e avisar o jogador com um toast, sem lançar exceção ([ADR-027](decisions.md)).
- *Aceite:* recarregar a página restaura dinheiro, inventário, contratos, museu e posição no mapa; com o `localStorage` lançando exceção, o jogo abre no escritório, joga e mostra "Não foi possível salvar".

**REQ-CORE-005: Migração e corrupção de save.** Quando um save com `version` menor que a atual for carregado, o sistema deve aplicar as migrações em sequência. Se o save for inválido (JSON quebrado ou schema inválido), então o sistema deve:
- copiar o conteúdo para `scan-city-save-backup`;
- iniciar um novo jogo;
- exibir um toast de aviso.
- *Aceite:* testes com save v0 fictício, JSON truncado e campo obrigatório ausente.

**REQ-CORE-006: Determinismo.** O sistema deve gerar terreno, objetos, resíduos de GCP, eventos de campo e lances do rival a partir de um PRNG seedado. Com a mesma seed e as mesmas entradas, o resultado é idêntico.
- *Aceite:* o teste gera duas vezes o terreno e o relatório de um contrato e compara igualdade profunda.

**REQ-CORE-007: Flags de depuração.** Onde a URL contiver `?debug=1`, o sistema deve:
- habilitar o overlay de FPS;
- habilitar os parâmetros `seed`, `screen`, `autopilot`, `unlockAll`, `money` e `skipIntro`;
- habilitar o painel `F9` e as galerias `?screen=UIKIT` e `?screen=SOUNDBOARD`.
- *Aceite:* `?debug=1&screen=SURVEY_FLIGHT&autopilot=1` abre um voo com missão de teste que se completa sozinho.

**REQ-CORE-008: Game loop e Canvas.** O sistema deve executar as simulações com `requestAnimationFrame`, limitando `dt` a 50 ms e usando sub-passos de no máximo 1/60 s. Os Canvas devem escalar por `devicePixelRatio` e responder a redimensionamento.
- *Aceite:* um teste do hook com rAF mockado verifica o clamp e a contagem de sub-passos.

**REQ-CORE-009: Novo jogo.** Quando o jogador escolher "Novo jogo" no menu de pausa e confirmar no modal in-app, o sistema deve apagar o save (após backup) e reiniciar no `OFFICE` com o estado inicial de [progression §1](features/progression.md).
- *Aceite:* teste E2E do fluxo de confirmação. Nenhum `window.confirm` é usado.

---

## INP — Controles unificados

**REQ-INP-001: Teclado e mouse.** O sistema deve mapear teclado e mouse para as ações abstratas da tabela de [input §2](design/input.md).
- *Aceite:* um teste unitário injeta `KeyboardEvent`s e verifica os valores das ações.

**REQ-INP-002: Detecção de gamepad.** Quando ocorrer `gamepadconnected` ou `gamepaddisconnected`, o sistema deve:
- atualizar a lista de controles;
- consultar `navigator.getGamepads()` a cada frame;
- exibir um toast "Controle conectado: Xbox/PlayStation/Genérico".

Se `navigator.getGamepads()` não existir (contexto inseguro) ou lançar (Permissions Policy), então o sistema deve seguir só com teclado e mouse, sem exceção e sem parar o loop de jogo ([ADR-027](decisions.md)).
- *Aceite:* teste com gamepad mockado; teste com `getGamepads` lançando `SecurityError`.

**REQ-INP-003: Mapeamento padrão.** O sistema deve mapear os botões e eixos do layout `standard` da Gamepad API conforme [input §2](design/input.md), equivalente nos controles Xbox e PS5.
- *Aceite:* uma tabela de testes cobre cada ação nos dois perfis.

**REQ-INP-004: Glyphs dinâmicos.** O sistema deve exibir os ícones de botão (teclado, Xbox ou PlayStation) conforme o **último dispositivo usado**, trocando em tempo real.
- *Aceite:* um teste de `<InputGlyph action="INTERACT">` renderiza `Espaço`, `A` ou `✕` conforme o dispositivo ativo.

**REQ-INP-005: Deadzone e borda.** O sistema deve aplicar deadzone radial de 0,15 aos analógicos, linear de 0,05 aos gatilhos, e oferecer `pressed`/`released` por frame (detecção de borda).
- *Aceite:* testes unitários com valores de eixo.

**REQ-INP-006: Navegação de UI por gamepad.** Enquanto um painel, modal ou menu estiver aberto, o sistema deve permitir:
- mover o foco entre elementos focáveis com o D-pad ou o analógico (navegação espacial);
- confirmar com `INTERACT`;
- voltar e fechar com `UI_BACK`.
- *Aceite:* E2E com teclado simulando setas, Enter e Esc em todos os modais.

---

## AUD — Áudio procedural

**REQ-AUD-001: Inicialização preguiçosa.** O sistema deve criar o `AudioContext` apenas após o primeiro gesto do usuário (clique, tecla ou botão do gamepad). Se o navegador não puder criá-lo (sem dispositivo de áudio, API bloqueada), então o jogo segue mudo, sem exceção e sem tentar de novo a cada gesto ([ADR-027](decisions.md)).
- *Aceite:* um teste verifica que nenhum `AudioContext` existe antes do gesto; outro, que um `AudioContext` que lança deixa o jogo mudo e sem erro.

**REQ-AUD-002: Catálogo de efeitos.** O sistema deve sintetizar sem arquivos externos os efeitos de [audio §3](design/audio.md):
- obturador, zumbido LiDAR, bip RTH, arrulho de Atlas, caixa registradora;
- colisão, clique de UI, motor/hélice, alerta, decolagem e fenda.
- *Aceite:* o sound board de depuração toca cada efeito, e um teste unitário com `OfflineAudioContext` mockado verifica a criação dos nós.

**REQ-AUD-003: Volume e mudo.** O sistema deve oferecer volume master, volume de efeitos e mudo, persistidos nas configurações.
- *Aceite:* alterar o volume muda o `gain.value` do nó master. O valor sobrevive ao reload.

---

## UI — Interface e estilo

**REQ-UI-001: Paleta dark geodésica.** O sistema deve usar exclusivamente os tokens de [ui-style](design/ui-style.md):
- ardósia escura (`slate`) para fundo;
- ciano radar para elementos ativos;
- âmbar para alertas;
- verde esmeralda para sucesso;
- rosa para erro.
- *Aceite:* revisão visual + `grep` sem cores hex fora de `src/ui/tokens.ts` e dos engines.

**REQ-UI-002: Kit de componentes.** O sistema deve prover os componentes `Panel`, `Button`, `Slider`, `Tabs`, `Modal`, `Toast`, `Stat`, `Gauge`, `ChecklistItem`, `InputGlyph`, `ProgressBar` e `Tooltip`, reutilizados por todas as telas.
- *Aceite:* galeria `?debug=1&screen=UIKIT` com todos os componentes e estados.

**REQ-UI-003: Barra superior.** Enquanto a tela for `OFFICE`, `WORLD_MAP`, `HOLO_TABLE_VIEW` ou `INFOGRAPHIC_LAB`, o sistema deve exibir uma barra superior com:
- emblema da empresa, saldo em R$, nível, barra de XP e reputação;
- renda do museu (R$/min) e dimensão ativa.
- *Aceite:* teste RTL com store mockada.

**REQ-UI-004: Toasts.** Quando ocorrer pagamento, desbloqueio, compra, conexão de controle ou alerta de sistema, o sistema deve exibir um toast empilhável (máximo 4 visíveis, 4 s cada, cor por tipo).
- *Aceite:* teste RTL da fila de toasts.

**REQ-UI-005: Ícones.** O sistema deve usar ícones exclusivamente de `lucide-react`.
- *Aceite:* o lint de dependências não encontra outro pacote de ícones.

---

## OFF — Escritório (Sede GeoSurvey)

**REQ-OFF-001: Sala interativa.** O sistema deve renderizar a sala do escritório em Canvas com os hotspots:
- Porta, Mesa Holográfica, Workstation, Garagem, Poleiro do Atlas;
- Estante de Relíquias, Laboratório, Mesa da Equipe, Quadro de Carreira.
- *Aceite:* todos os 9 hotspots são clicáveis e têm rótulo e ícone.

**REQ-OFF-002: Navegação entre hotspots.** O sistema deve permitir:
- selecionar hotspots com mouse (hover + clique);
- selecionar com teclado/D-pad (navegação espacial);
- ativá-los com `INTERACT`, com destaque visual no foco.
- *Aceite:* E2E percorre todos os hotspots só com teclado.

**REQ-OFF-003: Workstation.** Quando a Workstation for ativada, o sistema deve exibir:
- a fila de missões pendentes de processamento, com botão "Processar" que transita para `PROCESSING_RESULTS`;
- o hardware atual e as opções de upgrade.
- *Aceite:* com uma missão pendente na store, o botão leva ao processamento daquela missão.

**REQ-OFF-004: Garagem.** Quando a Garagem for ativada, o sistema deve exibir a loja e o inventário de aeronaves, sensores, lentes, pods, veículos e equipamentos de campo, além da pintura dos drones.
- *Aceite:* comprar um item com saldo suficiente debita o valor e adiciona o item ao inventário.

**REQ-OFF-005: Poleiro do Atlas.** Quando o Poleiro for ativado, o sistema deve permitir:
- ver e comprar milho;
- alimentar Atlas, enchendo o papo a partir do estoque;
- calibrar a câmera de Atlas (vale 3 voos);
- equipar acessórios.
- O clique em Atlas toca o arrulho.
- *Aceite:* alimentar transfere unidades do estoque para o papo até a capacidade 10.

**REQ-OFF-006: Estante de Relíquias.** O sistema deve exibir uma grade com os 18 souvenirs: os obtidos com ícone e texto, os não obtidos como silhueta "???".
- *Aceite:* teste RTL com 2 souvenirs obtidos.

**REQ-OFF-007: Introdução narrativa.** Quando o jogo for iniciado pela primeira vez (`flags.introSeen = false`), o sistema deve exibir a sequência de 4 cartões da carta do avô e da apresentação de Atlas. Depois, mostra a dica "Vá até a porta para explorar o mapa".
- *Aceite:* E2E de novo jogo mostra os cartões. Um segundo carregamento não mostra.

---

## WLD — Mapa-múndi top-down 2D

**REQ-WLD-001: Mapa em tiles.** O sistema deve renderizar o mapa-múndi (160 × 100 tiles) a partir do layout ASCII de `src/data/overworld/map.ts`:
- arte procedural por tipo de tile;
- câmera que segue o avatar com suavização;
- limites que nunca mostram fora do mapa.
- *Aceite:* um teste valida as dimensões e os caracteres do layout. Uma verificação visual mostra cada tipo de tile.

**REQ-WLD-002: Locomoção.** O sistema deve mover o avatar continuamente com `MOVE_X/Y`. A velocidade depende do **modo de locomoção** ativo (A pé/Bicicleta, Carro Compacto, Picape 4x4, Van Lab) e do **tipo de tile**, conforme [catalog §5](content/catalog.md). `CYCLE_VEHICLE` alterna entre os modos possuídos.
- *Aceite:* teste unitário da função de velocidade e E2E de troca de modo.

**REQ-WLD-003: Passabilidade.** Se o próximo tile for intransponível para o modo ativo, então o sistema deve:
- bloquear o movimento naquele eixo;
- exibir uma dica contextual, como "Encosta íngreme — requer Picape 4x4" (no máximo uma a cada 3 s).
- *Aceite:* um teste BFS confirma que cada marcador é alcançável com o veículo mínimo exigido e **não** é alcançável com os inferiores, quando o contrato for de acesso restrito.

**REQ-WLD-004: Seletor de dimensão.** O sistema deve oferecer as abas **Contratos do Mundo Real** e **Fendas Dimensionais** (atalho `TOGGLE_DIMENSION`), que filtram os marcadores visíveis e aplicam a tonalidade roxa no modo Fendas. A aba Fendas só aparece após a primeira fenda ser detectada.
- *Aceite:* teste RTL e E2E.

**REQ-WLD-005: Briefing de contrato.** Quando o avatar estiver a ≤ 0,8 tile de um marcador e o jogador acionar `INTERACT`, o sistema deve abrir o modal de briefing com:
- cliente, objetivo e diálogo;
- requisitos técnicos, equipamento recomendado e pagamento-base.
- Os botões são **Aceitar** (vai para `FIELD_SETUP`) e **Recusar** (fecha).
- *Aceite:* E2E do tutorial.

**REQ-WLD-006: Eventos de campo.** Enquanto o avatar se desloca por terra, trilha ou campo, o sistema deve sortear eventos aleatórios conforme [world-map §5.5](features/world-map.md): chance por tile percorrido e intervalo mínimo de 20 s.
- *Aceite:* teste unitário com seed fixa produz a sequência esperada de eventos.

**REQ-WLD-007: Retorno à sede.** Quando o avatar estiver na porta da sede (tile `O`) e acionar `INTERACT`, o sistema deve transitar para `OFFICE`.
- *Aceite:* E2E.

**REQ-WLD-008: Marcadores bloqueados.** O sistema deve exibir contratos bloqueados como marcadores cinza com cadeado. O briefing lista as condições pendentes (contrato prévio, reputação, nível, veículo) sem permitir aceitar.
- *Aceite:* teste RTL do briefing bloqueado.

---

## FLD — Planejamento técnico e mini-games de campo

**REQ-FLD-001: Vista de satélite da AOI.** O sistema deve renderizar a AOI e uma margem de 20 % em vista ortogonal. A imagem é gerada a partir do **mesmo terreno seedado** do voo (cobertura do solo, hillshade, estradas, água e objetos vistos de cima).
- *Aceite:* um teste confirma que o sampler usado é o mesmo (mesma função e seed) do motor de voo.

**REQ-FLD-002: Colocação de GCPs e CPs.** O sistema deve permitir colocar, mover e remover GCPs (alvo xadrez) e CPs (alvo triangular) por clique, ou por cursor via gamepad. Os limites vêm do equipamento de campo ([catalog §6](content/catalog.md)).
- *Aceite:* teste RTL de colocar, remover e atingir o limite.

**REQ-FLD-003: Acessibilidade por veículo.** Se o ponto clicado for inacessível para o melhor veículo possuído, então o sistema deve recusar a colocação e exibir o motivo. Os motivos possíveis são:
- distância à via > alcance;
- declividade acima do limite;
- brejo;
- água;
- telhado ou copa sem visada.
- A máscara de acessibilidade é sobreposta ao mapa.
- *Aceite:* testes unitários de `isAccessible()` para cada motivo.

**REQ-FLD-004: Indicador de distribuição.** O sistema deve exibir ao vivo:
- número de GCPs e CPs;
- cobertura do casco convexo (% da AOI);
- índice de colinearidade (λmin/λmax);
- semáforo de qualidade da distribuição.
- *Aceite:* testes unitários das métricas (pontos colineares ⇒ índice < 0,05).

**REQ-FLD-005: Seleção de equipamento.** O sistema deve permitir escolher a aeronave entre as possuídas, a carga (sensor/pod) compatível e a lente (24 mm ou 35 mm equivalentes), quando o sensor aceitar lentes intercambiáveis.
- *Aceite:* combinações incompatíveis não aparecem nas opções (teste RTL).

**REQ-FLD-006: Parâmetros do plano.** O sistema deve oferecer sliders com estes limites:
- altura H, entre os limites da aeronave e o teto do contrato;
- sobreposição longitudinal p, de 60 a 85 %;
- sobreposição lateral q, de 50 a 80 %;
- velocidade v, entre os limites da aeronave.
- Também oferece a orientação das linhas, a janela de iluminação e os modos especiais.
- *Aceite:* teste RTL dos limites.

**REQ-FLD-007: Estatísticas ao vivo.** Quando qualquer parâmetro mudar, o sistema deve recalcular e exibir, em < 16 ms:
- GSD, W_g × H_g, B, S e Δt;
- nº de linhas, fotos por linha e total de fotos;
- tempo de voo, baterias necessárias e blur previsto;
- skew de rolling shutter e densidade LiDAR (total e de solo).
- Tudo calculado por `domain/`.
- *Aceite:* teste RTL com os golden values de [domain-math §9](design/domain-math.md).

**REQ-FLD-008: Traçado das linhas.** O sistema deve desenhar sobre a AOI as linhas de voo numeradas, as setas de direção, as posições estimadas de disparo e a pegada de uma foto de exemplo. Com malha cruzada, também desenha as linhas perpendiculares.
- *Aceite:* o número de linhas desenhadas é igual a `plan.lines.length` (teste RTL do canvas mockado).

**REQ-FLD-009: Checklist de requisitos.** O sistema deve listar os requisitos do contrato com a previsão de status (✓, ⚠ ou ✗) a partir do plano atual e indicar a severidade (Crítico, Maior, Menor).
- *Aceite:* teste unitário de `predictRequirements(plan, contract)`.

**REQ-FLD-010: Mini-game de nivelamento.** Onde o jogador iniciar "Nivelar instrumento", o sistema deve executar o mini-game da bolha de nível ([field-setup §5.4](features/field-setup.md)). Ele produz `levelScore ∈ [0,1]`, que reduz o σ dos GCPs e, com RTK, melhora a solução RTK.
- *Aceite:* teste unitário da função de pontuação. E2E com input simulado.

**REQ-FLD-011: Mini-game de calibração da IMU.** Onde o jogador iniciar "Calibrar IMU", o sistema deve executar o mini-game do "8" (lemniscata). Ele produz `imuScore ∈ [0,1]`, que reduz a deriva e o ruído LiDAR.
- *Aceite:* teste unitário da pontuação.

**REQ-FLD-012: Modos especiais de voo.** Onde a aeronave suportar, o sistema deve permitir ativar:
- **Terrain Following** (aeronaves com `terrainFollowing`);
- **Malha Cruzada** (todas, exceto Atlas);
- **Oblíqua 45°/60°** (aeronaves com `gimbalTilt`).
- O plano e as estatísticas se ajustam a cada modo.
- *Aceite:* ativar a malha cruzada dobra o número de linhas (teste unitário).

**REQ-FLD-013: Validação para decolar.** Se o plano tiver um erro bloqueante, então o sistema deve desabilitar "Decolar" e listar o motivo. Os erros bloqueantes são:
- nenhuma aeronave;
- sensor incompatível;
- H fora dos limites;
- AOI sem linhas.
- Requisitos de qualidade não atendidos geram **avisos**, não bloqueios.
- *Aceite:* teste RTL.

---

## FLT — Voo 2.5D

**REQ-FLT-001: Projeção em perspectiva.** O sistema deve projetar toda entidade 3D com `scale = focalPx / (Z + cameraOffset)`, `X_s = HorizonX + (X − camX)·scale` e `Y_s = HorizonY + (camAlt − (Elev(X,Z) + Y))·scale`, conforme [survey-flight §5.1](features/survey-flight.md).
- *Aceite:* testes unitários de `project()` com valores tabelados.

**REQ-FLT-002: Terreno com relevo.** O sistema deve renderizar o terreno em faixas de perspectiva de longe para perto, com:
- hillshade dinâmico e tinta hipsométrica ou cor de cobertura;
- curvas de nível projetadas;
- névoa de distância;
- oclusão natural, em que morros encobrem o que está atrás.
- *Aceite:* uma cena de teste com morro mostra um objeto atrás dele oculto (snapshot de pixels em canvas de teste).

**REQ-FLT-003: Decolagem cinematográfica.** Quando o voo iniciar, o sistema deve executar uma transição de 2,5 s: a aeronave sobe do solo até a altura planejada, a câmera se posiciona atrás dela, o horizonte desce até a posição de cruzeiro e o som de motor rampa.
- *Aceite:* teste da interpolação. Os controles ficam bloqueados durante a transição.

**REQ-FLT-004: Controles de voo.** O sistema deve aplicar:
- `MOVE_Y` → velocidade-alvo (aceleração limitada);
- `MOVE_X` → deslocamento lateral (limitado pelo raio de curva em asa fixa);
- `ALT_UP/ALT_DOWN` → taxa de subida e descida.
- Tudo respeitando os limites da aeronave.
- *Aceite:* testes unitários da física (`stepAircraft`).

**REQ-FLT-005: Linhas como corridas.** O sistema deve tratar cada linha de voo como uma corrida para frente: início antes da AOI (*lead-in*) e fim depois dela (*lead-out*), com indicador de desvio lateral. Ao fim de cada linha, executa a curva automática animada até a próxima linha, alternando o sentido. A linha seguinte começa com o erro de entrada do REQ-FLT-028.
- *Aceite:* o autopilot completa as N linhas do plano em sequência.

**REQ-FLT-006: Câmera RGB.** Enquanto o sensor ativo for uma câmera e a aeronave estiver dentro da AOI (± uma base), o sistema deve:
- disparar automaticamente a cada `Δt` do plano;
- projetar o trapézio luminoso da pegada no relevo;
- emitir flash suave, som de obturador e incrementar o contador.
- `FIRE` dispara manualmente (cooldown de 0,3 s).
- *Aceite:* com o autopilot, o número de fotos fica dentro de ±1 por linha do previsto.

**REQ-FLT-007: Sobreposição real e faixa.** O sistema deve calcular a sobreposição longitudinal real entre disparos consecutivos (`p_real`) e a estimativa lateral pelo desvio. Ele deve exibir:
- "OVERLAP INSUFICIENTE" quando `p_real` < mínimo do contrato (ou 60 %);
- "FORA DA FAIXA" quando |desvio| > 25 % de S.
- *Aceite:* teste unitário. Voar 30 % acima da velocidade planejada dispara o alerta.

**REQ-FLT-008: Motion blur.** Se o blur previsto do disparo (`v·t_exp/GSD`) ficar acima de 1,0 px, então o sistema deve marcar a foto como borrada e exibir "MOTION BLUR". Entre 0,5 e 1,0 px, mostra só o indicador âmbar.
- *Aceite:* teste unitário com golden value (4,79 px).

**REQ-FLT-009: Sensor LiDAR.** Enquanto o sensor ativo for LiDAR, o sistema deve:
- projetar um leque de feixes ciano/verde oscilando transversalmente;
- marcar 1º retornos (copas e telhados, ciano) e últimos retornos (solo, verde);
- exibir a densidade ao vivo (pts/m² total e de solo);
- acumular amostras na grade LiDAR da missão.
- *Aceite:* a densidade exibida é igual a `lidarDensity()` para os parâmetros atuais.

**REQ-FLT-010: Alternância de sensor.** Quando o jogador acionar `TOGGLE_SENSOR` com uma carga RGB + LiDAR, o sistema deve alternar o sensor ativo (cooldown de 0,5 s), ligar ou desligar o zumbido LiDAR e atualizar o HUD. Só o sensor ativo registra dados.
- *Aceite:* teste unitário. Com o LiDAR ativo, nenhuma foto é registrada.

**REQ-FLT-011: Obstáculos e colisão.** O sistema deve popular o voo com as entidades 3D do bioma (prédios, árvores, postes com fiação, canos, blocos, arcos etc.) e detectar colisão:
- colisão com objeto → −1 de casco, recuo e 1,5 s de invulnerabilidade;
- colisão com o terreno → queda imediata.
- *Aceite:* testes unitários de `checkCollision()` com caixa, cilindro, fio e terreno.

**REQ-FLT-012: Iluminação.** O sistema deve aplicar a janela de iluminação escolhida:
- `SUN_HIGH`: sombras curtas;
- `OVERCAST`: difusa;
- `GOLDEN_HOUR`: sombras longas e paleta âmbar.
- Cada janela altera a paleta, o comprimento das sombras projetadas e o tempo de exposição (blur).
- *Aceite:* teste unitário de `shadowLength()` e da tabela de exposição.

**REQ-FLT-013: Vento e térmicas.** O sistema deve aplicar o vento em duas partes ([ADR-030](decisions.md)):
- o **vento médio** é compensado pela aeronave (sem deriva lateral constante; a velocidade no solo do plano é mantida dentro dos limites de velocidade no ar) e custa energia;
- as **rajadas**, de 1 a 3 por linha, sorteadas pela seed da missão, empurram a aeronave de lado e mudam a velocidade no solo conforme o `driftFactor`, e são avisadas 1,5 s antes (alerta com o lado, biruta no HUD e riscos no ar);
- as térmicas localizadas empurram verticalmente.

O HUD mostra o vento, o *crab angle* necessário e a velocidade no solo.
- *Aceite:* testes unitários (o golden value do crab é 19,47°; a agenda de rajadas é determinística pela seed; toda rajada tem ≥ 50 % da força na transversal; todo contrato tem rajada ≥ 2 m/s).

**REQ-FLT-014: Energia e RTH.** O sistema deve drenar a bateria (ou o milho, no caso de Atlas) conforme [domain-math §7](design/domain-math.md):
- Quando a energia restante ficar abaixo da necessária para voltar × 1,2, ou abaixo de 20 %, emite o bip RTH e o alerta "RTH RECOMENDADO".
- `RTH` encerra a surtida mantendo os dados.
- Se a energia zerar no ar, então ocorre a queda e os dados da surtida se perdem.
- *Aceite:* testes unitários do dreno e do limiar.

**REQ-FLT-015: Comportamento de Atlas.** Onde a aeronave for Atlas:
- o voo é mais estável (`driftFactor` 0,5);
- a energia é milho;
- Atlas é imune a interferência eletromagnética;
- há chance de distração por sementes ou insetos (desvio lateral temporário, contrabalançável).
- *Aceite:* teste unitário do sorteio de distração com seed.

**REQ-FLT-016: Terrain Following.** Enquanto o modo TF estiver ativo, o sistema deve manter a altura AGL-alvo, ajustando a altitude ao relevo à frente com antecipação de 2 s. `ALT_UP/DOWN` alteram o AGL-alvo.
- *Aceite:* no autopilot sobre o terreno da mina, o desvio de AGL fica ≤ 15 %.

**REQ-FLT-017: Rolling shutter.** Onde a câmera for rolling shutter, o sistema deve:
- calcular o skew por foto (`v·t_readout/GSD`);
- aplicar o efeito visual "gelatina" ao footprint em curvas e deslocamentos laterais;
- registrar o skew para a penalidade do relatório.
- *Aceite:* teste unitário.

**REQ-FLT-018: HUD de voo.** O sistema deve exibir:
- aeronave, sensor ativo e status RTK;
- linha atual / total e progresso;
- desvio lateral;
- energia e tempo restante;
- ALT, AGL, velocidade, vento e crab;
- GSD ao vivo, p real e q estimado;
- fotos e blur;
- densidade LiDAR, casco, minimapa e dicas de controle com glyphs;
- a execução (REQ-FLT-029): a nota da última amostra, a sequência, a execução da linha, a velocidade no solo com o alvo, a seta do alvo de altura, a biruta com o aviso de rajada e o estado do cruzeiro.
- *Aceite:* teste RTL do HUD a partir de um snapshot.

**REQ-FLT-019: Fim da surtida e da missão.** Quando a última linha terminar ou o RTH concluir, o sistema deve exibir o diálogo pós-voo:
- **Processar agora**, se possuir Van Lab → `PROCESSING_RESULTS`;
- **Levar dados ao escritório** → `WORLD_MAP`, com a missão na fila;
- **Nova surtida** (troca de bateria ou alimentar Atlas), se houver linhas incompletas ou a revoar e energia reserva.

O diálogo mostra a nota de cada linha voada e as linhas a revoar (REQ-FLT-027).
- *Aceite:* E2E com autopilot.

**REQ-FLT-020: Interferência eletromagnética.** Enquanto o voo ocorrer numa Fenda com aeronave não imune, o sistema deve aplicar ruído de bússola/IMU (tremor lateral e desvio de rumo) e o multiplicador de RMSE de [domain-math §6](design/domain-math.md).
- *Aceite:* teste unitário. Com Atlas, o ruído é zero.

**REQ-FLT-021: Clima especial.** Onde o contrato definir `BLIZZARD`, `MAGIC_FOG` ou água especular, o sistema deve aplicar:
- neve: partículas, visibilidade reduzida e dreno 2×;
- névoa: neblina densa, e as fotos RGB valem 0 para a cobertura;
- água especular sob `SUN_HIGH`: brilho, e as fotos sobre água não geram tie points.
- *Aceite:* testes unitários das regras de cobertura.

**REQ-FLT-022: Perda de RTK em cânions urbanos.** Onde o contrato tiver `URBAN_CANYON_RTK_LOSS`, enquanto a aeronave estiver entre prédios > 60 m com < 40 m de afastamento lateral, o sistema deve:
- mudar o RTK para `FLOAT`;
- exibir "RTK FLOAT — multipercurso GNSS";
- marcar as fotos daquele trecho com `rtk = 'FLOAT'`.
- *Aceite:* teste unitário de `rtkStatusAt()`.

**REQ-FLT-023: Cruzeiro automático.** Enquanto a aeronave estiver estável no corredor (faixa, altura e avanço em Boa ou melhor por 1,5 s) e nada pedir atenção, o sistema deve acelerar o tempo sozinho, com sub-passos de física, até um fator que cresce com a duração da linha (×2 a ×6). Ele volta a ×1 no instante em que houver rajada ativa ou avisada, obstáculo a < 150 m à frente no corredor, alerta crítico, holofote próximo, distração do Atlas, pico elétrico, corredor que sobe ou desce à frente (sem TF) ou curva. `TIME_WARP` liga e desliga o cruzeiro ([ADR-031](decisions.md)).
- *Aceite:* teste unitário das condições de entrada e de queda para ×1, e do fator máximo por duração de linha.

**REQ-FLT-024: Detecção furtiva e alvos especiais.** Onde o contrato definir holofotes (`SEARCHLIGHTS`), se a aeronave permanecer > 1,5 s em um cone de holofote, então o sistema marca `detected = true`. Onde definir `FEATURE_TARGETS`, registra os alvos especiais cobertos por dados suficientes (≥ 3 fotos ou ≥ 50 pts/m² na célula).
- *Aceite:* testes unitários.

**REQ-FLT-025: Corredor de voo.** O sistema deve definir, para cada linha, um corredor ([survey-flight §5.19](features/survey-flight.md)): portais nos pontos de disparo do plano (a cada base `B`, na janela de disparo), com meia largura de `0,10·S` e meia altura de `0,10·H`, na altitude do corredor. A altitude do corredor segue o relevo com a regra do Terrain Following (maior elevação nos próximos 2 s de trajeto + `H`), limitada a uma rampa que a aeronave consegue subir e ao teto. O sistema deve desenhar os portais à frente da aeronave em perspectiva.
- *Aceite:* testes unitários (posições, altitude ≥ relevo + `H`, rampa ≤ 70 % da razão de subida, teto) e teste de draw list dos portais.

**REQ-FLT-026: Nota de execução.** Quando uma foto automática for disparada (ou, com o LiDAR ativo, quando um portal for cruzado), o sistema deve dar a ela uma nota, a pior dos três eixos ([domain-math §10.3](design/domain-math.md)):
- **faixa:** `|desvio lateral| / S` ≤ 0,05 Perfeita, ≤ 0,10 Boa, ≤ 0,25 Fraca, acima Rejeitada;
- **altura:** `|altitude − altitude do corredor| / H` ≤ 0,05, ≤ 0,10, ≤ 0,20;
- **avanço:** distância à foto anterior sobre `B` (no LiDAR, velocidade no solo sobre a do plano) ≤ 1,05, ≤ 1,15, ≤ 1,30.

Foto borrada (> 1 px) é Rejeitada. As fotos da margem de entrada (antes do início da AOI) e as manuais não entram na contagem da linha. Com o LiDAR ativo, os pulsos acumulam com peso 1, 0,5 (Fraca) ou 0 (Rejeitada) conforme a nota do instante.
- *Aceite:* testes unitários com os limites de cada eixo.

**REQ-FLT-027: Aceitação da linha e revoo.** Quando uma passada terminar, o sistema deve calcular a nota dela (Perfeita 1, Boa 0,8, Fraca 0,4, Rejeitada 0, na média das amostras) e aceitá-la se estiver completa e com nota ≥ 0,5. Só a linha aceita fica concluída. Se a passada for recusada, então o sistema deve pôr a linha no fim da fila da surtida, uma vez por surtida, para revoo; as linhas recusadas que sobrarem ficam disponíveis para uma nova surtida.
- *Aceite:* testes unitários da nota e da fila; teste do motor com uma linha voada fora do corredor.

**REQ-FLT-028: Entrada de faixa.** Quando uma linha começar, o sistema deve posicionar a aeronave deslocada lateralmente de 30 % a 40 % de `S`, para um lado sorteado pela seed, limitado a 90 % do que a aeronave consegue corrigir até 2 s depois do início da AOI.
- *Aceite:* teste unitário (faixa de valores, limite por aeronave, determinismo pela seed).

**REQ-FLT-029: Retorno imediato da execução.** O sistema deve mostrar a execução enquanto ela acontece:
- uma marca com a nota a cada amostra, na cor da nota, e a pegada da foto na mesma cor;
- um som a cada amostra: a sequência de Perfeitas sobe uma escala, a Boa mantém a nota e a Fraca ou a Rejeitada quebra a sequência com um som surdo;
- o boletim da linha durante a curva (letra de S a D, contagem por nota e "revoo" quando recusada);
- com "Reduzir flashes e tremores", as marcas aparecem sem piscar.
- *Aceite:* teste RTL do HUD e do boletim; teste do motor (eventos de nota e de fim de passada).

---

## PRC — Processamento, relatório e produtos

**REQ-PRC-001: Esteira SfM.** O sistema deve executar e animar as 6 etapas:
1. extração de features (SIFT/ORB);
2. correspondência de tie points;
3. BBA e calibração de lente;
4. densificação;
5. MDS/MDT;
6. ortorretificação e mosaico.
- Cada etapa tem visual próprio. Em missões LiDAR, roda a esteira LiDAR de [processing-results §4.2](features/processing-results.md).
- *Aceite:* E2E observa os 6 rótulos em sequência.

**REQ-PRC-002: Velocidade por hardware.** O sistema deve calcular a duração total como `T = T_base(N_fotos, N_pts) / speedFactor(hardware)` e dividi-la entre as etapas pelos pesos definidos.
- *Aceite:* teste unitário com golden value (300 fotos no notebook = 30 s).

**REQ-PRC-003: Calibração de lente.** O sistema deve exibir os parâmetros estimados (f em px, cx, cy, k₁, k₂, p₁, p₂) e o erro de reprojeção (px), determinísticos por sensor e seed.
- *Aceite:* teste unitário de determinismo.

**REQ-PRC-004: Tabela de resíduos e RMSE.** O sistema deve exibir, para GCPs e CPs, os resíduos dX, dY e dZ (cm) por ponto e o RMSE X, Y, Z e resultante planimétrica.
- *Aceite:* o RMSE exibido é igual a `rmse()` dos resíduos (teste unitário).

**REQ-PRC-005: Penalidades de acurácia.** O sistema deve aplicar e exibir os multiplicadores de RMSE de [domain-math §6](design/domain-math.md):
- poucos GCPs, GCPs colineares ou de baixa cobertura;
- rolling shutter sem RTK, golden hour, textura homogênea, água;
- overlap baixo, blur, interferência eletromagnética, câmera analógica;
- bônus de mini-games e skills.
- *Aceite:* testes unitários de cada multiplicador.

**REQ-PRC-006: Classificação cartográfica.** O sistema deve classificar o produto pelo PEC-PCD (classe A–D na escala do contrato, planimetria e altimetria) e/ou pela ASPRS (classe X-cm horizontal e vertical), e declarar aprovação ou reprovação.
- *Aceite:* testes unitários com a tabela PEC-PCD.

**REQ-PRC-007: Mapa de calor de sobreposição.** O sistema deve exibir a grade 64 × 64 sobre a AOI: **verde** com ≥ 5 fotos válidas por célula, **amarelo** com 3–4 e **vermelho** com < 3. Mostra também os percentuais de cada classe.
- *Aceite:* teste unitário da rasterização com footprints conhecidos.

**REQ-PRC-008: Visualizador de produtos.** O sistema deve oferecer as abas **Ortofoto RGB**, **MDS**, **MDT**, **Nuvem de Pontos / TIN** e **NDVI**:
- MDS: hipsométrico sombreado;
- MDT: sem vegetação, via LiDAR ou áreas abertas;
- Nuvem / TIN: rotacionável com mouse e gamepad;
- NDVI: só com sensor multiespectral.
- Áreas sem dados aparecem com hachura.
- *Aceite:* E2E alterna as 5 abas. Abas indisponíveis mostram o motivo.

**REQ-PRC-009: Pagamento e recompensas.** Quando o relatório for concluído, o sistema deve calcular e aplicar o pagamento ([domain-math §8](design/domain-math.md)):
- detalhamento por linha, com caixa registradora;
- XP, reputação, souvenir (na 1ª aprovação) e desbloqueios.
- *Aceite:* teste unitário de `computePayment()` com golden values.

**REQ-PRC-010: Enviar ao Museu.** Quando o jogador acionar "Enviar à Mesa do Museu" num relatório aprovado, o sistema deve registrar ou atualizar o setor do museu (mantendo a melhor nota) e transitar para `HOLO_TABLE_VIEW`, focando o setor.
- *Aceite:* E2E.

**REQ-PRC-011: Processamento em campo.** Onde o jogador possuir a Van Lab, o sistema deve permitir processar logo após o voo, com `speedFactor = max(hardware, 2,5)`. Ao concluir, volta ao `WORLD_MAP`.
- *Aceite:* E2E com Van no inventário.

**REQ-PRC-012: Vetorização pela equipe.** Onde houver equipe contratada, o sistema deve exibir a etapa extra "7. Vetorização automática (equipe)" e aplicar o bônus de pagamento da equipe.
- *Aceite:* teste unitário.

**REQ-PRC-013: Volumetria.** Onde o contrato exigir volumetria (`MAX_VOLUME_ERROR_PCT`), o sistema deve calcular o volume de corte e aterro de referência e o medido, e exibir o erro percentual.
- *Aceite:* teste unitário com terreno analítico (cone de volume conhecido).

**REQ-PRC-014: Execução do voo na avaliação.** O sistema deve calcular a execução `E` da missão (0 a 1: a melhor passada de cada linha planejada, ponderada pelas amostras planejadas; linha não voada vale 0) e usá-la na avaliação ([domain-math §10.3](design/domain-math.md)):
- foto Rejeitada não conta na cobertura nem nas medições, e Fraca conta metade na cobertura;
- o multiplicador `execution` (`1 + 0,5·max(0, 0,9 − E)`) entra no RMSE;
- a nota da missão é multiplicada por `0,4 + 0,6·E`;
- o requisito `MIN_EXECUTION`, presente em todo contrato, falha se `E` ficar abaixo do valor;
- o pagamento ganha o bônus de pilotagem (+0,05 em `Q` com `E` ≥ 0,80; +0,10 com `E` ≥ 0,90);
- o relatório mostra a execução, a letra e a contagem por nota.

Missão sem dado de execução (save antigo) vale `E = 1`.
- *Aceite:* testes unitários com golden values; teste RTL do relatório.

---

## HOL — Mesa Topográfica Holográfica

**REQ-HOL-001: Render 3D orbital.** O sistema deve renderizar a mesa em 3D por software (Canvas 2D):
- rotação orbital de 360° em yaw, pitch entre 10° e 80°;
- zoom entre 0,5× e 3×;
- controle por arrastar, roda do mouse, teclado e analógicos.
- *Aceite:* teste unitário da câmera orbital e do clamp.

**REQ-HOL-002: Névoa cartográfica.** O sistema deve exibir os setores não mapeados como blocos de gesso cinza com contorno wireframe e um "?" flutuante.
- *Aceite:* um teste do builder de cena marca os setores não mapeados como `fog`.

**REQ-HOL-003: Setores mapeados.** O sistema deve exibir cada setor mapeado com relevo esculpido (heightmap do terreno do contrato), cor conforme o modo e prédios 3D extrudados (até 40 por setor).
- *Aceite:* teste do builder de cena.

**REQ-HOL-004: Miniaturas animadas.** O sistema deve animar uma miniatura da aeronave usada (pombo ou drone) percorrendo as linhas de voo da melhor missão de cada setor mapeado.
- *Aceite:* teste unitário da interpolação de trajetória.

**REQ-HOL-005: Chave dimensional.** O sistema deve alternar instantaneamente (`TOGGLE_DIMENSION`) entre a **Terra Real** (mapa contínuo de 4 × 2 setores) e o **Multiverso** (anel de 11 dioramas flutuantes).
- *Aceite:* E2E.

**REQ-HOL-006: Modos de exibição.** O sistema deve oferecer os modos **Ortofoto Realista**, **Hipsometria com Hillshade** e **LiDAR Neon** (nuvem + TIN ciano sobre fundo escuro), nas teclas 1/2/3 e no botão `FIRE` (cíclico).
- *Aceite:* teste unitário das funções de cor por modo.

**REQ-HOL-007: Gestão das alas.** O sistema deve exibir o painel de alas (Terra e Multiverso) com cada setor: nota, classe, data, visitantes/h e renda/min. Permite marcar **1 destaque por ala**, que dobra os visitantes daquele setor.
- *Aceite:* teste unitário de `museumIncome()` com destaque.

**REQ-HOL-008: Seleção de setor.** Quando o jogador clicar ou focar um setor, o sistema deve destacá-lo e abrir o cartão de informações. Setores em névoa mostram "Contrato: <nome> — não mapeado".
- *Aceite:* teste de *picking* (ponto na tela → setor).

---

## LAB — Laboratório de Infográficos

**REQ-LAB-001: Óptica e GSD.** O sistema deve exibir um corte transversal animado com câmera, lente, sensor, cone de raios até o solo e o pixel projetado. Tem sliders de H, f e tamanho do pixel e leituras de GSD e W_g.
- *Aceite:* o valor exibido é igual a `gsd()` (teste RTL).

**REQ-LAB-002: Estereoscopia e paralaxe.** O sistema deve exibir duas câmeras separadas por B interceptando o topo e a base de um prédio, com as imagens dos pontos nos dois planos-imagem. Tem sliders de B, H e h, e leituras de b, Δp, h reconstruído, B/H e σ_Z.
- *Aceite:* o h reconstruído é igual ao h do slider (± 0,1 %).

**REQ-LAB-003: LiDAR vs. fotogrametria no dossel.** O sistema deve animar pulsos laser atravessando as copas (1º, 2º e último retorno) ao lado de raios de câmera parando na copa. Mostra os perfis MDS vs. MDT e tem sliders de cobertura de dossel, nº de retornos, PRR e H.
- *Aceite:* a densidade de solo exibida é igual a `groundDensity()`.

**REQ-LAB-004: Global vs. rolling shutter.** O sistema deve simular a captura linha a linha de uma cena (grade e prédio) com o objeto ou a câmera em movimento, mostrando a distorção "gelatina" ao lado da captura global. Tem sliders de velocidade, tempo de leitura e taxa de giro.
- *Aceite:* o skew exibido é igual a `rollingShutterSkewPx()`.

**REQ-LAB-005: Reuso do domínio.** O sistema deve calcular todos os valores do laboratório com as funções de `src/domain/`, sem fórmulas duplicadas.
- *Aceite:* revisão + `grep` mostra que os painéis importam de `@/domain`.

---

## PRG — Progressão, economia e museu

**REQ-PRG-001: Saldo.** O sistema deve manter o saldo em R$ (centavos inteiros internamente) e registrar transações. Se uma compra exceder o saldo, então o sistema deve recusá-la com aviso. O saldo nunca fica negativo, exceto por débitos obrigatórios, que zeram no mínimo.
- *Aceite:* testes unitários.

**REQ-PRG-002: Aeronaves e sensores por tier.** O sistema deve oferecer para compra:
- as aeronaves Tier 1–3 e o Pod LiDAR (Tier 4);
- as câmeras e lentes de [catalog](content/catalog.md).
- Cada item mostra suas specs técnicas. A compra de um item de tier N exige ter o tier N−1.
- *Aceite:* teste unitário de `canBuy()`.

**REQ-PRG-003: Frota terrestre.** O sistema deve oferecer Carro Compacto, Picape 4x4 e Van Lab, que alteram a locomoção no mapa e o alcance de GCPs.
- *Aceite:* teste unitário.

**REQ-PRG-004: Hardware de processamento.** O sistema deve oferecer Notebook Velho → PC Gamer → Workstation Multi-GPU → Servidores em Nuvem, com os `speedFactor` do catálogo.
- *Aceite:* teste unitário.

**REQ-PRG-005: Equipe.** O sistema deve permitir contratar e demitir Estagiários (máx. 3) e Engenheiros Juniores (máx. 2), com custo de contratação, custo por contrato concluído e bônus de pagamento.
- *Aceite:* teste unitário de `staffBonus()` e dos custos.

**REQ-PRG-006: XP e níveis.** O sistema deve conceder XP por contrato e por eventos. O nível n → n+1 exige `round(100·n^1,5)` XP, e cada nível concede 1 ponto de habilidade.
- *Aceite:* teste unitário (nível 1→2 = 100, 2→3 = 283, 3→4 = 520).

**REQ-PRG-007: Árvore de habilidades.** O sistema deve oferecer 3 ramos (Pilotagem & Campo, Engenharia & Sensores, Gestão & Curadoria) com 4 nós cada, pré-requisitos lineares e efeitos aplicados pelo pipeline de modificadores.
- *Aceite:* teste unitário de `applyModifiers()`. Com GES-1, o pagamento sobe +25 %.

**REQ-PRG-008: Cosméticos.** O sistema deve oferecer skins do personagem, pinturas dos drones, acessórios de Atlas e um editor do emblema da empresa (forma, ícone, cores, sigla), visíveis no mapa, no voo, no escritório, na barra superior e no relatório.
- *Aceite:* teste RTL do editor. O emblema persiste.

**REQ-PRG-009: Renda passiva do museu.** Enquanto o jogo não estiver pausado, o sistema deve creditar a renda do museu a cada 10 s (`Σ income/min dos setores × multiplicadores`). Ao carregar o save, credita a renda offline limitada a 2 h.
- *Aceite:* teste unitário com relógio simulado.

**REQ-PRG-010: Souvenirs.** Quando um contrato for aprovado pela primeira vez, o sistema deve adicionar o souvenir do cliente à estante e exibir um toast especial.
- *Aceite:* teste unitário.

**REQ-PRG-011: Rival MegaMap.** O sistema deve:
- (a) com 20 % de chance seedada ao aceitar um contrato, apresentar a **contraproposta da MegaMap** com duas opções: **Igualar preço** (−15 % no pagamento) ou **Apresentar portfólio técnico**. O portfólio mantém o preço se houver contrato prévio aprovado com classe A. Sem esse contrato, o pagamento cai 15 % e a reputação cai 2 (ver [progression §8](features/progression.md));
- (b) em falha crítica, marcar o contrato como `STOLEN` até a conclusão de outro contrato;
- (c) exibir o "mapa MegaMap" distorcido no comparativo do relatório.
- *Aceite:* testes unitários com seed.

**REQ-PRG-012: Reputação.** O sistema deve manter a reputação entre 0 e 100 (início 30), alterada por resultados de contrato e eventos. Ela é condição de desbloqueio de contratos.
- *Aceite:* teste unitário de clamp e deltas.

**REQ-PRG-013: Milho.** O sistema deve tratar o milho como consumível: estoque comprado na loja do Poleiro e papo de Atlas com capacidade 10. Cada unidade dá 60 s de voo.
- *Aceite:* teste unitário.

---

## CNT — Conteúdo e campanhas

**REQ-CNT-001: Contratos reais.** O sistema deve incluir os 7 contratos reais C00–C06 de [contracts-real](content/contracts-real.md), com todos os parâmetros, diálogos, souvenir e setor do museu.
- *Aceite:* teste de schema do conteúdo + teste de viabilidade do plano de referência de cada contrato.

**REQ-CNT-002: Fendas.** O sistema deve incluir as 11 fendas R01–R11 de [contracts-rifts](content/contracts-rifts.md), com bioma visual procedural, regra especial, souvenir e diorama.
- *Aceite:* teste de schema + viabilidade.

**REQ-CNT-003: Progressão e desbloqueio.** O sistema deve desbloquear contratos e fendas conforme as `UnlockCondition` do conteúdo, avaliadas após cada mudança relevante de estado.
- *Aceite:* um teste unitário simula a campanha e verifica a ordem de desbloqueio.

**REQ-CNT-004: Regras especiais.** O sistema deve aplicar as regras especiais (`SpecialRuleId`) de cada contrato nos motores de campo, voo e avaliação, conforme o catálogo de regras de [contracts-real §1](content/contracts-real.md).
- *Aceite:* um teste unitário por regra.

**REQ-CNT-005: Repetição.** O sistema deve permitir repetir um contrato concluído para melhorar a nota. O pagamento é de 40 % do valor-base, sem souvenir novo, e o museu fica com a melhor nota.
- *Aceite:* teste unitário.

**REQ-CNT-006: Guarda de paródias.** O sistema deve respeitar a [constitution §6](constitution.md): nenhum nome de franquia real em `src/` e retratos como emblemas abstratos.
- *Aceite:* teste automatizado com `grep` de uma lista de termos proibidos em `src/`.

**REQ-CNT-007: Diálogos.** O sistema deve exibir os diálogos de briefing, sucesso e falha de cada cliente, com retrato-emblema e efeito máquina de escrever, que pode ser pulado com `INTERACT`.
- *Aceite:* teste RTL.

**REQ-CNT-008: Final da campanha.** Quando os 7 contratos reais estiverem aprovados, o sistema deve exibir uma única vez a cena final (carta do avô e inauguração do Museu) e desbloquear o cosmético "Chapéu do Avô".
- *Aceite:* teste unitário do gatilho.

---

## NFR — Não funcionais

**REQ-NFR-001: Performance.** O sistema deve manter ≥ 55 FPS (média de 10 s) a 1280 × 720, DPR 1, com qualidade "Alta", no voo 2.5D e na mesa holográfica, e ≥ 58 FPS no mapa-múndi. O perfil de referência é uma CPU de notebook de 4 núcleos (2020+) com Chrome atual. As qualidades "Média" e "Baixa" reduzem as faixas e colunas do terreno.
- *Aceite:* overlay de FPS no debug + teste de performance manual documentado em T077.

**REQ-NFR-002: Qualidade de build.** O projeto deve compilar com TypeScript `strict` e ESLint sem erros, e `npm run build` deve gerar `dist/` funcional.
- *Aceite:* CI local (`npm run verify`).

**REQ-NFR-003: Cobertura de testes.** `src/domain/` e `src/lib/` devem ter cobertura ≥ 90 % de linhas, e o projeto todo ≥ 60 %.
- *Aceite:* `npm run test:coverage` com thresholds configurados no Vitest.

**REQ-NFR-004: Resolução e responsividade.** A UI deve funcionar de 1280 × 720 a 1920 × 1080, sem rolagem horizontal. Os Canvas ocupam o espaço disponível e respeitam o DPR.
- *Aceite:* E2E com dois viewports.

**REQ-NFR-005: Zero placeholders.** O código não deve conter `TODO`, `FIXME`, `XXX`, funções vazias nem o `DebugScreenShell` acessível fora do debug.
- *Aceite:* script `npm run check:placeholders` (grep) sem resultados.

**REQ-NFR-006: Sem assets externos.** O build não deve conter imagens, fontes ou áudios externos. Tudo é procedural, e as fontes são as do sistema.
- *Aceite:* um script lista `dist/` e verifica a ausência de `.png/.jpg/.svg/.mp3/.ogg/.wav/.woff*` (exceto o favicon inline).

**REQ-NFR-007: Acessibilidade.** O sistema deve oferecer:
- foco visível;
- contraste AA nos textos;
- opção "Reduzir flashes e tremores", que desativa o flash do obturador, o screen shake e as piscadas;
- navegação completa sem mouse.
- *Aceite:* E2E com a opção ativada verifica a ausência do overlay de flash.

**REQ-NFR-008: Localização pt-BR.** Todos os textos devem estar em pt-BR, com números em formato brasileiro (vírgula decimal, ponto de milhar) e moeda R$.
- *Aceite:* testes de `format.ts`.

**REQ-NFR-009: Navegadores.** O jogo deve funcionar nas versões atuais de Chrome, Edge e Firefox. A Gamepad API é testada em Chrome e Edge.
- *Aceite:* smoke E2E no Chromium + verificação manual no Firefox documentada.

**REQ-NFR-010: Desafio do voo verificável.** Para cada contrato, com o plano de referência, o voo deve cumprir as metas de [ADR-032](decisions.md) com quatro pilotos simulados no motor de verdade:
- o **parado** (nenhum comando) é reprovado, com execução abaixo da mínima do contrato;
- o **distraído** (pilota só na entrada de cada linha) fica pelo menos 0,2 abaixo do mediano e reprova em pelo menos 15 dos 18 contratos;
- o **mediano** (reação de 0,35 s, comando tudo ou nada, lapsos de 1 s) é aprovado, com execução ≥ 0,7 e nota média ≥ 0,8;
- o **bom** (o autopilot) é aprovado, com execução ≥ 0,9 e nenhuma linha recusada.
- *Aceite:* teste automático por contrato dentro do `npm run verify`; `npm run qa:flight` repete com várias seeds e mede o tempo real de cada surtida.
