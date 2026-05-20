import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export type ExternalCliId = 'claude' | 'codex' | 'grok';

export interface ExternalCliDefinition {
  id: ExternalCliId;
  name: string;
  commandNames: string[];
  commonPaths: string[];
}

export const EXTERNAL_CLI_DEFINITIONS: ExternalCliDefinition[] = [
  {
    id: 'claude',
    name: 'Claude Code',
    commandNames: process.platform === 'win32' ? ['claude.exe', 'claude.cmd', 'claude.ps1', 'claude'] : ['claude'],
    commonPaths: process.platform === 'win32'
      ? [
          path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'npm', 'claude.cmd'),
          path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'Programs', 'Claude', 'claude.exe'),
        ]
      : [
          path.join(os.homedir(), '.local', 'bin', 'claude'),
          '/opt/homebrew/bin/claude',
          '/usr/local/bin/claude',
        ],
  },
  {
    id: 'codex',
    name: 'Codex CLI',
    commandNames: process.platform === 'win32' ? ['codex.exe', 'codex.cmd', 'codex.ps1', 'codex'] : ['codex'],
    commonPaths: process.platform === 'win32'
      ? [
          path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'npm', 'codex.cmd'),
          path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'Programs', 'Codex', 'codex.exe'),
        ]
      : [
          '/opt/homebrew/bin/codex',
          '/usr/local/bin/codex',
          path.join(os.homedir(), '.local', 'bin', 'codex'),
        ],
  },
  {
    id: 'grok',
    name: 'Grok CLI',
    commandNames: process.platform === 'win32' ? ['grok.exe', 'grok.cmd', 'grok.ps1', 'grok'] : ['grok'],
    commonPaths: process.platform === 'win32'
      ? [
          path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'npm', 'grok.cmd'),
          path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'grok', 'grok.exe'),
        ]
      : [
          path.join(os.homedir(), '.grok', 'bin', 'grok'),
          path.join(os.homedir(), '.local', 'bin', 'grok'),
          '/opt/homebrew/bin/grok',
          '/usr/local/bin/grok',
        ],
  },
];

export type ExternalCliPaths = Record<ExternalCliId, string>;
export type ExternalCliDetection = Record<ExternalCliId, string | null>;

function isFile(filePath: string): boolean {
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function expandHome(input: string): string {
  if (input === '~') return os.homedir();
  if (input.startsWith(`~${path.sep}`)) return path.join(os.homedir(), input.slice(2));
  return input;
}

function pathEntries(pathValue?: string): string[] {
  return (pathValue || process.env.PATH || '')
    .split(path.delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function findExternalCli(id: ExternalCliId, customPath?: string, pathValue?: string): string | null {
  const definition = EXTERNAL_CLI_DEFINITIONS.find((item) => item.id === id);
  if (!definition) return null;

  const custom = (customPath || '').trim();
  if (custom && isFile(expandHome(custom))) return expandHome(custom);

  for (const entry of pathEntries(pathValue)) {
    for (const name of definition.commandNames) {
      const candidate = path.join(entry, name);
      if (isFile(candidate)) return candidate;
    }
  }

  return definition.commonPaths.find(isFile) || null;
}

export function detectExternalClis(paths: Partial<ExternalCliPaths>, pathValue?: string): ExternalCliDetection {
  return {
    claude: findExternalCli('claude', paths.claude, pathValue),
    codex: findExternalCli('codex', paths.codex, pathValue),
    grok: findExternalCli('grok', paths.grok, pathValue),
  };
}
