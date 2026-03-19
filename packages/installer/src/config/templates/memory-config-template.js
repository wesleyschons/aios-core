/**
 * memory.yaml Template Generator
 *
 * Generates the memory module configuration file for AIOX.
 * Called by the installer wizard and the `aiox config memory` CLI command.
 *
 * @module memory-config-template
 */

'use strict';

const os = require('os');

/**
 * Generate memory.yaml content
 *
 * @param {Object} options - Configuration options
 * @param {string} [options.provider='local'] - "local" | "obsidian" | "hybrid"
 * @param {string} [options.vaultPath] - Path to Obsidian vault
 * @param {string} [options.mcpServer='obsidian-mcp'] - MCP server name
 * @param {string} [options.syncMode='write-through'] - "write-through" | "write-back" | "read-only"
 * @param {string} [options.projectFolder] - Vault project folder template
 * @returns {string} memory.yaml content
 */
function generateMemoryConfig(options = {}) {
  const {
    provider = 'local',
    vaultPath,
    mcpServer = 'obsidian-mcp',
    syncMode = 'write-through',
    projectFolder = 'projects/{{project_id}}',
  } = options;

  const resolvedVaultPath = vaultPath
    ? vaultPath.replace('~', os.homedir())
    : `${os.homedir()}/Obsidian/SynkraVault`;

  const lines = [
    '# SynkraAIOX Memory Module Configuration',
    `# Provider: "local" (default) | "obsidian" | "hybrid"`,
    '',
    'memory:',
    `  provider: ${provider}`,
    '',
    '  local:',
    '    base_path: "./"',
  ];

  if (provider === 'obsidian' || provider === 'hybrid') {
    lines.push(
      '',
      '  obsidian:',
      `    vault_path: "${resolvedVaultPath}"`,
      `    mcp_server: "${mcpServer}"`,
      `    sync_mode: ${syncMode}`,
      `    project_folder: "${projectFolder}"`,
    );
  }

  if (provider === 'hybrid') {
    lines.push(
      '',
      '  hybrid:',
      '    local_for: [agents, tasks, workflows]',
      '    obsidian_for: [sessions, decisions, handoffs, components, memory]',
      '    sync_interval: "on_session_end"',
    );
  }

  lines.push('');
  return lines.join('\n');
}

module.exports = { generateMemoryConfig };
