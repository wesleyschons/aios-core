# SynkraAIOX Second Brain — Arquitetura Completa

> Sistema de memória persistente de longo prazo para orquestração multi-agente com Obsidian como single source of truth.

---

## 1. Princípio Fundamental: Token Budget Architecture

O sistema opera em **3 camadas de resolução** para nunca desperdiçar tokens:

| Camada | Custo | Conteúdo | Quando carregar |
|--------|-------|----------|-----------------|
| **L0 — Index** | ~50 tokens | Uma linha: o que é, status, última ação | Sempre (carregado via frontmatter scan) |
| **L1 — Summary** | ~200-500 tokens | Contexto operacional: decisões-chave, estado atual, dependências | Quando o item é relevante pro contexto ativo |
| **L2 — Full** | ~1000-5000 tokens | Documentação completa, histórico, rationale detalhado | Apenas quando o agente está trabalhando diretamente naquele item |

**Regra de ouro**: O MCP server nunca carrega L2 sem pedido explícito. O default é L0 para listagem e L1 para contexto de trabalho.

### Como funciona na prática

Quando o Claude Code abre uma sessão de trabalho no AgentForge, o MCP Obsidian retorna:

```
L0 (automático): Lista de 74 agents, 14 squads, 5 projetos — ~500 tokens total
L1 (sob demanda): Contexto do AgentForge — últimas 3 decisões, estado atual, bloqueios — ~400 tokens
L2 (explícito): Doc completo do agent de WhatsApp scheduling — ~2000 tokens
```

Total para contexto de trabalho: **~900 tokens** ao invés de ~50.000 se carregasse tudo.

---

## 2. Estrutura do Vault

```
vault/
│
├── _synkra/                          # Core do AIOX
│   ├── _index.md                     # MOC master — gerado automaticamente
│   ├── agents/
│   │   ├── _index.md                 # MOC de agents com status
│   │   ├── copywriter-hooks.md
│   │   ├── voice-cloner.md
│   │   └── ...
│   ├── squads/
│   │   ├── _index.md
│   │   ├── squad-copywriting.md
│   │   └── ...
│   ├── pipelines/
│   │   ├── _index.md
│   │   ├── youtube-ingestion.md
│   │   └── ...
│   └── config/
│       ├── schemas.md                # Definição dos schemas de frontmatter
│       └── conventions.md            # Naming, linking, tagging rules
│
├── projects/                         # Um folder por projeto
│   ├── _index.md                     # MOC de projetos
│   ├── agentforge/
│   │   ├── _index.md                 # MOC do projeto
│   │   ├── overview.md               # L1 sempre atualizado
│   │   ├── architecture.md           # ADR consolidado
│   │   ├── decisions/                # Decision logs individuais
│   │   │   ├── 2026-03-01-isolated-infra.md
│   │   │   └── 2026-03-10-pricing-hybrid.md
│   │   ├── sessions/                 # Session logs (compactados)
│   │   │   ├── 2026-03-18-dashboard-api.md
│   │   │   └── ...
│   │   ├── components/               # Docs de cada componente
│   │   │   ├── evolution-api.md
│   │   │   ├── n8n-workflows.md
│   │   │   └── client-portal.md
│   │   └── handoffs/                 # Registros de handoff
│   │       └── 2026-03-18-copilot-to-backend.md
│   ├── aios/
│   │   └── ...
│   └── dna-mental/
│       └── ...
│
├── knowledge/                        # Base de conhecimento extraída
│   ├── _index.md
│   ├── experts/                      # Perfis de experts clonados
│   │   ├── expert-gary-halbert.md
│   │   └── ...
│   ├── frameworks/                   # Mental models extraídos
│   │   └── ...
│   └── sources/                      # Referências originais
│       └── ...
│
├── _logs/                            # Logs operacionais (auto-cleanup)
│   ├── sessions/                     # Raw session logs (TTL: 30 dias)
│   └── api-calls/                    # Call logs compactados (TTL: 7 dias)
│
└── _templates/                       # Obsidian Templater templates
    ├── tpl-agent.md
    ├── tpl-decision.md
    ├── tpl-session.md
    ├── tpl-handoff.md
    ├── tpl-component.md
    └── tpl-project-overview.md
```

### Regras de estrutura

- `_index.md` em cada folder = MOC (Map of Content) auto-gerado com Dataview
- Prefixo `_` = meta-files (não são conteúdo, são índices/config)
- `_logs/` tem TTL — um script cron compacta e arquiva logs antigos
- Cada projeto é self-contained: tudo que precisa pra entender o projeto está dentro do folder

---

## 3. Schemas de Frontmatter

### 3.1 Agent

```yaml
---
type: agent
id: agent-copywriter-hooks
name: "Copywriter — Hooks & Headlines"
squad: "[[squad-copywriting]]"
status: active | draft | deprecated
version: 2.1

# L0 — Uma linha (custo: ~30 tokens)
summary: "Gera hooks e headlines usando frameworks de Gary Halbert e David Ogilvy"

# L1 — Contexto operacional (custo: ~200 tokens)
capabilities:
  - headline_generation
  - hook_frameworks
  - a_b_variants
inputs:
  - product_description
  - target_audience
  - tone_profile
outputs:
  - headlines_ranked
  - hook_variations
dependencies:
  - "[[agent-voice-cloner]]"
  - "[[agent-audience-profiler]]"
model: claude-sonnet-4-20250514
max_tokens: 2000
temperature: 0.8

# Metadata
created: 2026-01-15
updated: 2026-03-18
last_run: 2026-03-17
run_count: 342
avg_tokens_per_run: 1850
tags: [copywriting, headlines, hooks]
---
```

### 3.2 Squad

```yaml
---
type: squad
id: squad-copywriting
name: "Copywriting Squad"
status: active

summary: "Squad completo de copywriting: research → hooks → body copy → CTA → review"

agents:
  - "[[agent-copywriter-hooks]]"
  - "[[agent-copywriter-body]]"
  - "[[agent-cta-optimizer]]"
  - "[[agent-copy-reviewer]]"

pipeline_order:
  - agent-audience-profiler
  - agent-copywriter-hooks
  - agent-copywriter-body
  - agent-cta-optimizer
  - agent-copy-reviewer

orchestration: sequential | parallel | conditional
trigger: manual | scheduled | event
input_schema: "[[schema-copy-brief]]"
output_schema: "[[schema-copy-package]]"

created: 2026-01-20
updated: 2026-03-18
tags: [squad, copywriting]
---
```

### 3.3 Project

```yaml
---
type: project
id: project-agentforge
name: "AgentForge"
status: active
phase: mvp

summary: "SaaS de AI agents para WhatsApp focado em clínicas odontológicas. Infra isolada por cliente com n8n + Evolution API."

# Stack & Infra
stack:
  backend: [laravel, php, postgresql]
  frontend: [react, typescript]
  infra: [cloudfy, docker]
  integrations: [evolution-api, n8n, redis]

# Estado atual (L1 — atualizado a cada sessão)
current_focus: "Dashboard admin — API de métricas por cliente"
blockers: []
next_actions:
  - "Implementar endpoint de billing consolidado"
  - "Testar isolamento Redis por tenant"

# Referências
epics_total: 13
epics_done: 4
repo: "github.com/wesley/agentforge"
squads_involved:
  - "[[squad-backend]]"
  - "[[squad-whatsapp]]"

created: 2026-02-01
updated: 2026-03-18
tags: [project, saas, whatsapp, dental]
---
```

### 3.4 Decision Log (ADR — Architecture Decision Record)

```yaml
---
type: decision
id: dec-2026-03-01-isolated-infra
project: "[[project-agentforge]]"
status: accepted | proposed | superseded | deprecated

summary: "Infra isolada por cliente ao invés de multi-tenant compartilhado"

# Contexto compacto
decision: "Cada cliente recebe instância própria de n8n, Evolution API e Redis no Cloudfy"
rationale: "Isolamento total evita blast radius, simplifica debugging, permite pricing por uso real"
alternatives_considered:
  - "Multi-tenant com namespacing — descartado por complexidade de isolamento de dados"
  - "Kubernetes per-tenant — descartado por custo operacional nessa fase"
consequences:
  - "Custo de infra mais alto por cliente (~R$47/mês base)"
  - "Provisioning automatizado necessário desde o dia 1"
  - "Scaling horizontal trivial"

# Quem decidiu
decided_by: wesley
participants: [claude-code, supreme-ralph]
date: 2026-03-01
supersedes: null
superseded_by: null
tags: [architecture, infrastructure, multi-tenant]
---
```

### 3.5 Session Log

```yaml
---
type: session
id: sess-2026-03-18-1422
project: "[[project-agentforge]]"
date: 2026-03-18T14:22:00-03:00
duration_minutes: 45

summary: "Implementação do endpoint de métricas agregadas por cliente no dashboard admin"

# O que foi feito (L1)
actions:
  - "Criado controller MetricsController com endpoints por tenant"
  - "Query otimizada com CTE para agregação de mensagens/dia"
  - "Adicionado cache Redis com TTL de 5 min para métricas pesadas"

# Decisões tomadas durante a sessão
decisions_made:
  - "[[dec-2026-03-18-metrics-cache]]"

# Artifacts gerados
files_changed:
  - "app/Http/Controllers/Admin/MetricsController.php"
  - "app/Services/TenantMetricsService.php"
  - "database/migrations/2026_03_18_add_metrics_views.php"

# Contexto de continuidade
next_session_context: "Falta implementar o endpoint de billing e conectar com o frontend React. O TenantMetricsService já retorna dados formatados."

# Tokens consumidos
tokens_input: 12400
tokens_output: 8300

executor: claude-code
tags: [session, backend, metrics, dashboard]
---
```

### 3.6 Handoff

```yaml
---
type: handoff
id: ho-2026-03-18-copilot-to-backend
date: 2026-03-18T16:00:00-03:00
project: "[[project-agentforge]]"

summary: "Handoff do design do dashboard (Copilot) para implementação backend (Claude Code)"

from_agent: copilot-ui-designer
to_agent: claude-code-backend
reason: "UI specs finalizadas, pronto para implementação de API"

# Pacote de contexto transferido
context_transferred:
  - "Wireframes do dashboard admin com 4 telas"
  - "Componentes React definidos: TenantCard, MetricsGrid, BillingTable"
  - "API contract: GET /api/admin/tenants/{id}/metrics"

# O que o receptor precisa saber
key_constraints:
  - "Manter response shape exatamente como definido no contract"
  - "Métricas devem ser cacheáveis — frontend faz polling a cada 30s"

# Estado no momento do handoff
state_snapshot:
  completed: ["UI wireframes", "component tree", "API contract"]
  pending: ["backend endpoints", "database views", "Redis cache layer"]

depends_on:
  - "[[sess-2026-03-17-ui-specs]]"
  - "[[dec-2026-03-01-isolated-infra]]"
tags: [handoff, dashboard, backend]
---
```

### 3.7 Component

```yaml
---
type: component
id: comp-evolution-api
project: "[[project-agentforge]]"
name: "Evolution API"
layer: integration

summary: "Gateway de WhatsApp — gerencia conexões, envio/recebimento de mensagens, webhooks"

# Specs técnicas (L1)
version: "2.x"
role: "WhatsApp Business API gateway"
ports:
  api: 8080
  webhook: 8081
environment: docker
depends_on:
  - "[[comp-redis]]"
  - "[[comp-postgresql]]"

# Interfaces
api_endpoints:
  - "POST /message/sendText"
  - "POST /instance/create"
  - "GET /instance/connectionState"
webhook_events:
  - "messages.upsert"
  - "connection.update"

# Configuração por tenant
per_tenant: true
isolation_method: "container separado por cliente"
provisioning: "[[pipeline-tenant-provisioning]]"

# Problemas conhecidos
known_issues:
  - "Reconexão após 24h de inatividade precisa de retry manual"
  - "Rate limit da Meta: 1000 msgs/dia por número novo"

created: 2026-02-10
updated: 2026-03-18
tags: [component, whatsapp, integration, api]
---
```

---

## 4. Sistema de _index.md (MOCs Auto-gerados)

Cada `_index.md` usa **Dataview** do Obsidian para gerar tabelas dinâmicas. Exemplo do `_synkra/agents/_index.md`:

```markdown
# Agents Index

## Agents Ativos
```dataview
TABLE summary AS "Função", squad AS "Squad", last_run AS "Último Run", run_count AS "Runs"
FROM "_synkra/agents"
WHERE type = "agent" AND status = "active"
SORT last_run DESC
```

## Agents em Draft
```dataview
LIST summary
FROM "_synkra/agents"
WHERE type = "agent" AND status = "draft"
```

## Stats
- Total: `= length(filter(this.file.folder, (f) => f.type = "agent"))`
- Ativos: ...
```

Esses MOCs servem como **L0 visual** — abrir o Obsidian e ver tudo de relance sem carregar contexto pesado.

---

## 5. Context Loading Protocol (MCP)

O MCP server do Obsidian expõe estas tools:

### 5.1 Tools do MCP Server

```
obsidian_list(folder, filters)
  → Retorna L0 de todos os items no folder
  → Custo: ~2 tokens por item
  → Uso: Orientação inicial, "o que existe?"

obsidian_context(id)
  → Retorna frontmatter completo (L1) sem o body
  → Custo: ~100-300 tokens por item
  → Uso: Carregar contexto de trabalho

obsidian_read(id)
  → Retorna documento completo (L2)
  → Custo: ~1000-5000 tokens
  → Uso: Quando precisa do detalhe total

obsidian_write(id, content, section?)
  → Cria ou atualiza nota (ou seção específica)
  → Pode atualizar só o frontmatter sem tocar no body

obsidian_search(query, scope?)
  → Busca full-text no vault ou em escopo específico
  → Retorna L0 dos resultados

obsidian_recent(type, project?, limit=5)
  → Últimas N notas de um tipo (sessions, decisions, handoffs)
  → Retorna L1 de cada
```

### 5.2 Fluxo de Context Loading

```
1. INÍCIO DE SESSÃO
   │
   ├─ obsidian_list("projects") ──────────────── ~100 tokens
   │  "Qual projeto vamos trabalhar?"
   │
   ├─ obsidian_context("project-agentforge") ─── ~300 tokens
   │  "Qual o estado atual? Foco? Blockers?"
   │
   ├─ obsidian_recent("session", "agentforge") ─ ~500 tokens
   │  "O que foi feito nas últimas sessões?"
   │
   └─ TOTAL CONTEXT LOAD: ~900 tokens
      (vs ~50.000 se carregasse tudo)

2. DURANTE O TRABALHO
   │
   ├─ obsidian_context("comp-evolution-api") ─── sob demanda
   │  Só quando precisa de specs de um componente
   │
   └─ obsidian_read("dec-2026-03-01-...") ────── raramente
      Só quando precisa do rationale completo de uma decisão

3. FIM DE SESSÃO
   │
   ├─ obsidian_write("sess-2026-03-18-...") ──── Session log
   ├─ obsidian_write("project-agentforge") ────── Atualiza current_focus e next_actions
   └─ obsidian_write("dec-..." ) ──────────────── Se houve decisão nova
```

---

## 6. Logging Inteligente — O que registrar e o que não registrar

### Registrar SEMPRE (memória de longo prazo)
- **Decisões** arquiteturais e de negócio (ADRs) — permanente
- **Handoffs** entre agentes/sessões — permanente
- **Estado do projeto** (overview) — atualizado a cada sessão
- **Componentes** e suas interfaces — atualizado quando muda

### Registrar com TTL (memória de médio prazo)
- **Session logs** — manter últimos 30 dias, depois compactar em weekly digest
- **Mudanças de arquivo** — manter último mês, depois só o diffstat

### NÃO registrar
- Prompts raw completos (caro demais em storage e inútil como referência)
- Outputs intermediários de agentes (só o resultado final)
- Erros de execução triviais (só erros que geraram decisão de mudança)
- Conversas exploratórias que não geraram decisão

### Compactação automática

Script semanal que roda como cron:

```
_logs/sessions/ (> 30 dias)
  → Extrai: summary + decisions_made + files_changed
  → Gera: _logs/digests/week-2026-W11.md
  → Deleta session original

_logs/api-calls/ (> 7 dias)
  → Extrai: total_tokens, total_calls, erros
  → Agrega em: _logs/digests/api-week-2026-W11.md
  → Deleta logs originais
```

---

## 7. Templates (Obsidian Templater)

### tpl-session.md

```markdown
---
type: session
id: sess-<% tp.date.now("YYYY-MM-DD-HHmm") %>
project: "[[]]"
date: <% tp.date.now("YYYY-MM-DDTHH:mm:ssZ") %>
duration_minutes:

summary: ""

actions: []
decisions_made: []
files_changed: []
next_session_context: ""
tokens_input:
tokens_output:
executor:
tags: [session]
---

## Notas

<!-- Corpo livre para anotações detalhadas se necessário (L2) -->
```

### tpl-decision.md

```markdown
---
type: decision
id: dec-<% tp.date.now("YYYY-MM-DD") %>-
project: "[[]]"
status: proposed

summary: ""

decision: ""
rationale: ""
alternatives_considered: []
consequences: []
decided_by: wesley
participants: []
date: <% tp.date.now("YYYY-MM-DD") %>
supersedes:
superseded_by:
tags: [decision]
---

## Contexto Detalhado

<!-- L2 — Análise completa, prós/contras, referências -->
```

### tpl-handoff.md

```markdown
---
type: handoff
id: ho-<% tp.date.now("YYYY-MM-DD") %>-
date: <% tp.date.now("YYYY-MM-DDTHH:mm:ssZ") %>
project: "[[]]"

summary: ""

from_agent:
to_agent:
reason: ""
context_transferred: []
key_constraints: []
state_snapshot:
  completed: []
  pending: []
depends_on: []
tags: [handoff]
---

## Detalhes

<!-- L2 — Notas adicionais sobre o handoff -->
```

---

## 8. Convenções de Naming e Linking

### IDs

| Tipo | Padrão | Exemplo |
|------|--------|---------|
| Agent | `agent-{função-curta}` | `agent-copywriter-hooks` |
| Squad | `squad-{domínio}` | `squad-copywriting` |
| Project | `project-{nome}` | `project-agentforge` |
| Decision | `dec-{YYYY-MM-DD}-{slug}` | `dec-2026-03-01-isolated-infra` |
| Session | `sess-{YYYY-MM-DD-HHmm}` | `sess-2026-03-18-1422` |
| Handoff | `ho-{YYYY-MM-DD}-{slug}` | `ho-2026-03-18-copilot-to-backend` |
| Component | `comp-{nome}` | `comp-evolution-api` |
| Pipeline | `pipeline-{nome}` | `pipeline-youtube-ingestion` |

### Links

- Usar `[[id]]` para links internos (Obsidian resolve automaticamente)
- Em frontmatter YAML, usar `"[[id]]"` com aspas
- Links em listas de dependências criam edges no Graph View

### Tags

Hierárquicas quando faz sentido:
- `#project/agentforge`
- `#decision/architecture`
- `#agent/copywriting`

Flat para cross-cutting:
- `#blocked`, `#urgent`, `#deprecated`

---

## 9. Graph View — Visualização Automática

Com essa estrutura, o Graph View do Obsidian mostra automaticamente:

- **Clusters por projeto** — todos os items de um projeto linkam ao `_index.md`
- **Dependências entre agents** — via campo `dependencies` com `[[links]]`
- **Cadeia de decisões** — `supersedes` / `superseded_by` formam timeline
- **Fluxo de handoffs** — `from_agent` → `to_agent` com `depends_on` mostrando contexto
- **Componentes e integrações** — `depends_on` entre componentes mostra a arquitetura real

### Filtros úteis no Graph

- `type:agent AND status:active` → Mapa de agents ativos
- `type:decision AND project:agentforge` → Timeline de decisões do projeto
- `type:handoff` com `path:` filtrado → Fluxo de trabalho entre agents
- `tag:#blocked` → O que está travado

---

## 10. Setup Checklist

### Fase 1 — Fundação (Dia 1)

- [ ] Criar vault Obsidian com estrutura de folders acima
- [ ] Instalar plugins: Dataview, Templater, Graph Analysis
- [ ] Copiar templates para `_templates/`
- [ ] Configurar `schemas.md` e `conventions.md`
- [ ] Instalar Obsidian MCP Server (ex: `obsidian-mcp` do npm)
- [ ] Configurar `~/.claude/mcp.json` apontando pro vault

### Fase 2 — População Inicial (Dias 2-3)

- [ ] Migrar agent `.md` files existentes do AIOS para o vault com frontmatter padronizado
- [ ] Criar docs de cada squad com pipeline_order definido
- [ ] Documentar componentes dos projetos ativos (AgentForge, AIOS, DNA Mental)
- [ ] Criar overview de cada projeto com estado atual

### Fase 3 — Integração com SynkraAIOX (Semana 2)

- [ ] Criar MCP server custom do SynkraAIOX
- [ ] Implementar o Context Loading Protocol (seção 5)
- [ ] Configurar auto-write de session logs no fim de cada sessão
- [ ] Testar ciclo completo: ler contexto → trabalhar → escrever log

### Fase 4 — Automação e Manutenção (Semana 3+)

- [ ] Script de compactação de logs (cron semanal)
- [ ] Dataview queries nos `_index.md` de cada folder
- [ ] Dashboard de tokens consumidos por projeto/agent
- [ ] Pipeline de update automático do overview do projeto pós-sessão

---

## 11. Exemplo de Fluxo Completo

```
Wesley: "Continua o trabalho no dashboard do AgentForge"

Claude Code:
  1. obsidian_context("project-agentforge")
     → current_focus: "Dashboard admin — API de métricas por cliente"
     → next_actions: ["endpoint de billing", "teste isolamento Redis"]

  2. obsidian_recent("session", "agentforge", 2)
     → sess-2026-03-18: "Criou MetricsController, cache Redis 5min"
     → sess-2026-03-17: "UI specs finalizados, API contract definido"

  3. obsidian_context("comp-evolution-api")
     → Portas, endpoints, known issues
     (carregado porque o billing precisa de dados de uso do WhatsApp)

  4. [TRABALHO — implementa o endpoint de billing]

  5. obsidian_write("sess-2026-03-18-1630", {
       summary: "Implementação do BillingController...",
       actions: [...],
       decisions_made: ["dec-2026-03-18-billing-per-message"],
       next_session_context: "Falta conectar com Stripe webhook..."
     })

  6. obsidian_write("project-agentforge", {
       current_focus: "Integração Stripe para billing automatizado",
       next_actions: ["Stripe webhook", "Tela de billing no portal do cliente"]
     })
     → Atualiza só o frontmatter, não toca no body

Total de tokens gastos com memória nessa sessão: ~1.200
Contexto preservado para próxima sessão: 100%
```

---

## Notas Finais

**Sobre token efficiency**: O segredo não é economizar em tudo — é gastar tokens nos momentos certos. Um ADR bem escrito de 500 tokens que evita refazer uma decisão economiza 50.000 tokens de retrabalho. O `next_session_context` de 100 tokens no session log economiza 10 minutos de "onde paramos?".

**Sobre o Graph View**: Não tente visualizar tudo de uma vez. Use filtros. O graph completo com 200+ notas é ruído. O graph filtrado por projeto + tipo é sinal puro.

**Sobre manutenção**: O sistema se paga sozinho se a disciplina de logging for mantida. O cron de compactação garante que o vault não cresce infinitamente. Se parar de logar, o sistema degrada gracefully — as decisões e componentes continuam válidos, só perde o histórico de sessões.
