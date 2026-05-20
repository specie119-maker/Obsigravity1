import * as path from 'path';
import type { App, TFile } from 'obsidian';

import { runExternalCli } from '../cli/ExternalCliRunner';
import type { ObsigravitySettings } from '../types';

function sanitizeName(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9가-힣_-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'obsigravity-video';
}

async function ensureFolder(app: App, folder: string): Promise<void> {
  const parts = folder.split('/').filter(Boolean);
  let current = '';
  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    if (!(await app.vault.adapter.exists(current))) {
      await app.vault.createFolder(current);
    }
  }
}

export interface GenerateGrokVideoRequest {
  app: App;
  settings: ObsigravitySettings;
  vaultPath: string;
  file: TFile;
  mediaFolder: string;
  noteContent: string;
  selectedText?: string;
  pinnedNotes?: Array<{ path: string; content: string }>;
  userPrompt: string;
  onProgress?: (message: string) => void;
}

export interface GeneratedGrokVideo {
  path: string;
  transcript: string;
}

export async function generateGrokVideoFromNote(request: GenerateGrokVideoRequest): Promise<GeneratedGrokVideo> {
  request.onProgress?.('Preparing video attachment folder...');
  const folder = request.mediaFolder.trim() || 'attachments/obsigravity';
  const normalizedFolder = folder.replace(/^\/+|\/+$/g, '');
  await ensureFolder(request.app, normalizedFolder);

  const filename = `${sanitizeName(`${request.file.basename}-grok-video`)}-${Date.now()}.mp4`;
  const vaultRelativePath = path.posix.join(normalizedFolder, filename);

  request.onProgress?.('Asking Grok Build to generate and save the MP4...');
  const result = await runExternalCli({
    id: 'grok',
    prompt: buildGrokVideoPrompt(vaultRelativePath, request),
    cwd: request.vaultPath,
    settings: request.settings,
    activeNotePath: request.file.path,
    activeNoteContent: request.noteContent,
    selectedText: request.selectedText,
    pinnedNotes: request.pinnedNotes,
  });

  if (!(await request.app.vault.adapter.exists(vaultRelativePath))) {
    request.onProgress?.('Grok Build did not create the expected MP4 file.');
    throw new Error(`Grok Build did not create the expected MP4 file: ${vaultRelativePath}\n\n${result.output}`);
  }

  request.onProgress?.('Embedding generated video at the top of the note...');
  await request.app.vault.process(request.file, (content) => embedAtTop(content, vaultRelativePath));
  request.onProgress?.(`Video embedded: ${vaultRelativePath}`);

  return {
    path: vaultRelativePath,
    transcript: result.output,
  };
}

function buildGrokVideoPrompt(vaultRelativePath: string, request: GenerateGrokVideoRequest): string {
  return [
    'Generate one video asset for an Obsidian note using Grok Build native capabilities.',
    '',
    `Final target file path, relative to the vault root: ${vaultRelativePath}`,
    `Active note path: ${request.file.path}`,
    '',
    'Hard requirements:',
    '- Use Grok Build native video/media generation capability if it is available in this local CLI session.',
    '- Create a real playable MP4 video file and save it exactly at the final target path.',
    '- Do not create placeholders, empty files, HTML animations, SVGs, text-only storyboards, or fake MP4 files.',
    '- If native video generation is not available, report NOT_AVAILABLE and do not create a fake file.',
    '- Keep the final file inside the Obsidian vault.',
    '- Verify the final file exists before finishing.',
    '- Do not edit the markdown note; Obsigravity will embed the video after the file exists.',
    '',
    'Video direction:',
    request.userPrompt.trim() || 'Create a concise 8-12 second visual briefing video from the note, suitable for embedding in Obsidian.',
  ].join('\n');
}

function embedAtTop(content: string, vaultRelativePath: string): string {
  const embed = `![[${vaultRelativePath}]]`;
  if (content.includes(embed)) return content;
  if (content.startsWith('---\n')) {
    const frontmatterEnd = content.indexOf('\n---', 4);
    if (frontmatterEnd !== -1) {
      const closingEnd = frontmatterEnd + '\n---'.length;
      const hasTrailingNewline = content.slice(closingEnd).startsWith('\n');
      const before = content.slice(0, closingEnd);
      const after = content.slice(closingEnd + (hasTrailingNewline ? 1 : 0));
      return `${before}\n\n${embed}\n\n${after}`;
    }
  }
  return `${embed}\n\n${content}`;
}
