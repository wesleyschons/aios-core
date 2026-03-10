# 🎯 Supreme Ralph — AIOS Squad Implementation Context

> **Este arquivo é o contexto completo para o Claude Code implementar o Ralph como Squad plugável no AIOS Core.**
> Cole este conteúdo no CLAUDE.md do projeto ou use como prompt inicial.

---

## 📌 O QUE ESTAMOS CONSTRUINDO

**Supreme Ralph** é um Squad AIOS que adiciona capacidade de **loop autônomo de desenvolvimento** a qualquer projeto AIOS. Ele combina as melhores features de 15+ implementações Ralph da comunidade em um pacote plugável.

### Conceito Central
O Ralph é um loop que executa ciclos de desenvolvimento autonomamente:
```
LOOP: Analisar → Planejar → Executar → Validar → Commitar → Repetir
```

### Onde se encaixa no AIOS
```
AIOS Pipeline:  SM → PO → DEV → QA
                           ↑
                    Supreme Ralph (substitui/turbina o DEV)
                    - Loop autônomo com N iterações
                    - Parallel workers via git worktrees
                    - Hat System (6 personas especializadas)
                    - Memory layer persistente
                    - Quality gates automáticos
                    - Circuit breaker e rate limiting
```

---

## 📁 ESTRUTURA DO SQUAD (seguindo padrão AIOS)

O Ralph deve ser criado em `./squads/ralph/` seguindo o schema oficial:

```
squads/ralph/
├── squad.yaml                    # Manifest (OBRIGATÓRIO - segue schema AIOS)
├── README.md                     # Documentação do squad
├── LICENSE                       # MIT
├── user-guide.md                 # Guia de uso
│
├── config/
│   ├── ralph.yaml                # Configuração principal do Ralph
│   ├── hats.yaml                 # Definição dos 6 hats/personas
│   ├── models.yaml               # Roteamento de modelos por hat
│   ├── quality-gates.yaml        # Gates de qualidade
│   └── presets/                  # Presets pré-configurados
│       ├── default.yaml
│       ├── fast.yaml             # Menos iterações, mais rápido
│       ├── thorough.yaml         # Mais iterações, mais qualidade
│       └── overnight.yaml        # Modo autônomo longo
│
├── agents/
│   ├── ralph-orchestrator.md     # Agente principal - orquestrador do loop
│   ├── ralph-coder.md            # Hat: Coder - implementação
│   ├── ralph-reviewer.md         # Hat: Reviewer - code review
│   ├── ralph-tester.md           # Hat: Tester - testes
│   ├── ralph-researcher.md       # Hat: Researcher - pesquisa/análise
│   ├── ralph-architect.md        # Hat: Architect - decisões técnicas
│   └── ralph-debugger.md         # Hat: Debugger - fix de issues
│
├── tasks/
│   ├── ralph-loop.md             # Task principal: executa o loop completo
│   ├── ralph-init.md             # Task: inicializa Ralph no projeto
│   ├── ralph-resume.md           # Task: retoma loop de onde parou
│   ├── ralph-status.md           # Task: mostra status do loop
│   └── ralph-review.md           # Task: review do que o Ralph produziu
│
├── workflows/
│   ├── autonomous-loop.yaml      # Workflow: loop autônomo completo
│   ├── single-iteration.yaml     # Workflow: uma iteração só
│   ├── parallel-execution.yaml   # Workflow: execução paralela com worktrees
│   └── recovery.yaml             # Workflow: recuperação de falha
│
├── checklists/
│   ├── iteration-checklist.md    # Checklist por iteração
│   ├── quality-gate-checklist.md # Checklist de quality gates
│   └── completion-checklist.md   # Checklist de conclusão do loop
│
├── templates/
│   ├── progress.md               # Template: progress.txt do Ralph
│   ├── prd-input.md              # Template: PRD como input pro Ralph
│   ├── iteration-report.md       # Template: relatório por iteração
│   └── final-report.md           # Template: relatório final
│
├── tools/
│   ├── worktree-manager.js       # Tool: gerencia git worktrees
│   ├── loop-controller.js        # Tool: controle do loop (start/stop/pause)
│   ├── memory-manager.js         # Tool: CRUD de memória persistente
│   ├── backpressure-gate.js      # Tool: circuit breaker + rate limiting
│   └── monitor-hook.js           # Tool: hook de monitoramento SSE/WebSocket
│
├── scripts/
│   ├── setup.js                  # Script de setup pós-instalação
│   ├── validate.js               # Validação do squad
│   └── migrate.js                # Migração de versões anteriores
│
└── data/
    ├── default-presets.json       # Presets padrão
    ├── hat-prompts.json           # System prompts por hat
    └── quality-rules.json         # Regras de qualidade
```

---

## 📋 SQUAD.YAML (Manifest)

```yaml
name: ralph
version: 1.0.0
description: "Supreme Ralph - Autonomous Development Loop Engine for AIOS"
author: Wesley Schons
license: MIT
slashPrefix: ralph

aios:
  minVersion: '4.0.0'
  type: squad

components:
  agents:
    - ralph-orchestrator.md
    - ralph-coder.md
    - ralph-reviewer.md
    - ralph-tester.md
    - ralph-researcher.md
    - ralph-architect.md
    - ralph-debugger.md
  tasks:
    - ralph-loop.md
    - ralph-init.md
    - ralph-resume.md
    - ralph-status.md
    - ralph-review.md
  workflows:
    - autonomous-loop.yaml
    - single-iteration.yaml
    - parallel-execution.yaml
    - recovery.yaml
  checklists:
    - iteration-checklist.md
    - quality-gate-checklist.md
    - completion-checklist.md
  templates:
    - progress.md
    - prd-input.md
    - iteration-report.md
    - final-report.md
  tools:
    - worktree-manager.js
    - loop-controller.js
    - memory-manager.js
    - backpressure-gate.js
    - monitor-hook.js
  scripts:
    - setup.js
    - validate.js
    - migrate.js

config:
  extends: extend
  coding-standards: config/coding-standards.md
  tech-stack: config/tech-stack.md

dependencies:
  node: []
  python: []
  squads: []

tags:
  - autonomous-development
  - loop-engine
  - multi-agent
  - parallel-execution
  - ralph
```

---

## 🧬 DNA DO SUPREME RALPH (Features sintetizadas de 15+ repos)

### 1. Hat System (do ralph-orchestrator - mikeyobrien)
6 personas especializadas que o orquestrador alterna conforme a fase:
- **Coder**: Implementação de código
- **Reviewer**: Code review rigoroso
- **Tester**: Criação e execução de testes
- **Researcher**: Análise de codebase e pesquisa
- **Architect**: Decisões de design e arquitetura
- **Debugger**: Diagnóstico e fix de bugs

### 2. Parallel Execution (do ralph-tui - subsy)
- Git worktrees para isolamento de tarefas paralelas
- Dependency graph para ordenação de execução
- Subagent tracing para debugging
- Merge automático quando tasks completam

### 3. Spec-Driven Workflow (do smart-ralph - tzachbon)
- Input: PRD/spec estruturado (integra com output do AIOS PM/Architect)
- Pipeline: Research → Requirements → Design → Tasks → Execute
- Codebase indexing para auto-discovery de contexto

### 4. Agent Teams (do multi-agent-ralph-loop - alfredolopez80)
- Complexity classification (1-10)
- Memory-driven planning
- Grade A- security validation
- Reviewer independente do coder

### 5. Memory Layer Persistente
```
memory/
├── progress.txt          # Estado atual do loop
├── scratchpad.md         # Rascunho entre iterações
├── codebase-index.json   # Índice do codebase
├── decisions.log         # Log de decisões tomadas
├── patterns.json         # Padrões aprendidos
└── errors.json           # Erros e como foram resolvidos
```

### 6. Quality Gates (integra com AIOS QA)
- Gate por iteração (lint, typecheck, test)
- Gate de complexidade (não deixa PRs gigantes)
- Gate de segurança (scan de vulnerabilidades)
- Circuit breaker (para após N falhas consecutivas)

### 7. HITL (Human-in-the-Loop)
- Modo autônomo: roda sem intervenção
- Modo supervisionado: pede confirmação em pontos-chave
- Telegram/Slack notificações (opcional)
- Dashboard SSE para monitoramento real-time

---

## 🔌 INTERFACES DE INTEGRAÇÃO COM AIOS

### Input (recebe do AIOS Pipeline)
```json
{
  "source": "aios-pipeline",
  "phase": "dev",
  "story": "STORY-42",
  "prd": "docs/prd/feature-x.md",
  "architecture": "docs/architecture/feature-x.md",
  "acceptance_criteria": ["..."],
  "constraints": {
    "max_iterations": 50,
    "max_runtime_hours": 4,
    "quality_threshold": 0.85
  }
}
```

### Output (retorna pro AIOS Pipeline)
```json
{
  "status": "completed|failed|timeout|paused",
  "story": "STORY-42",
  "iterations_used": 23,
  "runtime_minutes": 87,
  "files_changed": ["src/..."],
  "tests_added": 12,
  "test_coverage": 0.89,
  "quality_score": 0.92,
  "commits": ["abc123", "def456"],
  "branch": "feature/STORY-42-ralph",
  "report": "docs/ralph-reports/STORY-42.md"
}
```

### Eventos SSE (para dashboard AIOS)
```
event: ralph:iteration:start
event: ralph:iteration:complete
event: ralph:hat:switch
event: ralph:quality:gate
event: ralph:error
event: ralph:complete
```

---

## 🚀 COMANDOS ESPERADOS

Após instalação, o usuário deve poder:

```bash
# No Claude Code / IDE com AIOS:
@ralph              # Ativa o agente Ralph Orchestrator
*ralph-init         # Inicializa Ralph no projeto
*ralph-loop         # Inicia loop autônomo
*ralph-status       # Mostra status do loop atual
*ralph-resume       # Retoma loop de onde parou
*ralph-review       # Review do que o Ralph produziu
*ralph-stop         # Para o loop graciosamente

# Com opções:
*ralph-loop --preset overnight --story STORY-42
*ralph-loop --max-iterations 30 --parallel
*ralph-loop --hat-only coder,tester
```

---

## 📍 PRIORIDADES DE IMPLEMENTAÇÃO

### Fase 1 — Core Loop (semana 1-2)
1. `squad.yaml` manifest
2. `ralph-orchestrator.md` agent (orquestrador principal)
3. `ralph-loop.md` task (loop básico sequencial)
4. `autonomous-loop.yaml` workflow
5. `config/ralph.yaml` configuração
6. `progress.md` template + memory básica

### Fase 2 — Hat System + Quality (semana 2-3)
7. Todos os 6 agent files (hats)
8. `config/hats.yaml` + `data/hat-prompts.json`
9. Quality gates integration
10. `config/quality-gates.yaml`
11. Circuit breaker (`tools/backpressure-gate.js`)

### Fase 3 — Parallel + Advanced (semana 3-4)
12. `tools/worktree-manager.js`
13. `parallel-execution.yaml` workflow
14. Codebase indexer
15. Presets system

### Fase 4 — Monitoring + HITL (semana 4-5)
16. `tools/monitor-hook.js` (SSE events)
17. Dashboard integration
18. HITL modes
19. Notification system

### Fase 5 — Polish + Distribution (semana 5-6)
20. Validation scripts
21. README + user-guide completos
22. Testes do squad
23. Publish como squad público

---

## ⚠️ REGRAS IMPORTANTES

1. **Seguir padrão AIOS**: Usar task-first architecture, TASK-FORMAT-SPECIFICATION-V1
2. **Agents em .md**: Todos os agents são arquivos Markdown seguindo o formato AIOS
3. **Workflows em .yaml**: Seguir schema de workflows do AIOS
4. **Não modificar .aios-core/**: O Ralph é um Squad, vive em `squads/ralph/`
5. **Integrar, não substituir**: Ralph estende o pipeline AIOS, não o substitui
6. **Memory via filesystem**: Usar arquivos no diretório do projeto, não banco de dados
7. **Idempotente**: `*ralph-resume` deve funcionar a qualquer momento
8. **Progressive disclosure**: Começar simples, complexidade opt-in via presets

---

## 📚 REFERÊNCIAS

- Blueprint completo: `docs/supreme-ralph-blueprint.md` (copiar do output anterior)
- AIOS Squads Guide: `.aios-core/` → ver squads-guide.md e squads-overview.md
- AIOS ADE: ver docs/architecture/ADE-* para entender o Autonomous Development Engine existente
- Ralph original: https://github.com/wesleyschons/ralph
- Ralph Orchestrator (referência hat system): https://github.com/mikeyobrien/ralph-orchestrator
- Smart Ralph (referência spec-driven): https://github.com/tzachbon/smart-ralph
- Multi-agent Ralph: https://github.com/alfredolopez80/multi-agent-ralph-loop
- Ralph TUI (referência parallel): https://github.com/nicekid1/ralph-tui
