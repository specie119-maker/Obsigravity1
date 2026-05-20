import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export interface DiscoveredClaudeTool {
  name: string;
  kind: 'command' | 'skill';
  sourcePath: string;
  description: string;
}

function isDirectory(dirPath: string): boolean {
  try {
    return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}

function isFile(filePath: string): boolean {
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function safeReadFirstLines(filePath: string, maxLines = 24): string {
  try {
    return fs.readFileSync(filePath, 'utf8').split(/\r?\n/).slice(0, maxLines).join('\n');
  } catch {
    return '';
  }
}

function firstDescription(markdown: string, fallback: string): string {
  const frontmatterDescription = markdown.match(/^---[\s\S]*?\ndescription:\s*["']?(.+?)["']?\s*\n[\s\S]*?---/i)?.[1]?.trim();
  if (frontmatterDescription) return frontmatterDescription;

  const heading = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim();
  if (heading) return heading;

  const sentence = markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith('#') && !line.startsWith('---'));
  return sentence || fallback;
}

function collectMarkdownFiles(dirPath: string, maxDepth = 2): string[] {
  if (!isDirectory(dirPath) || maxDepth < 0) return [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isFile() && entry.name.endsWith('.md')) files.push(fullPath);
    if (entry.isDirectory()) files.push(...collectMarkdownFiles(fullPath, maxDepth - 1));
  }
  return files;
}

function collectSkillFiles(dirPath: string, maxDepth = 3): string[] {
  if (!isDirectory(dirPath) || maxDepth < 0) return [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isFile() && entry.name === 'SKILL.md') files.push(fullPath);
    if (entry.isDirectory()) files.push(...collectSkillFiles(fullPath, maxDepth - 1));
  }
  return files;
}

interface SearchRoot {
  path: string;
  depth: number;
}

export function discoverClaudeTools(limit = 1000): DiscoveredClaudeTool[] {
  const home = os.homedir();
  const claudeHome = path.join(home, '.claude');
  const commandRoots: SearchRoot[] = [
    { path: path.join(claudeHome, 'commands'), depth: 1 },
    { path: path.join(claudeHome, '.opencode', 'commands'), depth: 1 },
    { path: path.join(claudeHome, 'plugins', 'marketplaces'), depth: 4 },
  ];
  const skillRoots: SearchRoot[] = [
    { path: path.join(claudeHome, 'skills'), depth: 4 },
    { path: path.join(claudeHome, '.agents', 'skills'), depth: 3 },
    { path: path.join(claudeHome, '.cursor', 'skills'), depth: 3 },
    { path: path.join(claudeHome, 'plugins', 'marketplaces'), depth: 5 },
    { path: path.join(home, '.codex', 'skills'), depth: 3 },
    { path: path.join(home, '.agents', 'skills'), depth: 3 },
  ];

  const tools = new Map<string, DiscoveredClaudeTool>();

  for (const root of commandRoots) {
    for (const filePath of collectMarkdownFiles(root.path, root.depth)) {
      if (!filePath.includes(`${path.sep}commands${path.sep}`) && !filePath.includes(`${path.sep}.opencode${path.sep}commands${path.sep}`)) continue;
      const name = path.basename(filePath, '.md');
      if (!name || name.toLowerCase() === 'readme') continue;
      const key = `command:${name}`;
      if (tools.has(key)) continue;
      const markdown = safeReadFirstLines(filePath);
      tools.set(key, {
        name,
        kind: 'command',
        sourcePath: filePath,
        description: firstDescription(markdown, `Claude command from ${path.basename(path.dirname(filePath))}`),
      });
    }
  }

  for (const root of skillRoots) {
    for (const filePath of collectSkillFiles(root.path, root.depth)) {
      if (!isFile(filePath)) continue;
      const name = path.basename(path.dirname(filePath));
      if (!name || name.toLowerCase() === 'skills') continue;
      const key = `skill:${name}`;
      if (tools.has(key)) continue;
      const markdown = safeReadFirstLines(filePath);
      tools.set(key, {
        name,
        kind: 'skill',
        sourcePath: filePath,
        description: firstDescription(markdown, `Claude skill from ${path.basename(path.dirname(path.dirname(filePath)))}`),
      });
    }
  }

  return [...tools.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, limit);
}
