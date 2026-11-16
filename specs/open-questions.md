# Questões em Aberto

> O agente implementador registra aqui **toda ambiguidade** encontrada, em vez de inventar comportamento ([constitution §4.5](constitution.md)). Cada questão tem um padrão provisório, para que o trabalho não pare, a menos que seja marcada como **bloqueante**.
>
> **Formato:**
>
> ```
> ### OQ-NNN — <título>
> - Aberta em: <data> por <tarefa>
> - Contexto: …
> - Opções: A) … B) …
> - Padrão provisório: … (ou ⛔ BLOQUEANTE)
> - Resolução: (preenchida pelo responsável do produto) → gera ADR se mudar a spec
> ```

---

### OQ-001 — Nome do personagem e da empresa editáveis?
- **Aberta em:** 2026-11-13 (conversão da spec)
- **Contexto:** o original não fala em personalizar o nome. O emblema já tem sigla editável.
- **Opções:**
  - A) nome fixo "Geodesta" e empresa fixa "GeoSurvey Soluções Cartográficas";
  - B) campo de nome na intro.
- **Padrão provisório:** A.
- **Resolução:** —

### OQ-002 — Outros idiomas
- **Aberta em:** 2026-11-13
- **Contexto:** a spec define só pt-BR. Os textos já estão centralizados em `src/data`.
- **Padrão provisório:** só pt-BR, sem infraestrutura de i18n.
- **Resolução:** —

### OQ-003 — Controles Nintendo (Switch Pro) e outros
- **Aberta em:** 2026-11-13
- **Contexto:** o original cita Xbox e PS5.
- **Padrão provisório:** controles não reconhecidos usam os glyphs do Xbox (família `GENERIC`).
- **Resolução:** —

### OQ-004 — Validação do balanceamento por playtest
- **Aberta em:** 2026-11-13
- **Contexto:** preços, pagamentos e durações foram validados por cálculo ([catalog §13](content/catalog.md)), não por playtest.
- **Padrão provisório:** manter os valores. Revisar após o M3 com uma sessão de jogo real. Os ajustes viram ADR.
- **Resolução:** —

### OQ-005 — Nomes de órgãos públicos reais nos clientes
- **Aberta em:** 2026-11-13
- **Contexto:** o original cita "IPHAN" como cliente do C05.
- **Padrão provisório:** usar "Instituto do Patrimônio Histórico" no jogo. A referência ao IPHAN fica só na spec.
- **Resolução:** —

### OQ-006 — Detalhes do `stepAircraft` não fixados em domain-math §5
- **Aberta em:** 2026-11-14 por T013
- **Contexto:** a spec define os limites, mas não três detalhes de dinâmica:
  1. a velocidade lateral-alvo da asa fixa com `MOVE_X = ±1` (só a aceleração `aLat ≤ v²/R` é dada);
  2. como a altitude "persegue" o alvo do Terrain Following;
  3. o que fazer quando o relevo sobe acima do piso `elev + 2` sem comando do piloto, já que a spec diz ao mesmo tempo que a altitude é limitada a `[elev + 2, …]` e que "colidir com o terreno ainda é possível".
- **Padrão provisório** (implementado em `src/domain/flightPhysics.ts`):
  1. alvo lateral = `MOVE_X · v · sin(30°)`, ou seja, proa máxima de 30° em relação à linha;
  2. `vz = clamp(2 · (alvo − alt), ±climbRateMs)`, mais as térmicas;
  3. o piso só impede a **descida comandada** abaixo de `elev + 2`. A aeronave não é empurrada para cima, e o relevo pode alcançá-la (a colisão é tratada pelo engine em T028).
- **Resolução:** —

### OQ-007 — Água na cobertura: sempre excluída ou só com `SPECULAR_WATER`?
- **Aberta em:** 2026-11-14 por T015
- **Contexto:** [data-model §4](design/data-model.md) diz que `MIN_COVERAGE_GREEN` "exclui água se SPECULAR_WATER", e [domain-math §9](design/domain-math.md) diz que as células de água são excluídas "sempre".
- **Opções:** A) sempre (domain-math §9); B) só com `SPECULAR_WATER`.
- **Padrão provisório:** A, porque a domain-math é a especificação normativa das fórmulas e água não tem *tie points* em nenhum caso. `summarizeCoverage` recebe as células excluídas por parâmetro, e quem decide é `evaluateMission` (T018).
- **Resolução:** A. A tabela de regras de [contracts-real §1](content/contracts-real.md) (`SPECULAR_WATER`) também diz "Células de água são sempre excluídas da cobertura". O comentário de data-model §4 é que está impreciso (2026-11-14, T018).

### OQ-008 — Cobertura e score de missões LiDAR
- **Aberta em:** 2026-11-14 por T018
- **Contexto:** o score (domain-math §10.1) usa `cov` a partir da cobertura de fotos (≥ 5 fotos por célula). Missões LiDAR (C03, R04, R10) podem não ter fotos, e a cobertura ficaria toda vermelha, mesmo com a nuvem densa.
- **Padrão provisório:** em missões cujo contrato exige `SENSOR_KIND = LIDAR` e que tenham grade LiDAR, cada célula conta como `min(5, ⌊5 · densidade / ref⌋)` "fotos", com `ref` = o valor de `MIN_LIDAR_DENSITY` do contrato (ou 10 pts/m²). Ou seja, a célula é verde com a densidade exigida. As demais missões usam a cobertura de fotos.
- **Resolução:** —

### OQ-009 — Veículo mínimo de R05
- **Aberta em:** 2026-11-14 por T021
- **Contexto:** a ficha de R05 em [contracts-rifts](content/contracts-rifts.md) não tem a linha "Veículo mínimo", o que daria `FOOT_BIKE`. Mas o layout macro de [world-map §5.1](features/world-map.md) põe a fenda `e` (R05) "atrás do cinturão `A` → 4x4".
- **Opções:** A) `PICKUP_4X4`, como no layout do mapa; B) `FOOT_BIKE`, abrindo uma passagem no cinturão.
- **Padrão provisório:** A. O mapa e o teste de BFS (`MARKER_ACCESS`) tratam `e` como só 4x4. Ao criar a ficha de R05 (T059), usar `minVehicle = PICKUP_4X4`.
- **Resolução:** —

### OQ-010 — Roubo sem outro contrato jogável
- **Aberta em:** 2026-11-14 por T025
- **Contexto:** pela [progression §8](features/progression.md), uma falha crítica (fora do replay) faz a MegaMap roubar o contrato, que só volta depois de o jogador concluir **outro**. Na primeira tentativa do C00, não existe outro contrato: o C01 exige `CONTRACT_DONE(C00)`. O jogo travaria. O mesmo vale para qualquer roubo quando não há nenhum outro contrato disponível ou concluído (os concluídos podem ser repetidos).
- **Opções:** A) não roubar quando não houver outro contrato jogável; B) isentar só o C00; C) devolver o contrato roubado depois de um tempo.
- **Padrão provisório:** A (`canBeStolen` em `missionSlice`). Cobre o C00 e qualquer situação equivalente, sem mudar a regra no resto da campanha.
- **Resolução:** —

### OQ-011 — GCP sobre a lava (R05)
- **Aberta em:** 2026-11-15 por T068
- **Contexto:** a [acessibilidade](features/field-setup.md) só invalida o ponto na água, no telhado, sob dossel > 0,6 ou fora do alcance do veículo (rede, distância, declive e brejo). A lava da R05 (`LAVA`, as colunas abaixo de 8 m) não entra na lista: é plana, a picape chega e o declive passa, então o jogador pode cravar um GCP no meio da lava. As fotos sobre lava também valem (só a água é excluída da cobertura: OQ-007).
- **Opções:** A) manter a spec (a lava é chão); B) tratar a lava como a água: ponto inválido (novo motivo `LAVA`) e células de lava fora da cobertura.
- **Padrão provisório:** A. Os patamares dos 5 GCPs do plano de referência nunca são lava (cota mínima de 8 m), então o plano de referência não depende da decisão.
- **Resolução:** —

### OQ-012 — A tabela de balanceamento de catalog §13 não conta a lente de 24 mm
- **Aberta em:** 2026-11-15 por T071
- **Contexto:** a simulação manual de [catalog §13](content/catalog.md) tira só o combo T2 (R$ 70.000) no C06, mas o combo traz a `LENS_35` e o plano de referência do C06 (e das fendas R07, R11, R03 e R05) usa a `LENS_24`, que custa R$ 6.000 à parte. A campanha simulada na store de verdade fica R$ 6.000 abaixo da tabela do C06 em diante e segue viável (sobram R$ 3.500 no ponto mais apertado depois do C06; o mais apertado de todos é o C01, com R$ 1.300).
- **Opções:** A) manter os preços e tratar a tabela como informativa (a viabilidade vale); B) incluir a `LENS_24` no combo T2 (muda a [catalog §3](content/catalog.md)); C) trocar os planos de referência para a `LENS_35` (muda os GSD esperados de várias fichas).
- **Padrão provisório:** A. O teste de campanha confere o saldo da tabela menos R$ 6.000 do C06 em diante.
- **Resolução:** —

### OQ-013 — Medição de FPS no perfil de referência (com GPU)
- **Aberta em:** 2026-11-16 por T077
- **Contexto:** o REQ-NFR-001 fala de um notebook de 4 núcleos com Chrome atual, mas o único ambiente de medição disponível é o Chromium headless do Playwright, **sem GPU** (raster do canvas por software, na thread principal; ver [ADR-024](decisions.md)). Lá o jogo passa da meta, e com GPU o raster sai da thread principal, então a expectativa é de folga maior; mas isso é uma expectativa, não uma medição.
- **Opções:** A) aceitar a medição sem GPU como o pior caso e seguir; B) repetir a tabela do ADR-024 num notebook real (overlay de FPS, "Mostrar FPS" em Configurações) antes do release; o passo a passo está em [qa-manual.md](qa-manual.md) §4.
- **Padrão provisório:** A. A tabela, o método e o painel F9 (tempo por etapa) estão no ADR-024, então a repetição em outro hardware é só rodar o mesmo roteiro.
- **Resolução:** —

### OQ-014 — Smoke manual no Firefox
- **Aberta em:** 2026-11-16 por T078
- **Contexto:** o REQ-NFR-009 pede o jogo nas versões atuais de Chrome, Edge e Firefox, com "smoke E2E no Chromium + verificação manual no Firefox documentada". O ambiente das tarefas só tem o Chromium (o `playwright install firefox` é bloqueado pela rede), então o Firefox não foi aberto. O código não usa API só do Chromium (varredura na T078) e o `roundRect` do canvas, o único recurso recente, existe no Firefox desde a versão 112.
- **Opções:** A) um humano roda o roteiro da T078 no Firefox (passo a passo em [qa-manual.md](qa-manual.md) §1) e fecha o requisito; B) aceitar o requisito como "Chromium verificado, Firefox por construção" no release.
- **Padrão provisório:** A é o pedido da spec; até lá, o REQ-NFR-009 fica ☐ na matriz. **Decisão do release (T079):** o jogo sai com o requisito ☐ e a pendência listada no `README.md`, em vez de marcá-lo ✅ sem ninguém ter aberto o Firefox; o roteiro da T078 segue valendo, e quem o rodar fecha a pergunta e vira a linha da matriz.
- **Resolução:** A, no que dá para automatizar (2026-11-16, T083). Com os hosts de download do Playwright liberados no ambiente, a suíte E2E inteira (135 testes) roda no Firefox 155 (`npm run e2e:firefox`) e passa, e o jogo publicado no GitHub Pages passa o vertical slice do C00 nele; o REQ-NFR-009 virou ✅. O toque humano (aparência, som e o controle de verdade) segue no [qa-manual.md](qa-manual.md) §1, como confirmação.
