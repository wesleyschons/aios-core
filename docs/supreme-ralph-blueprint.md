# 🧠 SUPREME RALPH — Blueprint de Orquestração Autônoma
## Integração Total com AIOS Pipeline

---

## 1. Mapa do Ecossistema Ralph (15+ Implementações Analisadas)

### Tier S — Os Melhores (features que PRECISAMOS absorver)

| Projeto | Linguagem | Killer Feature | Link |
|---------|-----------|----------------|------|
| **ralph-orchestrator** (mikeyobrien) | Rust | Hat System (personas especializadas), 7 backends, TUI em tempo real, Telegram bot para HITL, 31 presets, parallel loops via git worktrees | [repo](https://github.com/mikeyobrien/ralph-orchestrator) |
| **multi-agent-ralph-loop** (alfredolopez80) | Bash/Claude Code | Agent Teams (coder, reviewer, tester, researcher), classificação de complexidade 1-10, memory-driven planning, security validation Grade A- | [repo](https://github.com/alfredolopez80/multi-agent-ralph-loop) |
| **smart-ralph** (tzachbon) | Claude Code Plugin | Spec-driven workflow (research → requirements → design → tasks), codebase indexing para descoberta automática, smart compaction | [repo](https://github.com/tzachbon/smart-ralph) |
| **ralph-tui** (subsy) | TypeScript/Bun | Parallel execution com git worktrees, dependency graph analysis, subagent tracing, remote instance management via WebSocket, session persistence | [repo](https://github.com/subsy/ralph-tui) |

### Tier A — Features Valiosas para Compor

| Projeto | Killer Feature |
|---------|----------------|
| **frankbria/ralph-claude-code** | Circuit breaker avançado, dual-condition exit gate, rate limiting com hourly reset, 5-hour API limit handling, 566 tests |
| **ralph-loop-agent** (Vercel Labs) | SDK wrapper com verifyCompletion callback, context summarization, streaming support, feedback injection |
| **ralph-wiggum** (fstandhartinger) | Constitution-based (single source of truth), multi-tool (Claude/Codex/Gemini/Copilot), stuck detection após 10 tentativas, Telegram |
| **ralph-inferno** (sandstream) | Deploy em VM descartável (Hetzner), greenfield + brownfield workflows, BMAD brainstorm → PRD pipeline |
| **daegwang/ralph-code** | Mix agents (Claude planning + Codex execution), auto retry com max 3 tentativas, git diff como contexto |
| **Goose Ralph Loop** (Block) | Cross-model review (worker ≠ reviewer), recipe-based workflows |
| **iannuttall/ralph** | Multi-agent support (codex/claude/droid/opencode), file-based minimal design |
| **oh-my-ralph** | Python implementation, opinionated defaults |

### Tier B — Conceitos Teóricos Importantes

| Fonte | Conceito Chave |
|-------|----------------|
| **ralph-playbook** (ClaytonFarr) | "Sit on the loop, not in it", signs & gates, tuning like a guitar |
| **Geoffrey Huntley (original)** | "Deterministically bad in an undeterministic world", backpressure theory, context allocation |
| **awesome-ralph** (snwfdhmp) | Lista curada completa, r/ralphcoding, Discord community |

---

## 2. DNA do Supreme Ralph — Features Extraídas

Cada feature abaixo foi selecionada da melhor implementação existente:

### 🔄 Core Loop Engine
- **Fresh context por iteração** (todos os Ralphs concordam — é o fundamento)
- **Dual exit gate**: completion indicators + explicit EXIT_SIGNAL (frankbria)
- **Circuit breaker**: detecção de loops infinitos com two-stage error filtering (frankbria)
- **Auto retry**: até N tentativas antes de marcar como stuck (daegwang + fstandhartinger)
- **Stuck detection**: após X tentativas sem progresso, split automático da task (fstandhartinger)

### 🎩 Hat System — Personas Especializadas (ralph-orchestrator)
- **Architect Hat** 🏗️ — Design decisions, architecture review
- **Builder Hat** 🔨 — Implementation, coding
- **Tester Hat** 🧪 — Test writing, QA verification
- **Reviewer Hat** 👀 — Code review, quality gates
- **Researcher Hat** 🔍 — Codebase exploration, API research
- **Eventos tipados** entre hats com glob pattern matching
- Cada hat pode usar um **backend/modelo diferente**

### 🧠 Memory & Learning System
- **progress.txt** append-only (padrão original)
- **Codebase Patterns** section consolidada no topo (snarktank)
- **AGENTS.md / CLAUDE.md** updates automáticos por diretório (snarktank)
- **Scratchpad** compartilhado entre iterações (ralph-orchestrator)
- **Memory ledgers** persistentes por sessão (multi-agent-ralph-loop)
- **Codebase indexing** — scan automático de componentes existentes (smart-ralph)

### 📋 Spec-Driven Workflow
- **Research → Requirements → Design → Tasks** pipeline (smart-ralph)
- **Constitution** como single source of truth (ralph-wiggum)
- **PRD → prd.json** conversão automatizada (snarktank)
- **BMAD brainstorm** para greenfield (ralph-inferno)
- **Change Request** flow para brownfield (ralph-inferno)

### ⚡ Parallel Execution
- **Git worktrees** para isolamento de workers (ralph-tui + ralph-orchestrator)
- **Dependency graph analysis** automática (ralph-tui)
- **Auto-detect** quando parallelismo vale a pena (ralph-tui)
- **Merge sequencial** de volta ao main (ralph-tui)

### 🔒 Safety & Quality Gates (Backpressure)
- **Tests must pass** antes de commit
- **Lint/typecheck** obrigatório
- **Rate limiting** com hourly reset configurável (frankbria)
- **5-hour API limit** handling com auto-wait (frankbria)
- **Security validation** Grade A- (multi-agent-ralph-loop)
- **Cost tracking** por iteração (ralph-starter)

### 🖥️ Monitoring & HITL (Human-in-the-Loop)
- **TUI em tempo real** com ratatui (ralph-orchestrator)
- **Web dashboard** com Rust RPC API + frontend (ralph-orchestrator)
- **Telegram bot** — agent faz perguntas, human responde (ralph-orchestrator + ralph-wiggum)
- **Remote instance management** via WebSocket (ralph-tui)
- **Subagent tracing** em tempo real (ralph-tui)

### 🔀 Cross-Model Review
- **Worker model ≠ Reviewer model** (Goose Ralph Loop)
- **Planning model ≠ Execution model** (daegwang/ralph-code)
- **Model routing** baseado em complexidade (multi-agent-ralph-loop)

---

## 3. Arquitetura do Supreme Ralph + AIOS

```
┌─────────────────────────────────────────────────────────────────┐
│                        AIOS PIPELINE                            │
│                   (Orquestrador Macro)                          │
│                                                                 │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐ │
│  │    SM     │───▶│    PO    │───▶│   DEV    │───▶│    QA    │ │
│  │  Scrum    │    │ Product  │    │          │    │ Quality  │ │
│  │  Master   │    │  Owner   │    │ SUPREME  │    │Assurance │ │
│  └──────────┘    └──────────┘    │  RALPH   │    └──────────┘ │
│                                   │    ↓     │                  │
│                                   └──────────┘                  │
└─────────────────────────────────────────────────────────────────┘
                                        │
                    ┌───────────────────┘
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                     SUPREME RALPH ENGINE                        │
│              (Orquestrador Micro — Loop Autônomo)               │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   CONTROL PLANE                          │   │
│  │                                                          │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────────┐    │   │
│  │  │ Task Queue │  │  Circuit   │  │  Rate Limiter  │    │   │
│  │  │ + Priority │  │  Breaker   │  │  + Cost Track  │    │   │
│  │  └────────────┘  └────────────┘  └────────────────┘    │   │
│  │                                                          │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────────┐    │   │
│  │  │ Dependency │  │   Stuck    │  │   Parallel     │    │   │
│  │  │   Graph    │  │ Detector   │  │   Scheduler    │    │   │
│  │  └────────────┘  └────────────┘  └────────────────┘    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    HAT SYSTEM                            │   │
│  │                                                          │   │
│  │   🏗️ Architect    🔨 Builder    🧪 Tester               │   │
│  │   👀 Reviewer     🔍 Researcher  📊 Analyst             │   │
│  │                                                          │   │
│  │   Cada hat = prompt especializado + modelo otimizado     │   │
│  │   Comunicação via eventos tipados                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                  EXECUTION LAYER                         │   │
│  │                                                          │   │
│  │   Worker 1 (worktree) ──┐                               │   │
│  │   Worker 2 (worktree) ──┼── merge → main                │   │
│  │   Worker 3 (worktree) ──┘                               │   │
│  │                                                          │   │
│  │   Backend: Claude Code (primary)                         │   │
│  │   Review:  Modelo diferente do worker                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                  MEMORY LAYER                            │   │
│  │                                                          │   │
│  │   Git History ← commits incrementais por task           │   │
│  │   progress.txt ← append-only learnings                  │   │
│  │   prd.json ← estado das stories (passes: true/false)    │   │
│  │   CLAUDE.md ← patterns por diretório                    │   │
│  │   scratchpad.md ← memória compartilhada entre hats      │   │
│  │   codebase-index/ ← componentes descobertos             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                MONITORING & HITL                          │   │
│  │                                                          │   │
│  │   📊 Dashboard Web (real-time pipeline state)            │   │
│  │   🖥️ TUI Terminal (iteration status, hat activity)       │   │
│  │   📱 Telegram Bot (perguntas, status, /abort)            │   │
│  │   📡 WebSocket (remote monitoring)                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              BACKPRESSURE GATES                           │   │
│  │                                                          │   │
│  │   Gate 1: ✅ Tests pass (phpunit/pest)                   │   │
│  │   Gate 2: ✅ Lint pass (phpstan/pint)                    │   │
│  │   Gate 3: ✅ Type check                                  │   │
│  │   Gate 4: ✅ Cross-model review approval                 │   │
│  │   Gate 5: ✅ Security scan                               │   │
│  │   Gate 6: ✅ Browser verification (para UI stories)      │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Interfaces de Integração AIOS ↔ Supreme Ralph

### 4.1 Input: PO → Supreme Ralph

O agente PO do AIOS gera um `prd.json` no formato que o Supreme Ralph consome:

```json
{
  "projectName": "mind-mapper-feature-x",
  "branchName": "ralph/feature-x",
  "priority": "high",
  "context": {
    "stack": "Laravel/PHP + PostgreSQL + Vue.js",
    "conventions": "PSR-12, Eloquent patterns, eloquent-filter",
    "existing_patterns": ["chunked uploads", "read/write DB splitting"]
  },
  "userStories": [
    {
      "id": "US-001",
      "title": "Add user preference model",
      "description": "Create migration + Eloquent model for user preferences",
      "acceptanceCriteria": [
        "Migration creates preferences table with user_id FK",
        "Model has proper fillable, casts, and relationships",
        "phpunit tests pass for CRUD operations"
      ],
      "priority": 1,
      "complexity": 3,
      "passes": false,
      "hat": "builder",
      "parallelGroup": "A"
    },
    {
      "id": "US-002",
      "title": "Add preference API endpoints",
      "description": "RESTful controller with validation",
      "acceptanceCriteria": [
        "GET/POST/PUT/DELETE endpoints work",
        "FormRequest validation in place",
        "Feature tests pass"
      ],
      "priority": 2,
      "complexity": 4,
      "passes": false,
      "hat": "builder",
      "dependsOn": ["US-001"],
      "parallelGroup": "B"
    }
  ]
}
```

### 4.2 Output: Supreme Ralph → QA

Após completar todas as stories, Ralph gera um relatório para o agente QA do AIOS:

```json
{
  "status": "COMPLETE",
  "branch": "ralph/feature-x",
  "completedStories": ["US-001", "US-002"],
  "failedStories": [],
  "stuckStories": [],
  "totalIterations": 7,
  "totalCost": "$2.47",
  "commits": [
    "abc123 - feat: US-001 - Add user preference model",
    "def456 - feat: US-002 - Add preference API endpoints"
  ],
  "testResults": {
    "total": 24,
    "passed": 24,
    "failed": 0,
    "coverage": "87%"
  },
  "learnings": [
    "Eloquent cast para JSON arrays precisa de explicit array cast",
    "FormRequest authorize() deve retornar true para routes autenticadas"
  ],
  "reviewApproved": true,
  "securityScanPassed": true
}
```

### 4.3 Status: Supreme Ralph → AIOS Dashboard

Em tempo real via WebSocket:

```json
{
  "event": "iteration_update",
  "data": {
    "iteration": 3,
    "maxIterations": 20,
    "currentStory": "US-002",
    "currentHat": "🔨 builder",
    "status": "implementing",
    "elapsed": "00:04:23",
    "parallelWorkers": 2,
    "workerStatus": [
      { "id": 1, "story": "US-003", "status": "testing" },
      { "id": 2, "story": "US-004", "status": "implementing" }
    ]
  }
}
```

---

## 5. Estrutura de Arquivos do Projeto

```
supreme-ralph/
├── bin/
│   └── ralph                    # CLI entry point
├── src/
│   ├── core/
│   │   ├── loop.sh              # Main execution loop
│   │   ├── circuit-breaker.sh   # Failure detection & recovery
│   │   ├── rate-limiter.sh      # API rate management
│   │   └── cost-tracker.sh      # Token/cost monitoring
│   ├── hats/
│   │   ├── architect.md         # Architecture review prompt
│   │   ├── builder.md           # Implementation prompt
│   │   ├── tester.md            # Test writing prompt
│   │   ├── reviewer.md          # Code review prompt
│   │   └── researcher.md        # Codebase exploration prompt
│   ├── memory/
│   │   ├── progress-manager.sh  # progress.txt operations
│   │   ├── pattern-extractor.sh # Consolidate codebase patterns
│   │   ├── indexer.sh           # Codebase component indexing
│   │   └── scratchpad.sh        # Shared memory between hats
│   ├── parallel/
│   │   ├── worktree-manager.sh  # Git worktree lifecycle
│   │   ├── dependency-graph.sh  # Task dependency analysis
│   │   └── merge-manager.sh     # Sequential merge back
│   ├── quality/
│   │   ├── gates.sh             # Backpressure gate runner
│   │   ├── cross-review.sh      # Cross-model review logic
│   │   └── security-scan.sh     # Security validation
│   ├── monitoring/
│   │   ├── websocket-server.sh  # Real-time status broadcast
│   │   ├── telegram-bot.sh      # HITL via Telegram
│   │   └── reporter.sh          # Generate completion reports
│   └── aios/
│       ├── adapter-in.sh        # PO → Ralph format converter
│       ├── adapter-out.sh       # Ralph → QA report generator
│       └── status-bridge.sh     # Real-time status to AIOS dashboard
├── config/
│   ├── ralph.yml                # Main configuration
│   ├── hats.yml                 # Hat definitions & event routing
│   ├── gates.yml                # Quality gate definitions
│   └── models.yml               # Model routing per hat/task
├── templates/
│   ├── CLAUDE.md                # Base prompt for Claude Code
│   ├── prd.json.template        # PRD template
│   └── progress.txt.template    # Progress log template
├── skills/
│   ├── prd/                     # PRD generation skill
│   ├── ralph/                   # PRD → JSON conversion skill
│   └── index/                   # Codebase indexing skill
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
└── docs/
    ├── ARCHITECTURE.md
    ├── CONFIGURATION.md
    └── AIOS-INTEGRATION.md
```

---

## 6. Configuração Principal (ralph.yml)

```yaml
# Supreme Ralph Configuration
version: "1.0.0"

# === AIOS Integration ===
aios:
  enabled: true
  dashboard_url: "ws://localhost:3000/ralph-status"
  input_format: "prd.json"   # PO generates this
  output_format: "report.json" # QA consumes this

# === Execution ===
execution:
  max_iterations: 50
  max_runtime_minutes: 240     # 4 hours
  idle_timeout_minutes: 30
  retry_per_task: 3
  stuck_threshold: 10          # attempts before flagging

# === Parallel Execution ===
parallel:
  enabled: true
  mode: "auto"                 # auto | forced | sequential
  max_workers: 4
  isolation: "worktree"        # worktree | branch

# === Models ===
models:
  planning: "claude-opus-4-6"
  building: "claude-sonnet-4-5-20250929"
  reviewing: "claude-opus-4-6"   # Different from builder!
  testing: "claude-sonnet-4-5-20250929"

# === Quality Gates ===
gates:
  - name: "tests"
    command: "php artisan test --parallel"
    required: true
  - name: "lint"
    command: "vendor/bin/pint --test"
    required: true
  - name: "phpstan"
    command: "vendor/bin/phpstan analyse"
    required: true
  - name: "cross-review"
    enabled: true
    model: "claude-opus-4-6"
  - name: "security"
    command: "vendor/bin/security-checker"
    required: false

# === Rate Limiting ===
rate_limiting:
  max_calls_per_hour: 100
  pause_on_5h_limit: true
  auto_wait: true

# === Circuit Breaker ===
circuit_breaker:
  consecutive_failures: 5
  reset_timeout_minutes: 10
  error_patterns:
    - "context_length_exceeded"
    - "rate_limit"
    - "overloaded"

# === Monitoring ===
monitoring:
  telegram:
    enabled: true
    bot_token: "${RALPH_TELEGRAM_TOKEN}"
    chat_id: "${RALPH_TELEGRAM_CHAT}"
  websocket:
    enabled: true
    port: 8765
  tui:
    enabled: true

# === Memory ===
memory:
  progress_file: "progress.txt"
  scratchpad: ".ralph/scratchpad.md"
  codebase_index: ".ralph/index/"
  pattern_consolidation: true
  agents_md_updates: true

# === Stack-Specific (Laravel) ===
stack:
  framework: "laravel"
  test_runner: "pest"
  formatter: "pint"
  analyzer: "phpstan"
  conventions:
    - "PSR-12 coding style"
    - "Eloquent for all DB operations"
    - "FormRequest for validation"
    - "Feature tests for all endpoints"
```

---

## 7. Plano de Implementação

### Fase 1: Core Loop (Semana 1)
- [ ] Fork do `snarktank/ralph` como base
- [ ] Implementar circuit breaker (baseado no frankbria)
- [ ] Implementar dual exit gate
- [ ] Implementar stuck detection + auto-retry
- [ ] Adapter AIOS input (PO → prd.json)
- [ ] Adapter AIOS output (Ralph → QA report)
- [ ] Testes unitários do core loop

### Fase 2: Hat System (Semana 2)
- [ ] Implementar Hat Engine (baseado no ralph-orchestrator)
- [ ] Criar prompts para cada hat (architect, builder, tester, reviewer, researcher)
- [ ] Event system tipado entre hats
- [ ] Model routing por hat (builder=sonnet, reviewer=opus)
- [ ] Cross-model review gate

### Fase 3: Parallel Execution (Semana 3)
- [ ] Git worktree manager
- [ ] Dependency graph parser do prd.json
- [ ] Parallel scheduler com auto-detect
- [ ] Merge manager com conflict resolution
- [ ] Testes de integração paralela

### Fase 4: Memory & Learning (Semana 4)
- [ ] Codebase indexer (baseado no smart-ralph)
- [ ] Pattern extractor + consolidation
- [ ] Scratchpad compartilhado
- [ ] AGENTS.md auto-update por diretório
- [ ] Learning transfer entre runs

### Fase 5: Monitoring & HITL (Semana 5)
- [ ] WebSocket server para AIOS dashboard
- [ ] Telegram bot integration
- [ ] TUI terminal (se quiser local)
- [ ] Real-time cost tracking
- [ ] Completion reporting

### Fase 6: Integration Testing (Semana 6)
- [ ] End-to-end: AIOS SM → PO → Supreme Ralph → QA
- [ ] Overnight autonomous run test
- [ ] Stress test com 20+ stories
- [ ] Cost optimization
- [ ] Documentation

---

## 8. Comandos do Supreme Ralph

```bash
# Inicializar no projeto
supreme-ralph init --stack laravel --aios

# Rodar a partir do prd.json (modo AIOS)
supreme-ralph run --input prd.json --tool claude

# Rodar com paralelismo forçado
supreme-ralph run --parallel 4 --input prd.json

# Rodar com TUI
supreme-ralph run --tui --input prd.json

# Indexar codebase existente
supreme-ralph index --path src/

# Gerar PRD a partir de descrição
supreme-ralph prd "Add user authentication with JWT"

# Status via CLI
supreme-ralph status

# Abortar
supreme-ralph abort

# Ver histórico de runs
supreme-ralph history
```

---

## 9. O que Torna Isso SUPREMO

| Aspecto | Ralph Original | Supreme Ralph |
|---------|---------------|---------------|
| Loop | Bash simples, sequencial | Circuit breaker, retry, stuck detection |
| Agentes | Single agent | Hat System com 6 personas especializadas |
| Execução | Sequencial | Parallel com git worktrees |
| Modelos | Um modelo | Multi-model (planning ≠ building ≠ reviewing) |
| Memory | progress.txt + git | Indexer + patterns + scratchpad + AGENTS.md |
| Quality | Tests pass ou fail | 6 gates (tests, lint, phpstan, review, security, browser) |
| Monitoring | Console output | Dashboard + TUI + Telegram + WebSocket |
| Integration | Standalone | Plugado no AIOS pipeline (SM→PO→Ralph→QA) |
| Autonomia | Até N iterações | Overnight com rate limit handling + auto-wait |
| Safety | Max iterations | Circuit breaker + cost tracking + dual exit gate |
