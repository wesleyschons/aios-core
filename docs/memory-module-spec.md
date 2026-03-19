# SynkraAIOX — Obsidian Memory Module

> Spec técnica para integrar persistência Obsidian como módulo configurável no fork SynkraAIOX do aios-core.

---

## 1. Problema

O AIOS core hoje tem memória via filesystem hardcoded: agents em `.md`, squads em `squads/`, progresso em `progress.md`, contexto em arquivos no diretório do projeto. Funciona bem pra um projeto isolado, mas:

- **Sem visibilidade cross-project** — cada projeto é um silo, não há graph de dependências entre eles
- **Sem memória de longo prazo** — session logs e decisões morrem quando o diretório muda ou o contexto reseta
- **Sem handoff tracking** — quando um agent passa trabalho pra outro, não há registro persistente
- **Sem dashboard visual** — pra ver o estado do sistema precisa navegar por dezenas de arquivos

O Obsidian resolve tudo isso mantendo compatibilidade total com o padrão `.md` do AIOS.

---

## 2. Princípio de Design: Provider Pattern

O módulo NÃO substitui o filesystem — ele **abstrai** o storage por trás de uma interface uniforme. O AIOS core continua chamando as mesmas funções, mas o backend pode ser filesystem local OU Obsidian vault (via MCP).

```
┌─────────────────────────────────────────┐
│             AIOS CORE                   │
│  (agents, squads, tasks, workflows)     │
│                                         │
│  agent.load("copywriter-hooks")         │
│  memory.write("session", data)          │
│  memory.search("última decisão billing")│
└──────────────┬──────────────────────────┘
               │
        ┌──────▼──────┐
        │  MemoryBus  │  ← Interface unificada
        └──────┬──────┘
               │
       ┌───────┼──────────┐
       │       │          │
  ┌────▼──┐ ┌──▼────┐ ┌──▼──────┐
  │ Local │ │Obsid. │ │ Future  │
  │  FS   │ │  MCP  │ │(Notion, │
  │       │ │       │ │ Supabase│
  └───────┘ └───────┘ │  etc.)  │
                      └─────────┘
```

### Configuração

```yaml
# .aiox-core/config/memory.yaml  (novo arquivo)
memory:
  provider: obsidian          # "local" | "obsidian" | "hybrid"
  
  local:
    base_path: "./"           # default, relativo ao projeto
    
  obsidian:
    vault_path: "~/Obsidian/SynkraVault"
    mcp_server: "obsidian-mcp"
    sync_mode: write-through  # "write-through" | "write-back" | "read-only"
    project_folder: "projects/{{project_id}}"
    
  hybrid:
    # Modo recomendado: filesystem local pra runtime, Obsidian pra persistência
    local_for: [agents, tasks, workflows]      # Leitura rápida, sem latência MCP
    obsidian_for: [sessions, decisions, handoffs, components, memory]  # Persistência + graph
    sync_interval: "on_session_end"            # "realtime" | "on_session_end" | "manual"
```

### Por que "hybrid" é o modo recomendado

O AIOS core precisa de leitura instantânea dos agents e tasks durante execução — adicionar latência de MCP no hot path seria um crime. Mas sessions, decisions e handoffs são escritas **infrequentes** e **valiosas** — perfeitas pra Obsidian.

```
HOT PATH (local FS, zero latência):
  Agent .md files → lidos pelo orchestrator a cada task
  Task definitions → parseados pelo executor
  Workflow .yaml → carregados no boot

COLD PATH (Obsidian via MCP, tolerante a ~100ms):
  Session logs → escritos 1x no fim da sessão
  Decision records → escritos quando há decisão
  Handoffs → escritos na troca de agente
  Memory/context → lidos no início da sessão
  Component docs → lidos sob demanda
```

---

## 3. Arquitetura do Módulo

### 3.1 Estrutura de arquivos no fork

```
.aiox-core/
├── core/
│   ├── memory/                    # NOVO — módulo de memória
│   │   ├── memory-bus.js          # Interface principal (dispatcher)
│   │   ├── providers/
│   │   │   ├── local-provider.js  # Provider filesystem (extrai lógica existente)
│   │   │   ├── obsidian-provider.js # Provider Obsidian via MCP
│   │   │   └── provider-interface.js # Contrato que todo provider implementa
│   │   ├── schemas/
│   │   │   ├── agent.schema.js    # Validação de frontmatter
│   │   │   ├── session.schema.js
│   │   │   ├── decision.schema.js
│   │   │   ├── handoff.schema.js
│   │   │   └── component.schema.js
│   │   ├── serializers/
│   │   │   ├── frontmatter.js     # Parse/serialize YAML frontmatter
│   │   │   └── context-packer.js  # Compacta contexto pro token budget
│   │   └── hooks/
│   │       ├── on-session-start.js
│   │       ├── on-session-end.js
│   │       ├── on-decision.js
│   │       └── on-handoff.js
│   └── ...existing core files
├── config/
│   └── memory.yaml                # NOVO — config do módulo
└── ...
```

### 3.2 Provider Interface (contrato)

```javascript
// .aiox-core/memory/providers/provider-interface.js

/**
 * Todo provider de memória DEVE implementar esta interface.
 * Os métodos são async porque Obsidian/MCP tem latência de I/O.
 */
class MemoryProvider {
  
  // ─── LEITURA ───────────────────────────────────────
  
  /**
   * Lista items de um tipo. Retorna L0 (id + summary).
   * Custo alvo: ~2 tokens por item.
   * @param {string} type - "agent" | "squad" | "session" | "decision" | "handoff" | "component"
   * @param {object} filters - { project?, status?, since?, limit? }
   * @returns {Array<{id, type, summary, status, updated}>}
   */
  async list(type, filters = {}) { throw new Error('Not implemented'); }
  
  /**
   * Retorna contexto operacional (L1) — frontmatter sem body.
   * Custo alvo: ~100-300 tokens.
   * @param {string} id - ID do item
   * @returns {object} frontmatter completo
   */
  async getContext(id) { throw new Error('Not implemented'); }
  
  /**
   * Retorna documento completo (L2) — frontmatter + body.
   * Custo alvo: ~1000-5000 tokens.
   * @param {string} id - ID do item
   * @returns {object} { frontmatter, body }
   */
  async getFull(id) { throw new Error('Not implemented'); }
  
  /**
   * Busca full-text no vault/filesystem.
   * Retorna L0 dos resultados.
   * @param {string} query - Texto de busca
   * @param {object} scope - { type?, project?, limit? }
   * @returns {Array<{id, type, summary, relevance}>}
   */
  async search(query, scope = {}) { throw new Error('Not implemented'); }
  
  /**
   * Retorna os N items mais recentes de um tipo.
   * Retorna L1 de cada.
   * @param {string} type
   * @param {object} opts - { project?, limit? }
   * @returns {Array<object>} frontmatter de cada item
   */
  async recent(type, opts = {}) { throw new Error('Not implemented'); }

  // ─── ESCRITA ───────────────────────────────────────
  
  /**
   * Cria ou atualiza um item.
   * @param {string} id
   * @param {object} data - { type, frontmatter, body? }
   * @param {object} opts - { section?, merge? }
   */
  async write(id, data, opts = {}) { throw new Error('Not implemented'); }
  
  /**
   * Atualiza apenas campos específicos do frontmatter.
   * Não toca no body. Ideal pra updates de status/focus.
   * @param {string} id
   * @param {object} fields - campos a atualizar
   */
  async patch(id, fields) { throw new Error('Not implemented'); }
  
  /**
   * Deleta um item (ou move pra archive).
   * @param {string} id
   * @param {boolean} archive - se true, move em vez de deletar
   */
  async remove(id, archive = true) { throw new Error('Not implemented'); }

  // ─── LIFECYCLE ─────────────────────────────────────
  
  async initialize(config) { throw new Error('Not implemented'); }
  async healthCheck() { throw new Error('Not implemented'); }
  async close() { throw new Error('Not implemented'); }
}
```

### 3.3 Memory Bus (dispatcher)

```javascript
// .aiox-core/memory/memory-bus.js

const yaml = require('yaml');
const fs = require('fs');
const LocalProvider = require('./providers/local-provider');
const ObsidianProvider = require('./providers/obsidian-provider');

class MemoryBus {
  constructor(configPath = '.aiox-core/config/memory.yaml') {
    this.config = yaml.parse(fs.readFileSync(configPath, 'utf8')).memory;
    this.providers = {};
    this.routingTable = {};
  }

  async initialize() {
    const mode = this.config.provider;

    if (mode === 'local' || mode === 'hybrid') {
      this.providers.local = new LocalProvider();
      await this.providers.local.initialize(this.config.local);
    }

    if (mode === 'obsidian' || mode === 'hybrid') {
      this.providers.obsidian = new ObsidianProvider();
      await this.providers.obsidian.initialize(this.config.obsidian);
    }

    // Routing table pra modo hybrid
    if (mode === 'hybrid') {
      const h = this.config.hybrid;
      for (const type of h.local_for) {
        this.routingTable[type] = 'local';
      }
      for (const type of h.obsidian_for) {
        this.routingTable[type] = 'obsidian';
      }
    } else {
      // Modo puro: tudo vai pro mesmo provider
      this.routingTable = new Proxy({}, {
        get: () => mode
      });
    }
  }

  _resolve(type) {
    const provider = this.routingTable[type];
    if (!provider || !this.providers[provider]) {
      throw new Error(`No provider configured for type "${type}". Check memory.yaml`);
    }
    return this.providers[provider];
  }

  // ─── API pública (delega pro provider correto) ─────

  async list(type, filters) {
    return this._resolve(type).list(type, filters);
  }

  async getContext(id, type) {
    return this._resolve(type).getContext(id);
  }

  async getFull(id, type) {
    return this._resolve(type).getFull(id);
  }

  async search(query, scope) {
    // Search sempre vai pro Obsidian se disponível (full-text superior)
    if (this.providers.obsidian) {
      return this.providers.obsidian.search(query, scope);
    }
    return this.providers.local.search(query, scope);
  }

  async recent(type, opts) {
    return this._resolve(type).recent(type, opts);
  }

  async write(id, data, opts) {
    const provider = this._resolve(data.type);
    const result = await provider.write(id, data, opts);

    // Write-through: se hybrid e o item é local, replica pro Obsidian
    if (this.config.provider === 'hybrid' 
        && this.config.obsidian?.sync_mode === 'write-through'
        && this.routingTable[data.type] === 'local'
        && this.providers.obsidian) {
      await this.providers.obsidian.write(id, data, opts).catch(err => {
        console.warn(`[MemoryBus] Obsidian sync failed for ${id}:`, err.message);
        // Não falha a operação principal — sync é best-effort
      });
    }

    return result;
  }

  async patch(id, fields, type) {
    return this._resolve(type).patch(id, fields);
  }

  async close() {
    for (const provider of Object.values(this.providers)) {
      await provider.close();
    }
  }
}

module.exports = MemoryBus;
```

### 3.4 Obsidian Provider (implementação)

```javascript
// .aiox-core/memory/providers/obsidian-provider.js

const { FrontmatterSerializer } = require('../serializers/frontmatter');
const { ContextPacker } = require('../serializers/context-packer');

class ObsidianProvider {
  constructor() {
    this.vaultPath = null;
    this.mcpClient = null;
    this.serializer = new FrontmatterSerializer();
    this.packer = new ContextPacker();
  }

  async initialize(config) {
    this.vaultPath = config.vault_path;
    this.projectFolder = config.project_folder;
    
    // Conecta ao MCP server do Obsidian
    // Em runtime Claude Code, o MCP já está configurado no mcp.json
    // Em runtime standalone, conecta via stdio ou SSE
    this.mcpClient = await this._connectMCP(config.mcp_server);
  }

  // ─── Mapeamento de tipo → pasta no vault ──────────

  _pathFor(type, id, projectId) {
    const projectBase = this.projectFolder.replace('{{project_id}}', projectId || '_global');
    
    const typeMap = {
      agent:     `_synkra/agents/${id}.md`,
      squad:     `_synkra/squads/${id}.md`,
      pipeline:  `_synkra/pipelines/${id}.md`,
      session:   `${projectBase}/sessions/${id}.md`,
      decision:  `${projectBase}/decisions/${id}.md`,
      handoff:   `${projectBase}/handoffs/${id}.md`,
      component: `${projectBase}/components/${id}.md`,
      project:   `${projectBase}/overview.md`,
    };
    
    return typeMap[type] || `${projectBase}/${id}.md`;
  }

  // ─── LEITURA ───────────────────────────────────────

  async list(type, filters = {}) {
    const folder = this._folderFor(type, filters.project);
    
    // MCP call: lista arquivos no folder, extrai frontmatter mínimo
    const files = await this.mcpClient.call('obsidian_list', {
      folder,
      filters: {
        type,
        status: filters.status,
        since: filters.since,
        limit: filters.limit || 50
      }
    });
    
    // Retorna L0: só id, summary, status, updated
    return files.map(f => ({
      id: f.frontmatter.id,
      type: f.frontmatter.type,
      summary: f.frontmatter.summary,
      status: f.frontmatter.status,
      updated: f.frontmatter.updated
    }));
  }

  async getContext(id) {
    // MCP call: lê arquivo, retorna só frontmatter (L1)
    const result = await this.mcpClient.call('obsidian_read', {
      path: this._findPath(id),
      frontmatter_only: true
    });
    
    return this.serializer.parse(result.content).frontmatter;
  }

  async getFull(id) {
    // MCP call: lê arquivo completo (L2)
    const result = await this.mcpClient.call('obsidian_read', {
      path: this._findPath(id),
      frontmatter_only: false
    });
    
    return this.serializer.parse(result.content);
  }

  async search(query, scope = {}) {
    const results = await this.mcpClient.call('obsidian_search', {
      query,
      folder: scope.project ? `projects/${scope.project}` : undefined,
      limit: scope.limit || 10
    });
    
    return results.map(r => ({
      id: r.frontmatter?.id || r.filename,
      type: r.frontmatter?.type,
      summary: r.frontmatter?.summary,
      relevance: r.score
    }));
  }

  async recent(type, opts = {}) {
    const folder = this._folderFor(type, opts.project);
    
    const files = await this.mcpClient.call('obsidian_list', {
      folder,
      filters: { type },
      sort: 'updated_desc',
      limit: opts.limit || 5
    });
    
    // Retorna L1 (frontmatter completo) dos mais recentes
    return files.map(f => f.frontmatter);
  }

  // ─── ESCRITA ───────────────────────────────────────

  async write(id, data, opts = {}) {
    const path = this._pathFor(data.type, id, data.frontmatter?.project);
    const content = this.serializer.serialize(data.frontmatter, data.body || '');
    
    await this.mcpClient.call('obsidian_write', {
      path,
      content,
      create_folders: true
    });
    
    return { id, path, written: true };
  }

  async patch(id, fields) {
    // Lê frontmatter atual, merge fields, escreve de volta
    const current = await this.getContext(id);
    const merged = { ...current, ...fields, updated: new Date().toISOString() };
    
    // Lê o body completo pra preservar
    const full = await this.getFull(id);
    
    await this.write(id, {
      type: merged.type,
      frontmatter: merged,
      body: full.body
    });
    
    return { id, patched: Object.keys(fields) };
  }

  async remove(id, archive = true) {
    if (archive) {
      // Move pra _archive/ no vault
      const current = await this.getContext(id);
      const currentPath = this._findPath(id);
      const archivePath = currentPath.replace(/^(.+)\//, '$1/_archive/');
      
      await this.mcpClient.call('obsidian_move', {
        from: currentPath,
        to: archivePath
      });
    } else {
      await this.mcpClient.call('obsidian_delete', {
        path: this._findPath(id)
      });
    }
  }

  // ─── HELPERS ───────────────────────────────────────

  _folderFor(type, projectId) {
    const globalTypes = ['agent', 'squad', 'pipeline'];
    if (globalTypes.includes(type)) {
      return `_synkra/${type}s`;
    }
    const project = projectId || '_global';
    const projectBase = this.projectFolder.replace('{{project_id}}', project);
    return `${projectBase}/${type}s`;
  }

  _findPath(id) {
    // Resolve ID para path no vault
    // Usa cache interno ou MCP search
    return this._pathCache?.[id] || null;
  }

  async _connectMCP(serverName) {
    // Em Claude Code: o MCP já está disponível via mcp.json
    // Em standalone: conecta via stdio transport
    // Retorna client com método .call(tool, params)
    
    // Placeholder — implementação depende do runtime
    return {
      call: async (tool, params) => {
        // Delegate to MCP protocol
      }
    };
  }

  async healthCheck() {
    try {
      await this.mcpClient.call('obsidian_list', { folder: '_synkra', limit: 1 });
      return { healthy: true, provider: 'obsidian' };
    } catch (err) {
      return { healthy: false, provider: 'obsidian', error: err.message };
    }
  }

  async close() {
    // Cleanup MCP connection
  }
}

module.exports = ObsidianProvider;
```

---

## 4. Hooks — Automação de Logging

Os hooks são o mecanismo que faz o Second Brain se popular automaticamente, sem depender de disciplina manual.

### 4.1 on-session-start.js

```javascript
// Roda automaticamente quando o AIOS inicia uma sessão de trabalho

async function onSessionStart(memoryBus, context) {
  const { projectId, executor } = context;
  
  // 1. Carrega overview do projeto (L1)
  const project = await memoryBus.getContext(`project-${projectId}`, 'project');
  
  // 2. Carrega últimas 3 sessões (L1)
  const recentSessions = await memoryBus.recent('session', { 
    project: projectId, 
    limit: 3 
  });
  
  // 3. Carrega decisões pendentes/recentes (L1)
  const recentDecisions = await memoryBus.recent('decision', { 
    project: projectId, 
    limit: 3 
  });
  
  // 4. Monta contexto compactado
  const sessionContext = {
    project: {
      name: project.name,
      current_focus: project.current_focus,
      blockers: project.blockers,
      next_actions: project.next_actions
    },
    recent_work: recentSessions.map(s => ({
      date: s.date,
      summary: s.summary,
      next: s.next_session_context
    })),
    recent_decisions: recentDecisions.map(d => ({
      id: d.id,
      summary: d.summary,
      date: d.date
    })),
    _meta: {
      tokens_estimated: null,  // preenchido pelo context-packer
      loaded_at: new Date().toISOString()
    }
  };
  
  // 5. Estima tokens e avisa se estiver alto
  const packed = ContextPacker.pack(sessionContext);
  sessionContext._meta.tokens_estimated = packed.tokenCount;
  
  if (packed.tokenCount > 2000) {
    console.warn(`[Memory] Session context is ${packed.tokenCount} tokens. Consider pruning recent_work.`);
  }
  
  return sessionContext;
}
```

### 4.2 on-session-end.js

```javascript
// Roda automaticamente quando a sessão encerra (ou via comando manual)

async function onSessionEnd(memoryBus, context, sessionData) {
  const { projectId, executor, startTime } = context;
  const sessionId = `sess-${formatDate(startTime)}`;
  
  // 1. Escreve session log
  await memoryBus.write(sessionId, {
    type: 'session',
    frontmatter: {
      type: 'session',
      id: sessionId,
      project: `[[project-${projectId}]]`,
      date: startTime,
      duration_minutes: Math.round((Date.now() - startTime) / 60000),
      summary: sessionData.summary,
      actions: sessionData.actions,
      decisions_made: sessionData.decisions.map(d => `[[${d.id}]]`),
      files_changed: sessionData.filesChanged,
      next_session_context: sessionData.nextContext,
      tokens_input: sessionData.tokensIn,
      tokens_output: sessionData.tokensOut,
      executor,
      tags: ['session']
    }
  });
  
  // 2. Atualiza overview do projeto
  await memoryBus.patch(`project-${projectId}`, {
    current_focus: sessionData.nextFocus || sessionData.summary,
    next_actions: sessionData.nextActions || [],
    updated: new Date().toISOString()
  }, 'project');
  
  // 3. Se houve decisões, já foram escritas pelo hook on-decision
  // Só confirma que os links estão corretos
  
  console.log(`[Memory] Session ${sessionId} logged. ${sessionData.actions.length} actions, ${sessionData.decisions.length} decisions.`);
}
```

### 4.3 on-decision.js

```javascript
// Chamado manualmente ou auto-detectado quando o AIOS/agente toma uma decisão

async function onDecision(memoryBus, context, decisionData) {
  const { projectId, executor } = context;
  const decisionId = decisionData.id || `dec-${formatDate()}-${decisionData.slug}`;
  
  await memoryBus.write(decisionId, {
    type: 'decision',
    frontmatter: {
      type: 'decision',
      id: decisionId,
      project: `[[project-${projectId}]]`,
      status: 'accepted',
      summary: decisionData.summary,
      decision: decisionData.decision,
      rationale: decisionData.rationale,
      alternatives_considered: decisionData.alternatives || [],
      consequences: decisionData.consequences || [],
      decided_by: decisionData.decidedBy || 'wesley',
      participants: decisionData.participants || [executor],
      date: formatDate(),
      supersedes: decisionData.supersedes || null,
      tags: ['decision', ...(decisionData.tags || [])]
    }
  });
  
  return decisionId;
}
```

### 4.4 on-handoff.js

```javascript
// Chamado quando um agente/squad transfere trabalho para outro

async function onHandoff(memoryBus, context, handoffData) {
  const { projectId } = context;
  const handoffId = `ho-${formatDate()}-${handoffData.slug}`;
  
  await memoryBus.write(handoffId, {
    type: 'handoff',
    frontmatter: {
      type: 'handoff',
      id: handoffId,
      date: new Date().toISOString(),
      project: `[[project-${projectId}]]`,
      summary: handoffData.summary,
      from_agent: handoffData.from,
      to_agent: handoffData.to,
      reason: handoffData.reason,
      context_transferred: handoffData.contextItems || [],
      key_constraints: handoffData.constraints || [],
      state_snapshot: {
        completed: handoffData.completed || [],
        pending: handoffData.pending || []
      },
      depends_on: handoffData.dependencies?.map(d => `[[${d}]]`) || [],
      tags: ['handoff']
    }
  });
  
  return handoffId;
}
```

---

## 5. Context Packer — Economia de Tokens

O Context Packer é o componente mais crítico pra eficiência. Ele garante que o contexto injetado na sessão nunca ultrapasse um budget de tokens.

```javascript
// .aiox-core/memory/serializers/context-packer.js

class ContextPacker {
  
  static TOKEN_BUDGETS = {
    session_start: 1500,    // Máximo pro contexto de início de sessão
    agent_context: 500,     // Máximo ao carregar contexto de um agent
    component_context: 800, // Máximo ao carregar specs de componente
    search_results: 1000,   // Máximo pra resultados de busca
  };

  /**
   * Compacta contexto pra caber no budget.
   * Estratégia: trunca os campos menos importantes primeiro.
   */
  static pack(data, budget = 'session_start') {
    const maxTokens = this.TOKEN_BUDGETS[budget] || 1500;
    let packed = JSON.parse(JSON.stringify(data)); // deep clone
    
    let currentTokens = this.estimateTokens(packed);
    
    // Estratégia de redução progressiva
    const reductions = [
      // Nível 1: Remove campos de metadata
      () => { delete packed._meta; },
      
      // Nível 2: Trunca recent_work pra 2 items
      () => { if (packed.recent_work?.length > 2) packed.recent_work = packed.recent_work.slice(0, 2); },
      
      // Nível 3: Remove alternatives_considered das decisions
      () => { packed.recent_decisions?.forEach(d => delete d.alternatives_considered); },
      
      // Nível 4: Trunca summaries longos pra 100 chars
      () => { this._truncateSummaries(packed, 100); },
      
      // Nível 5: Remove recent_decisions (mantém só no vault)
      () => { delete packed.recent_decisions; },
      
      // Nível 6: Remove tags e campos opcionais
      () => { this._stripOptionalFields(packed); },
    ];
    
    for (const reduce of reductions) {
      if (currentTokens <= maxTokens) break;
      reduce();
      currentTokens = this.estimateTokens(packed);
    }
    
    return {
      data: packed,
      tokenCount: currentTokens,
      withinBudget: currentTokens <= maxTokens
    };
  }

  /**
   * Estimativa rápida de tokens (~4 chars = 1 token para inglês/português).
   */
  static estimateTokens(data) {
    const json = typeof data === 'string' ? data : JSON.stringify(data);
    return Math.ceil(json.length / 4);
  }

  static _truncateSummaries(obj, maxLen) {
    if (typeof obj === 'object' && obj !== null) {
      for (const [key, val] of Object.entries(obj)) {
        if (key === 'summary' && typeof val === 'string' && val.length > maxLen) {
          obj[key] = val.substring(0, maxLen) + '...';
        } else if (typeof val === 'object') {
          this._truncateSummaries(val, maxLen);
        }
      }
    }
  }

  static _stripOptionalFields(obj) {
    const optional = ['tags', 'created', 'run_count', 'avg_tokens_per_run', 'version'];
    if (typeof obj === 'object' && obj !== null) {
      for (const field of optional) {
        delete obj[field];
      }
      for (const val of Object.values(obj)) {
        if (typeof val === 'object') this._stripOptionalFields(val);
      }
    }
  }
}

module.exports = { ContextPacker };
```

---

## 6. Integração com Pipeline AIOS Existente

O AIOS tem um pipeline: **SM → PO → Dev → QA**. O módulo de memória se encaixa nos pontos de transição:

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│    SM    │────▶│    PO    │────▶│   DEV    │────▶│    QA    │
│  agent   │     │  agent   │     │  squad   │     │  agent   │
└────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘
     │                │                │                │
  on_handoff       on_handoff       on_handoff       on_session_end
  SM→PO            PO→Dev           Dev→QA           (log final)
     │                │                │                │
     ▼                ▼                ▼                ▼
  ┌──────────────────────────────────────────────────────┐
  │                    MemoryBus                         │
  │  writes: handoff, decision, session                  │
  │  reads: project context, agent specs, prev sessions  │
  └──────────────────────────────────────────────────────┘
```

### Onde plugar no core existente

O AIOS core tem um **task executor** que roda cada agente. O ponto de integração é wrapping o executor:

```javascript
// Pseudo-código — adaptar ao task runner real do AIOS

const memoryBus = new MemoryBus();
await memoryBus.initialize();

// Antes de executar qualquer task
const context = await onSessionStart(memoryBus, { 
  projectId: 'agentforge', 
  executor: currentAgent.id 
});

// Injeta contexto no system prompt do agente
agent.systemPrompt += `\n\n## Contexto do Projeto\n${JSON.stringify(context)}`;

// Na transição entre agents (SM → PO, PO → Dev, etc.)
await onHandoff(memoryBus, ctx, {
  from: 'sm-agent',
  to: 'po-agent',
  summary: 'Sprint planning completo, 5 stories priorizadas',
  completed: ['sprint_backlog'],
  pending: ['story_breakdown', 'acceptance_criteria']
});

// No fim de tudo
await onSessionEnd(memoryBus, ctx, sessionData);
```

---

## 7. MCP Config — Claude Code + Obsidian

### ~/.claude/mcp.json

```json
{
  "mcpServers": {
    "obsidian-vault": {
      "command": "npx",
      "args": ["-y", "obsidian-mcp-server"],
      "env": {
        "OBSIDIAN_VAULT_PATH": "/home/wesley/Obsidian/SynkraVault"
      }
    },
    "synkra-aiox": {
      "command": "node",
      "args": [".aiox-core/memory/mcp-server.js"],
      "env": {
        "MEMORY_CONFIG": ".aiox-core/config/memory.yaml"
      }
    }
  }
}
```

Isso dá ao Claude Code acesso direto a:
- **obsidian-vault**: Leitura/escrita raw no vault
- **synkra-aiox**: As tools tipadas (list, getContext, getFull, search, recent, write, patch)

---

## 8. Roadmap de Implementação no Fork

### Sprint 1 — Fundação (1-2 semanas)

- [ ] Criar `core/memory/` com provider-interface e memory-bus
- [ ] Extrair lógica de filesystem existente pro local-provider
- [ ] Criar `config/memory.yaml` com default `provider: local`
- [ ] Garantir que o core funciona identicamente com o provider pattern
- [ ] Testes: tudo que funcionava antes continua funcionando

### Sprint 2 — Obsidian Provider (1-2 semanas)

- [ ] Implementar obsidian-provider com MCP client
- [ ] Implementar frontmatter serializer (parse/serialize)
- [ ] Implementar context-packer com token budgets
- [ ] Testar em modo `provider: obsidian` puro
- [ ] Testar em modo `provider: hybrid`

### Sprint 3 — Hooks (1 semana)

- [ ] Implementar on-session-start
- [ ] Implementar on-session-end
- [ ] Implementar on-decision
- [ ] Implementar on-handoff
- [ ] Plugar hooks nos pontos de transição do pipeline AIOS

### Sprint 4 — Polish e Documentação (1 semana)

- [ ] Documentar no README do fork como ativar o módulo
- [ ] Criar `docs/memory-module.md` com guia de configuração
- [ ] Schema validation nos frontmatters
- [ ] Error handling e fallbacks (se Obsidian MCP falhar, degrada pra local)
- [ ] Script de migração: importar agents `.md` existentes pro vault com frontmatter padronizado

### Sprint 5 — Contribuição Upstream (opcional)

- [ ] Abrir PR no SynkraAI/aios-core com o provider pattern
- [ ] Local provider como default (zero breaking changes)
- [ ] Obsidian como provider documentado e opt-in
- [ ] Documentação de como criar novos providers (Notion, Supabase, etc.)

---

## 9. Considerações Importantes

### Fallback gracioso

Se o Obsidian MCP server não estiver rodando, o sistema DEVE funcionar normalmente caindo pro local provider. Nunca travar o pipeline porque o vault está offline.

```javascript
// No memory-bus.js
async _resolveWithFallback(type) {
  const primary = this._resolve(type);
  try {
    await primary.healthCheck();
    return primary;
  } catch {
    console.warn(`[MemoryBus] ${primary.constructor.name} unhealthy, falling back to local`);
    return this.providers.local;
  }
}
```

### Conflitos de sync

No modo hybrid com write-through, pode haver conflito se alguém editar uma nota no Obsidian manualmente enquanto o AIOS está rodando. Regra simples: **AIOS sempre ganha no frontmatter, humano sempre ganha no body**. O frontmatter é gerado por máquina; o body é espaço do humano.

### Segurança

O vault pode conter informações sensíveis (API keys de clientes, dados de negócio). O MCP server do Obsidian NÃO deve ser exposto pra rede — roda local via stdio, nunca via HTTP/SSE em produção.

### Performance

O MCP call adiciona ~50-150ms de latência por operação. No hot path (leitura de agents durante execução), isso é inaceitável. Por isso o modo hybrid roteia agents pro filesystem local. No cold path (session logs, decisions), 150ms é imperceptível.
