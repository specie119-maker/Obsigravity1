import { spawn } from 'child_process';
import * as path from 'path';

import { findAntigravityCli } from '../antigravity/AntigravityCliResolver';
import {
  convertClaudeToolsToAntigravityPlugin,
  OBSIGRAVITY_CLAUDE_PLUGIN_NAME,
  type ClaudeToAntigravityImportResult,
} from '../claude/ClaudeToAntigravityImporter';
import { buildProcessEnv, mergePath } from '../settings/env';

export type InstallLog = (line: string) => void;
export type AntigravityPluginImportSource = 'claude' | 'gemini' | 'all';

export function getAntigravityInstallPreview(): string {
  if (process.platform === 'win32') {
    return 'powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "irm https://antigravity.google/cli/install.ps1 | iex"';
  }
  return 'curl -fsSL https://antigravity.google/cli/install.sh | bash';
}

export function getAntigravityAuthPreview(agyPath = 'agy'): string {
  return `${agyPath} --print-timeout 10m --print "Check Google Sign-In for Obsigravity."`;
}

export async function installAntigravityCli(envText: string, log: InstallLog): Promise<string | null> {
  const installCommand = getAntigravityInstallPreview();
  log(`$ ${installCommand}\n`);
  await runShellCommand(installCommand, envText, log);

  const detected = findAntigravityCli('', buildProcessEnv(envText).PATH);
  if (detected) {
    log(`\nDetected Antigravity CLI: ${detected}\n`);
    return detected;
  }

  log('\nInstall finished, but agy was not detected in Obsidian PATH yet. Add ~/.local/bin to PATH if needed.\n');
  return null;
}

export async function startGoogleSignIn(agyPath: string, envText: string, cwd: string, log: InstallLog): Promise<void> {
  const env = buildProcessEnv(envText);
  const detected = findAntigravityCli(agyPath, env.PATH);
  if (!detected) {
    throw new Error('Antigravity CLI was not found. Install it first or set the agy path.');
  }

  env.PATH = mergePath(env.PATH, [path.dirname(detected)]);
  const args = [
    '--print-timeout',
    '10m',
    '--print',
    [
      'Check Google Sign-In for Obsigravity.',
      'If no saved session exists, start the browser-based Google Sign-In flow.',
      'After authentication, reply with a concise status line.',
    ].join(' '),
  ];

  log(`$ ${getAntigravityAuthPreview(detected)}\n`);
  await runProcess(detected, args, env, cwd, log);
}

export async function probeAntigravityCli(agyPath: string, envText: string, log: InstallLog): Promise<string | null> {
  const env = buildProcessEnv(envText);
  const detected = findAntigravityCli(agyPath, env.PATH);
  if (!detected) {
    log('WARN Antigravity CLI not found.\n');
    return null;
  }

  env.PATH = mergePath(env.PATH, [path.dirname(detected)]);
  log(`$ ${detected} --help\n`);
  await runProcess(detected, ['--help'], env, process.cwd(), log);
  return detected;
}

export async function importAntigravityPlugins(
  source: AntigravityPluginImportSource,
  agyPath: string,
  envText: string,
  cwd: string,
  log: InstallLog
): Promise<void> {
  const detected = resolveAntigravityCli(agyPath, envText);
  const env = buildProcessEnv(envText);
  env.PATH = mergePath(env.PATH, [path.dirname(detected)]);
  const sources: Array<'claude' | 'gemini'> = source === 'all' ? ['claude', 'gemini'] : [source];

  for (const item of sources) {
    log(`$ ${detected} plugin import ${item}\n`);
    await runProcess(detected, ['plugin', 'import', item], env, cwd, log);
    log('\n');
  }

  log(`$ ${detected} plugin list\n`);
  await runProcess(detected, ['plugin', 'list'], env, cwd, log);
}

export async function convertClaudeToolsForAntigravity(
  agyPath: string,
  envText: string,
  cwd: string,
  log: InstallLog
): Promise<ClaudeToAntigravityImportResult> {
  log('Converting local Claude Code skills and slash commands into an AGY plugin bundle...\n');
  const result = convertClaudeToolsToAntigravityPlugin(log);
  const detected = resolveAntigravityCli(agyPath, envText);
  const env = buildProcessEnv(envText);
  env.PATH = mergePath(env.PATH, [path.dirname(detected)]);

  log(`\n$ ${detected} plugin validate ${result.pluginDir}\n`);
  await runProcess(detected, ['plugin', 'validate', result.pluginDir], env, cwd, log);

  log(`\n$ ${detected} plugin install ${result.pluginDir}\n`);
  await runProcess(detected, ['plugin', 'install', result.pluginDir], env, cwd, log);

  log(`\n$ ${detected} plugin enable ${OBSIGRAVITY_CLAUDE_PLUGIN_NAME}\n`);
  await runProcessBestEffort(
    detected,
    ['plugin', 'enable', OBSIGRAVITY_CLAUDE_PLUGIN_NAME],
    env,
    cwd,
    log,
    'Enable did not complete. Continuing because the plugin may already be enabled.'
  );

  log(`\n$ ${detected} plugin list\n`);
  await runProcess(detected, ['plugin', 'list'], env, cwd, log);

  return result;
}

export async function listAntigravityPlugins(
  agyPath: string,
  envText: string,
  cwd: string,
  log: InstallLog
): Promise<void> {
  const detected = resolveAntigravityCli(agyPath, envText);
  const env = buildProcessEnv(envText);
  env.PATH = mergePath(env.PATH, [path.dirname(detected)]);

  log(`$ ${detected} plugin list\n`);
  await runProcess(detected, ['plugin', 'list'], env, cwd, log);
}

function resolveAntigravityCli(agyPath: string, envText: string): string {
  const env = buildProcessEnv(envText);
  const detected = findAntigravityCli(agyPath, env.PATH);
  if (!detected) {
    throw new Error('Antigravity CLI was not found. Install it first or set the agy path.');
  }
  return detected;
}

function runShellCommand(command: string, envText: string, log: InstallLog): Promise<void> {
  const shell = process.platform === 'win32' ? 'powershell.exe' : '/bin/zsh';
  const args = process.platform === 'win32'
    ? ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command]
    : ['-lc', command];
  return runProcess(shell, args, buildProcessEnv(envText), process.cwd(), log);
}

function runProcess(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  cwd: string,
  log: InstallLog
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
      windowsHide: false,
    });

    child.stdout.on('data', (chunk: Buffer) => log(chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => log(chunk.toString()));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code && code !== 0) {
        reject(new Error(`${command} exited with code ${code}`));
        return;
      }
      resolve();
    });
  });
}

async function runProcessBestEffort(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  cwd: string,
  log: InstallLog,
  failureNote: string
): Promise<void> {
  try {
    await runProcess(command, args, env, cwd, log);
  } catch (error) {
    log(`\nNOTE ${failureNote}\n`);
    log(`NOTE ${error instanceof Error ? error.message : String(error)}\n`);
  }
}
