import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { discoverClaudeTools, type DiscoveredClaudeTool } from './ClaudeToolDiscovery';
import type { InstallLog } from '../installer/AntigravityInstaller';

export const OBSIGRAVITY_CLAUDE_PLUGIN_NAME = 'obsigravity-claude-tools';

export interface ClaudeToAntigravityImportResult {
  pluginDir: string;
  skillsImported: number;
  commandsImported: number;
  skipped: number;
}

interface WritableTool {
  tool: DiscoveredClaudeTool;
  skillName: string;
  sourceMarkdown: string;
}

export function convertClaudeToolsToAntigravityPlugin(log?: InstallLog): ClaudeToAntigravityImportResult {
  const pluginDir = path.join(os.homedir(), '.gemini', 'obsigravity', 'plugins', OBSIGRAVITY_CLAUDE_PLUGIN_NAME);
  const tools = discoverClaudeTools(1000);
  const writableTools = collectWritableTools(tools, log);

  fs.rmSync(pluginDir, { force: true, recursive: true });
  fs.mkdirSync(path.join(pluginDir, 'skills'), { recursive: true });
  fs.mkdirSync(path.join(pluginDir, 'commands'), { recursive: true });

  const pluginJson = {
    name: OBSIGRAVITY_CLAUDE_PLUGIN_NAME,
    version: '0.1.0',
    description: 'Claude Code skills and slash commands converted by Obsigravity for Antigravity CLI.',
    author: {
      name: 'Obsigravity',
    },
    keywords: ['obsigravity', 'claude-code', 'skills', 'slash-commands', 'antigravity'],
  };

  fs.writeFileSync(path.join(pluginDir, 'plugin.json'), `${JSON.stringify(pluginJson, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(pluginDir, 'README.md'), buildReadme(writableTools), 'utf8');

  let skillsImported = 0;
  let commandsImported = 0;
  for (const item of writableTools) {
    const skillDir = path.join(pluginDir, 'skills', item.skillName);
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), buildSkillMarkdown(item), 'utf8');
    if (item.tool.kind === 'command') {
      fs.writeFileSync(path.join(pluginDir, 'commands', `${item.skillName.replace(/^slash-/, '')}.md`), buildCommandMarkdown(item), 'utf8');
      commandsImported += 1;
    }
    if (item.tool.kind === 'skill') skillsImported += 1;
  }

  const skipped = tools.length - writableTools.length;
  log?.(`Converted Claude Code tools into AGY plugin: ${pluginDir}\n`);
  log?.(`Claude skills: ${skillsImported}; Claude slash commands: ${commandsImported}; skipped: ${skipped}\n`);

  return {
    pluginDir,
    skillsImported,
    commandsImported,
    skipped,
  };
}

function collectWritableTools(tools: DiscoveredClaudeTool[], log?: InstallLog): WritableTool[] {
  const usedNames = new Set<string>();
  const writableTools: WritableTool[] = [];

  for (const tool of tools) {
    let sourceMarkdown = '';
    try {
      sourceMarkdown = fs.readFileSync(tool.sourcePath, 'utf8');
    } catch (error) {
      log?.(`WARN Could not read ${tool.sourcePath}: ${error instanceof Error ? error.message : String(error)}\n`);
      continue;
    }

    const skillName = uniqueSkillName(tool, usedNames);
    writableTools.push({ tool, skillName, sourceMarkdown });
  }

  return writableTools;
}

function uniqueSkillName(tool: DiscoveredClaudeTool, usedNames: Set<string>): string {
  const baseName = sanitizeSkillName(tool.name) || `${tool.kind}-tool`;
  const preferred = tool.kind === 'command' ? `slash-${baseName}` : baseName;
  let candidate = preferred;
  let suffix = 2;
  while (usedNames.has(candidate)) {
    candidate = `${preferred}-${suffix}`;
    suffix += 1;
  }
  usedNames.add(candidate);
  return candidate;
}

function sanitizeSkillName(name: string): string {
  return name
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^a-z0-9가-힣._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function buildSkillMarkdown(item: WritableTool): string {
  const description = normalizeDescription(item.tool.description);
  const sourceBody = stripFrontmatter(item.sourceMarkdown).trim();
  const sourceLabel = item.tool.kind === 'command' ? 'Claude Code slash command' : 'Claude Code skill';
  const commandTrigger = item.tool.kind === 'command'
    ? `Use when the user invokes \`/${item.tool.name}\` or asks for the converted Claude command workflow.`
    : 'Use when the user asks for this converted Claude Code skill workflow.';

  return [
    '---',
    `name: ${item.skillName}`,
    `description: ${quoteYaml(`${description} ${commandTrigger}`.trim())}`,
    '---',
    '',
    `# ${item.tool.name}`,
    '',
    `Converted by Obsigravity from a local ${sourceLabel}.`,
    '',
    `- Source: \`${item.tool.sourcePath}\``,
    `- Original kind: \`${item.tool.kind}\``,
    '',
    '## Usage',
    '',
    commandTrigger,
    '',
    '## Original Instructions',
    '',
    sourceBody || description,
    '',
  ].join('\n');
}

function buildCommandMarkdown(item: WritableTool): string {
  const description = normalizeDescription(item.tool.description);
  const sourceBody = stripFrontmatter(item.sourceMarkdown).trim();

  return [
    '---',
    `description: ${quoteYaml(description)}`,
    '---',
    '',
    `# /${item.tool.name}`,
    '',
    `Converted by Obsigravity from \`${item.tool.sourcePath}\`.`,
    '',
    sourceBody || description,
    '',
  ].join('\n');
}

function buildReadme(items: WritableTool[]): string {
  const lines = [
    '# Obsigravity Claude Tools',
    '',
    'Generated by Obsigravity from local Claude Code skills and slash commands.',
    '',
    'Regenerate this plugin from Obsidian settings when Claude tools change.',
    '',
    '## Converted Tools',
    '',
  ];

  for (const item of items) {
    lines.push(`- \`${item.skillName}\` from ${item.tool.kind} \`${item.tool.name}\``);
  }

  lines.push('');
  return lines.join('\n');
}

function stripFrontmatter(markdown: string): string {
  return markdown.replace(/^---\s*\r?\n[\s\S]*?\r?\n---\s*\r?\n?/, '');
}

function normalizeDescription(description: string): string {
  return description
    .replace(/\s+/g, ' ')
    .replace(/"/g, "'")
    .trim()
    .slice(0, 500) || 'Converted Claude Code tool.';
}

function quoteYaml(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}
