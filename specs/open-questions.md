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
