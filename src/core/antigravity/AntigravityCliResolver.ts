import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

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

export function findAntigravityCli(customPath?: string, pathValue?: string): string | null {
  const custom = (customPath || '').trim();
  if (custom && isFile(expandHome(custom))) return expandHome(custom);

  const names = process.platform === 'win32'
    ? ['agy.exe', 'agy.cmd', 'agy.ps1', 'agy', 'antigravity.exe', 'antigravity.cmd', 'antigravity.ps1', 'antigravity']
    : ['agy', 'antigravity'];

  for (const entry of pathEntries(pathValue)) {
    for (const name of names) {
      const candidate = path.join(entry, name);
      if (isFile(candidate)) return candidate;
    }
  }

  const home = os.homedir();
  const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
  const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
  const candidates = process.platform === 'win32'
    ? [
        path.join(localAppData, 'agy', 'bin', 'agy.exe'),
        path.join(localAppData, 'antigravity-cli', 'agy.exe'),
        path.join(localAppData, 'Programs', 'agy', 'agy.exe'),
        path.join(programFiles, 'Antigravity', 'agy.exe'),
        path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'npm', 'agy.cmd'),
      ]
    : [
        path.join(home, '.local', 'bin', 'agy'),
        path.join(home, '.gemini', 'antigravity-cli', 'bin', 'agy'),
        '/opt/homebrew/bin/agy',
        '/usr/local/bin/agy',
        '/opt/homebrew/bin/antigravity',
        '/usr/local/bin/antigravity',
      ];

  return candidates.find(isFile) || null;
}
