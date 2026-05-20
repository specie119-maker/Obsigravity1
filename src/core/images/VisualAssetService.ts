import * as path from 'path';
import type { App, TFile } from 'obsidian';

import type { AgentProvider, ImageMode, VisualOutputType } from '../types';
import { buildImagePrompt, buildPromptDraftRequest } from './ImagePromptBuilder';

function sanitizeName(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9가-힣_-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'obsigravity-image';
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

export interface GenerateVisualAssetRequest {
  app: App;
  agent: AgentProvider;
  vaultPath: string;
  file: TFile;
  mediaFolder: string;
  mode: ImageMode;
  outputType: VisualOutputType;
  userPrompt: string;
  generatedPrompt?: string;
  noteContent: string;
  selection?: string;
  onProgress?: (message: string) => void;
}

export interface GeneratedVisualAsset {
  path: string;
  transcript: string;
}

export async function generateVisualAsset(request: GenerateVisualAssetRequest): Promise<GeneratedVisualAsset> {
  request.onProgress?.('Preparing attachment folder...');
  const folder = request.mediaFolder.trim() || 'attachments/obsigravity';
  const normalizedFolder = folder.replace(/^\/+|\/+$/g, '');
  await ensureFolder(request.app, normalizedFolder);

  const extension = 'png';
  const filename = `${sanitizeName(`${request.file.basename}-${request.mode}`)}-${Date.now()}.${extension}`;
  const vaultRelativePath = path.posix.join(normalizedFolder, filename);

  const fallbackPrompt = buildImagePrompt({
    mode: request.mode,
    outputType: request.outputType,
    userPrompt: request.userPrompt,
    noteTitle: request.file.basename,
    noteContent: request.noteContent,
    selection: request.selection,
  });
  const visualPrompt = request.generatedPrompt?.trim() || fallbackPrompt;

  const prompt = buildAntigravityImageGenerationPrompt(vaultRelativePath, visualPrompt);

  let transcript = '';
  request.onProgress?.(`Asking Antigravity CLI to create the ${extension.toUpperCase()}...`);
  for await (const event of request.agent.query({
    prompt,
    cwd: request.vaultPath,
    allowWorkspaceAccess: true,
    activeNotePath: request.file.path,
    activeNoteContent: request.noteContent,
    selectedText: request.selection,
  })) {
    if (event.type === 'text') transcript += event.content;
    if (event.type === 'progress') request.onProgress?.(`Antigravity CLI: ${event.content}`);
    if (event.type === 'error') transcript += `\nERROR: ${event.content}`;
  }

  if (!(await request.app.vault.adapter.exists(vaultRelativePath))) {
    request.onProgress?.(`${extension.toUpperCase()} file was not created at the expected path.`);
    throw new Error(`Antigravity CLI did not create the expected ${extension.toUpperCase()} file: ${vaultRelativePath}\n\n${transcript.trim()}`);
  }

  request.onProgress?.(`Embedding generated ${extension.toUpperCase()} at the top of the note...`);
  await request.app.vault.process(request.file, (content) => embedAtTop(content, vaultRelativePath));
  request.onProgress?.(`Visual embedded: ${vaultRelativePath}`);
  return { path: vaultRelativePath, transcript: `Generated prompt:\n${visualPrompt}\n\n${transcript}` };
}

export async function draftVisualPrompt(request: GenerateVisualAssetRequest): Promise<string> {
  const prompt = buildPromptDraftRequest({
    mode: request.mode,
    outputType: request.outputType,
    userPrompt: request.userPrompt,
    noteTitle: request.file.basename,
    noteContent: request.noteContent,
    selection: request.selection,
  });

  let drafted = '';
  for await (const event of request.agent.query({
    prompt,
    cwd: request.vaultPath,
    allowWorkspaceAccess: false,
    activeNotePath: request.file.path,
    activeNoteContent: request.noteContent,
    selectedText: request.selection,
  })) {
    if (event.type === 'text') drafted += event.content;
    if (event.type === 'progress') request.onProgress?.(`Antigravity CLI: ${event.content}`);
    if (event.type === 'error') {
      request.onProgress?.(`Prompt draft warning: ${event.content}`);
      console.warn('[Obsigravity visual] Prompt draft warning:', event.content);
    }
  }

  return drafted.trim();
}

function buildAntigravityImageGenerationPrompt(vaultRelativePath: string, visualPrompt: string): string {
  return [
    'Create one raster image from the generated image prompt below for an Obsidian note.',
    '',
    `Final target file path, relative to the vault root: ${vaultRelativePath}`,
    '',
    'Hard requirements:',
    '- Use Antigravity CLI native image generation capability only.',
    '- Do not use Python, Pillow, SVG, HTML, canvas, diagrams-as-code, shell-created placeholder files, or external non-Antigravity APIs.',
    '- If native image generation is unavailable, do not fake the result; report NOT_AVAILABLE.',
    '- Generate the image, then copy or move the generated raster file to the final target file path.',
    '- Verify the final file exists and is a real raster image.',
    '- Keep the final target path inside the vault.',
    '- Do not generate video or TTS; those are intentionally capability-gated for future Obsigravity versions.',
    '- Preserve the prompt structure: subject, composition, style, environment, lighting, typography, details, aspect_ratio.',
    '- For Korean text, keep labels very short, large, and high contrast.',
    '- Do not modify the source note. Obsigravity will embed the image after the file exists.',
    '',
    'Obsigravity workflow context:',
    '- This is the first Antigravity-native content pack lane: image only.',
    '- Mention in your final response whether video or TTS was skipped because it is not native in the current CLI.',
    '- Prefer clean file evidence over broad claims.',
    '',
    'Generated image prompt to apply:',
    '',
    visualPrompt,
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
