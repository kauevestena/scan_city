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
