/**
 * Memory Command Module
 *
 * CLI commands for the Memory Module publish/link system.
 *
 * Subcommands:
 *   aiox memory publish <type> <name>    Publish local item to Obsidian vault
 *   aiox memory link <type> <name>       Link item from vault to local project
 *   aiox memory list-brain [type]        List items available in the vault
 *   aiox memory status                   Show memory module status
 *
 * @module cli/commands/memory
 */

'use strict';

const { Command } = require('commander');
const fs = require('fs');
const path = require('path');

function getProjectRoot() {
  return process.cwd();
}

/**
 * Load memory config from memory.yaml
 */
function loadMemoryConfig(root) {
  const configPath = path.join(root, '.aiox-core', 'config', 'memory.yaml');
  if (!fs.existsSync(configPath)) {
    return null;
  }
  // Simple parse - extract vault_path
  const content = fs.readFileSync(configPath, 'utf8');
  const vaultMatch = content.match(/vault_path:\s*"?([^"\n]+)"?/);
  const providerMatch = content.match(/provider:\s*(\w+)/);
  return {
    provider: providerMatch ? providerMatch[1] : 'local',
    vaultPath: vaultMatch ? vaultMatch[1].trim() : null,
  };
}

/**
 * Resolve the vault path for a given type and name.
 */
function vaultPathFor(vaultPath, type, name) {
  const globalTypes = ['agent', 'squad', 'pipeline'];
  if (globalTypes.includes(type)) {
    return path.join(vaultPath, '_nucleus', `${type}s`, `${name}.md`);
  }
  return path.join(vaultPath, 'projects', '_global', `${type}s`, `${name}.md`);
}

/**
 * Resolve the local path for a given type and name.
 */
function localPathFor(root, type, name) {
  const typeMap = {
    squad: path.join(root, 'squads', name),
    agent: path.join(root, '.aiox-core', 'development', 'agents', `${name}.md`),
  };
  return typeMap[type] || path.join(root, '.aiox-core', 'memory', 'data', `${type}s`, `${name}.md`);
}

// ---------------------------------------------------------------------------
// aiox memory publish
// ---------------------------------------------------------------------------

function publishAction(type, name, _options) {
  const root = getProjectRoot();
  const config = loadMemoryConfig(root);

  if (!config || !config.vaultPath) {
    console.error('No Obsidian vault configured. Run: aiox config memory --provider hybrid --vault <path>');
    process.exit(1);
  }

  const localPath = localPathFor(root, type, name);

  // For squads, we need to build metadata from the squad directory
  if (type === 'squad') {
    return publishSquad(root, name, config.vaultPath);
  }

  // For single-file types, copy with metadata
  if (!fs.existsSync(localPath)) {
    console.error(`Local ${type} not found: ${localPath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(localPath, 'utf8');
  const destPath = vaultPathFor(config.vaultPath, type, name);
  const destDir = path.dirname(destPath);

  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  fs.writeFileSync(destPath, content, 'utf8');
  console.log(`Published ${type}/${name} to vault`);
  console.log(`  Local:  ${localPath}`);
  console.log(`  Vault:  ${destPath}`);
}

function publishSquad(root, name, vaultPath) {
  const squadDir = path.join(root, 'squads', name);

  if (!fs.existsSync(squadDir)) {
    console.error(`Squad not found: squads/${name}/`);
    process.exit(1);
  }

  // Destination: full squad directory in vault
  const destDir = path.join(vaultPath, '_nucleus', 'squads', name);

  // Copy entire squad directory to vault
  const stats = _copyDirRecursive(squadDir, destDir);

  // Read squad.yaml for metadata (for the MOC)
  const squadYamlPath = path.join(squadDir, 'squad.yaml');
  let squadMeta = {};
  if (fs.existsSync(squadYamlPath)) {
    const raw = fs.readFileSync(squadYamlPath, 'utf8');
    const nameMatch = raw.match(/name:\s*"?([^"\n]+)"?/);
    const descMatch = raw.match(/description:\s*"?([^"\n]+)"?/);
    const prefixMatch = raw.match(/slashPrefix:\s*"?([^"\n]+)"?/);
    squadMeta.name = nameMatch ? nameMatch[1].trim() : name;
    squadMeta.description = descMatch ? descMatch[1].trim() : '';
    squadMeta.slashPrefix = prefixMatch ? prefixMatch[1].trim() : name.split('-')[0];
  }

  // Count agents and tasks
  const agentsDir = path.join(squadDir, 'agents');
  const tasksDir = path.join(squadDir, 'tasks');
  const agents = fs.existsSync(agentsDir)
    ? fs.readdirSync(agentsDir).filter((f) => f.endsWith('.md'))
    : [];
  const tasks = fs.existsSync(tasksDir)
    ? fs.readdirSync(tasksDir).filter((f) => f.endsWith('.md'))
    : [];

  // Update the squads MOC
  _updateSquadsMOC(vaultPath, {
    name,
    displayName: squadMeta.name || name,
    description: squadMeta.description || '',
    slashPrefix: squadMeta.slashPrefix || name.split('-')[0],
    agents: agents.length,
    tasks: tasks.length,
    source: root.split('/').pop(),
  });

  console.log(`Published squad/${name} to vault (full structure)`);
  console.log(`  Files:   ${stats.files} copied`);
  console.log(`  Agents:  ${agents.length}`);
  console.log(`  Tasks:   ${tasks.length}`);
  console.log(`  Vault:   ${destDir}/`);
  console.log(`  MOC:     _nucleus/squads/_index.md updated`);
}

/**
 * Recursively copy a directory, preserving structure.
 * Returns { files, dirs } count.
 */
function _copyDirRecursive(src, dest) {
  const stats = { files: 0, dirs: 0 };

  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
    stats.dirs++;
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    // Skip hidden files and node_modules
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      const sub = _copyDirRecursive(srcPath, destPath);
      stats.files += sub.files;
      stats.dirs += sub.dirs;
    } else {
      fs.copyFileSync(srcPath, destPath);
      stats.files++;
    }
  }

  return stats;
}

/**
 * Update or create the squads MOC (_index.md) in the vault.
 * Regenerates the full index from what exists in _nucleus/squads/.
 */
function _updateSquadsMOC(vaultPath, _newSquad) {
  const squadsDir = path.join(vaultPath, '_nucleus', 'squads');
  const mocPath = path.join(squadsDir, '_index.md');

  // Scan all squad directories (not .md files, actual dirs)
  const entries = fs.readdirSync(squadsDir, { withFileTypes: true });
  const squads = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('_')) continue;

    const squadYaml = path.join(squadsDir, entry.name, 'squad.yaml');
    let meta = { name: entry.name, description: '', agents: 0, tasks: 0, slashPrefix: entry.name.split('-')[0] };

    if (fs.existsSync(squadYaml)) {
      const raw = fs.readFileSync(squadYaml, 'utf8');
      const nameMatch = raw.match(/name:\s*"?([^"\n]+)"?/);
      const descMatch = raw.match(/description:\s*"?([^"\n]+)"?/);
      const prefixMatch = raw.match(/slashPrefix:\s*"?([^"\n]+)"?/);
      if (nameMatch) meta.name = nameMatch[1].trim();
      if (descMatch) meta.description = descMatch[1].trim();
      if (prefixMatch) meta.slashPrefix = prefixMatch[1].trim();
    }

    // Count agents and tasks
    const agentsPath = path.join(squadsDir, entry.name, 'agents');
    const tasksPath = path.join(squadsDir, entry.name, 'tasks');
    if (fs.existsSync(agentsPath)) {
      meta.agents = fs.readdirSync(agentsPath).filter((f) => f.endsWith('.md')).length;
    }
    if (fs.existsSync(tasksPath)) {
      meta.tasks = fs.readdirSync(tasksPath).filter((f) => f.endsWith('.md')).length;
    }

    squads.push({ dir: entry.name, ...meta });
  }

  // Sort alphabetically
  squads.sort((a, b) => a.dir.localeCompare(b.dir));

  // Generate MOC content
  const lines = [
    '---',
    'type: moc',
    'id: squads-index',
    `updated: "${new Date().toISOString()}"`,
    `total: ${squads.length}`,
    '---',
    '',
    '# Squads Index',
    '',
    `> ${squads.length} squads published in the vault.`,
    '',
    '| Squad | Prefix | Agents | Tasks | Description |',
    '|-------|--------|--------|-------|-------------|',
  ];

  for (const s of squads) {
    const link = `[[${s.dir}]]`;
    const desc = s.description.length > 60 ? s.description.substring(0, 60) + '...' : s.description;
    lines.push(`| ${link} | \`${s.slashPrefix}\` | ${s.agents} | ${s.tasks} | ${desc} |`);
  }

  lines.push('', `_Auto-generated by \`aiox memory publish\`. Last updated: ${new Date().toISOString().substring(0, 19)}_`);
  lines.push('');

  fs.writeFileSync(mocPath, lines.join('\n'), 'utf8');
}

// ---------------------------------------------------------------------------
// aiox memory link
// ---------------------------------------------------------------------------

function linkAction(type, name, _options) {
  const root = getProjectRoot();
  const config = loadMemoryConfig(root);

  if (!config || !config.vaultPath) {
    console.error('No Obsidian vault configured. Run: aiox config memory --provider hybrid --vault <path>');
    process.exit(1);
  }

  const vaultFile = vaultPathFor(config.vaultPath, type, name);

  if (!fs.existsSync(vaultFile)) {
    console.error(`${type}/${name} not found in vault: ${vaultFile}`);
    console.error(`Available: run 'aiox memory list-brain ${type}' to see what's in the vault`);
    process.exit(1);
  }

  if (type === 'squad') {
    return linkSquad(root, name, config.vaultPath, vaultFile);
  }

  // For single-file types, copy to local
  const destPath = localPathFor(root, type, name);
  const destDir = path.dirname(destPath);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  fs.copyFileSync(vaultFile, destPath);
  console.log(`Linked ${type}/${name} from vault`);
  console.log(`  Vault: ${vaultFile}`);
  console.log(`  Local: ${destPath}`);
}

function linkSquad(root, name, vaultPath, _vaultFile) {
  const destDir = path.join(root, 'squads', name);

  if (fs.existsSync(destDir)) {
    console.error(`Squad already exists locally: squads/${name}/`);
    console.error('Remove it first or use a different name.');
    process.exit(1);
  }

  // The vault stores the full squad directory
  const vaultSquadDir = path.join(vaultPath, '_nucleus', 'squads', name);

  if (fs.existsSync(vaultSquadDir) && fs.statSync(vaultSquadDir).isDirectory()) {
    // Full structure available — copy everything
    const stats = _copyDirRecursive(vaultSquadDir, destDir);

    // Read squad.yaml for slash prefix
    const squadYamlPath = path.join(destDir, 'squad.yaml');
    let slashPrefix = name.split('-')[0];
    if (fs.existsSync(squadYamlPath)) {
      const raw = fs.readFileSync(squadYamlPath, 'utf8');
      const prefixMatch = raw.match(/slashPrefix:\s*"?([^"\n]+)"?/);
      if (prefixMatch) slashPrefix = prefixMatch[1].trim();
    }

    // Count agents
    const agentsDir = path.join(destDir, 'agents');
    const agents = fs.existsSync(agentsDir)
      ? fs.readdirSync(agentsDir).filter((f) => f.endsWith('.md'))
      : [];

    // Register and sync commands
    _registerSquadAlias(root, name, slashPrefix);
    _syncSquadCommands(root, name, slashPrefix, agents.map((a) => a.replace('.md', '')));

    console.log(`Linked squad/${name} from vault (full structure)`);
    console.log(`  Files:   ${stats.files} copied`);
    console.log(`  Prefix:  /SQUADS:${slashPrefix}:*`);
    console.log(`  Agents:  ${agents.length}`);
    console.log(`  Commands synced to .claude/commands/SQUADS/${slashPrefix}/`);
  } else {
    // Fallback: only .md metadata exists (legacy publish)
    console.error(`Squad directory not found in vault: ${vaultSquadDir}`);
    console.error('The squad was published with an older version. Re-publish it first:');
    console.error(`  aiox memory publish squad ${name}`);
    process.exit(1);
  }
}

/**
 * Register squad alias in .aios-sync.yaml
 */
function _registerSquadAlias(root, squadName, alias) {
  const syncPath = path.join(root, '.aios-sync.yaml');

  if (!fs.existsSync(syncPath)) {
    // Create minimal sync file
    const content = [
      'active_ides:',
      '  - claude',
      '',
      'squad_aliases:',
      `  ${squadName}: ${alias}`,
      '',
      'sync_mappings:',
      '  squad_agents:',
      "    source: 'squads/*/agents/'",
      '    destinations:',
      '      claude:',
      "        - path: '.claude/commands/SQUADS/{squad_alias}/'",
      "          format: 'md'",
    ].join('\n');
    fs.writeFileSync(syncPath, content, 'utf8');
    return;
  }

  // Append to existing sync file if alias not present
  const existing = fs.readFileSync(syncPath, 'utf8');
  if (existing.includes(`${squadName}:`)) return; // Already registered

  // Insert after squad_aliases:
  const updated = existing.replace(
    /squad_aliases:\n/,
    `squad_aliases:\n  ${squadName}: ${alias}\n`,
  );
  fs.writeFileSync(syncPath, updated, 'utf8');
}

/**
 * Copy agent .md files to .claude/commands/SQUADS/{prefix}/
 */
function _syncSquadCommands(root, squadName, prefix, agents) {
  const commandsDir = path.join(root, '.claude', 'commands', 'SQUADS', prefix);
  if (!fs.existsSync(commandsDir)) {
    fs.mkdirSync(commandsDir, { recursive: true });
  }

  const agentsDir = path.join(root, 'squads', squadName, 'agents');
  for (const agent of agents) {
    const srcPath = path.join(agentsDir, `${agent}.md`);
    const destPath = path.join(commandsDir, `${agent}.md`);
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// ---------------------------------------------------------------------------
// aiox memory list-brain
// ---------------------------------------------------------------------------

function listBrainAction(type, _options) {
  const root = getProjectRoot();
  const config = loadMemoryConfig(root);

  if (!config || !config.vaultPath) {
    console.error('No Obsidian vault configured. Run: aiox config memory --provider hybrid --vault <path>');
    process.exit(1);
  }

  const types = type ? [type] : ['squad', 'agent', 'pipeline', 'decision', 'component'];

  for (const t of types) {
    const dir = path.join(config.vaultPath, '_nucleus', `${t}s`);
    if (!fs.existsSync(dir)) continue;

    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md') && !f.startsWith('_'));
    if (files.length === 0) continue;

    console.log(`\n${t}s (${files.length}):`);
    for (const file of files) {
      const name = file.replace('.md', '');
      const filePath = path.join(dir, file);
      const content = fs.readFileSync(filePath, 'utf8');

      // Extract summary from frontmatter
      const summaryMatch = content.match(/summary:\s*"?([^"\n]+)"?/);
      const summary = summaryMatch ? summaryMatch[1].trim() : '';

      console.log(`  ${name}${summary ? ` - ${summary}` : ''}`);
    }
  }

  // Also check project-scoped items
  const projectsDir = path.join(config.vaultPath, 'projects');
  if (fs.existsSync(projectsDir)) {
    const projects = fs.readdirSync(projectsDir).filter((f) => {
      return fs.statSync(path.join(projectsDir, f)).isDirectory() && !f.startsWith('_');
    });
    if (projects.length > 0) {
      console.log(`\nprojects (${projects.length}):`);
      for (const p of projects) {
        console.log(`  ${p}`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// aiox memory status
// ---------------------------------------------------------------------------

function statusAction() {
  const root = getProjectRoot();
  const config = loadMemoryConfig(root);

  if (!config) {
    console.log('Memory module: NOT CONFIGURED');
    console.log('Run: aiox config memory --provider local');
    return;
  }

  console.log(`Provider: ${config.provider}`);

  if (config.vaultPath) {
    const vaultExists = fs.existsSync(config.vaultPath);
    console.log(`Vault: ${config.vaultPath} (${vaultExists ? 'exists' : 'NOT FOUND'})`);

    if (vaultExists) {
      // Count items in vault
      const synkraDir = path.join(config.vaultPath, '_nucleus');
      if (fs.existsSync(synkraDir)) {
        const dirs = fs.readdirSync(synkraDir).filter((f) => {
          const full = path.join(synkraDir, f);
          return fs.statSync(full).isDirectory();
        });
        for (const dir of dirs) {
          const files = fs.readdirSync(path.join(synkraDir, dir)).filter((f) => f.endsWith('.md'));
          if (files.length > 0) {
            console.log(`  ${dir}: ${files.length} items`);
          }
        }
      }
    }
  }

  // Local data
  const dataDir = path.join(root, '.aiox-core', 'memory', 'data');
  if (fs.existsSync(dataDir)) {
    const dirs = fs.readdirSync(dataDir).filter((f) => {
      const full = path.join(dataDir, f);
      return fs.statSync(full).isDirectory() && !f.startsWith('_');
    });
    if (dirs.length > 0) {
      console.log('\nLocal data:');
      for (const dir of dirs) {
        const files = fs.readdirSync(path.join(dataDir, dir)).filter((f) => f.endsWith('.md'));
        if (files.length > 0) {
          console.log(`  ${dir}: ${files.length} items`);
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Command builder
// ---------------------------------------------------------------------------

function createMemoryCommand() {
  const memoryCmd = new Command('memory')
    .description('Memory module: publish, link, and browse your Second Brain');

  memoryCmd
    .command('publish <type> <name>')
    .description('Publish local item to Obsidian vault (e.g., aiox memory publish squad brand-identity)')
    .action(publishAction);

  memoryCmd
    .command('link <type> <name>')
    .description('Link item from vault to local project (e.g., aiox memory link squad copywriting)')
    .action(linkAction);

  memoryCmd
    .command('list-brain [type]')
    .description('List items available in the vault (e.g., aiox memory list-brain squad)')
    .action(listBrainAction);

  memoryCmd
    .command('status')
    .description('Show memory module status and statistics')
    .action(statusAction);

  return memoryCmd;
}

module.exports = { createMemoryCommand };
