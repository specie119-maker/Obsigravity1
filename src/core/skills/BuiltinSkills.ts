export type BuiltinSkillId = 'note-surgeon' | 'atomic-split' | 'vault-cartographer';

export interface BuiltinSkill {
  id: BuiltinSkillId;
  slash: `/${BuiltinSkillId}`;
  name: string;
  hint: string;
  description: string;
  buildPrompt: (request: string) => string;
}

const COMMON_OBSIDIAN_RULES = [
  'You are running inside Obsigravity, an Obsidian-native Antigravity workflow.',
  'Use Obsidian Flavored Markdown: wikilinks, embeds, callouts, frontmatter, tags, and MOC sections when useful.',
  'Prefer current note and selected text. Use pinned notes only as supporting context.',
  'Do not scan the whole vault unless this skill explicitly asks for vault/folder mapping.',
  'If editing files, keep changes small, reversible, and explain exactly which notes changed.',
  'Never delete user content. Move or summarize content only when preserving a backlink to the source.',
].join('\n');

function withOptionalRequest(request: string): string {
  return request.trim()
    ? `\n\nAdditional user direction:\n${request.trim()}`
    : '';
}

export const BUILTIN_SKILLS: BuiltinSkill[] = [
  {
    id: 'note-surgeon',
    slash: '/note-surgeon',
    name: 'Note Surgeon',
    hint: 'Clean and restructure note',
    description: 'Repair the active note structure: headings, frontmatter, tags, callouts, links, duplication, and extraction candidates.',
    buildPrompt: (request) => [
      COMMON_OBSIDIAN_RULES,
      '',
      '# Built-in Skill: Note Surgeon',
      '',
      'Goal: improve the active Obsidian note so it becomes easier to read, link, revisit, and reuse.',
      '',
      'Workflow:',
      '1. Diagnose the note structure: title, frontmatter, headings, duplicated sections, missing links, weak tags, and unclear claims.',
      '2. Produce a concise surgery plan before any file edit.',
      '3. If safe file editing is available, update only the active note. If editing is not available, output a patch-style replacement section.',
      '4. Preserve original meaning and important details. Do not shorten aggressively unless the user asks.',
      '',
      'Expected output:',
      '- Changed sections',
      '- Added or improved frontmatter/tags',
      '- Suggested wikilinks',
      '- Any extracted-note candidates',
      '- Verification that the note still reads coherently',
      withOptionalRequest(request),
    ].join('\n'),
  },
  {
    id: 'atomic-split',
    slash: '/atomic-split',
    name: 'Atomic Note Splitter',
    hint: 'Split active note into atomic notes',
    description: 'Break a long active note into smaller linked atomic notes and leave an index/backlink trail in the original note.',
    buildPrompt: (request) => [
      COMMON_OBSIDIAN_RULES,
      '',
      '# Built-in Skill: Atomic Note Splitter',
      '',
      'Goal: split the active note into small, self-contained atomic notes that can be reused across the vault.',
      '',
      'Atomic note criteria:',
      '- One durable idea, claim, concept, person, company, source, question, or action per note.',
      '- A clear title that can stand alone as a wikilink.',
      '- A backlink to the source note.',
      '- Minimal but useful context, not a blind copy of the original.',
      '',
      'Workflow:',
      '1. Identify 3-12 atomic note candidates from the active note or selected text.',
      '2. For each candidate, propose title, reason, destination filename, tags, and backlink structure.',
      '3. If safe file editing is available, create the new notes and update the source note with an "Atomic notes" section linking them.',
      '4. If editing is not available, output exact markdown blocks for each new note and the source-note insertion.',
      '',
      'Output format:',
      '## Atomic split result',
      '- Created or proposed notes',
      '- Source note update',
      '- Link map',
      '- Follow-up notes worth creating later',
      withOptionalRequest(request),
    ].join('\n'),
  },
  {
    id: 'vault-cartographer',
    slash: '/vault-cartographer',
    name: 'Vault Cartographer',
    hint: 'Map notes and link gaps',
    description: 'Map the active note neighborhood or selected folder into clusters, MOC candidates, orphan notes, and missing links.',
    buildPrompt: (request) => [
      COMMON_OBSIDIAN_RULES,
      '',
      '# Built-in Skill: Vault Cartographer',
      '',
      'Goal: make a useful map of the current note neighborhood, not a decorative graph.',
      '',
      'Scope rules:',
      '- Default scope: active note, linked notes, backlinks if cheaply available, pinned notes, and the active note folder.',
      '- If the user names a folder, map only that folder.',
      '- Avoid full-vault scans unless the user explicitly asks for "whole vault" or "entire vault".',
      '',
      'Analyze:',
      '- Hub notes and isolated notes',
      '- Concept clusters',
      '- Missing links between related notes',
      '- MOC candidates',
      '- Duplicate or overlapping notes',
      '- Stale notes that may need review',
      '',
      'Expected output:',
      '1. A short map summary',
      '2. Cluster list',
      '3. Recommended links to add',
      '4. MOC note proposal',
      '5. Optional Mermaid graph for quick preview',
      '6. Optional JSON node-edge sketch for future 3D graph rendering',
      '',
      'If safe file editing is available and the user asks to apply, create or update only a map/MOC note. Do not mass-edit the vault.',
      withOptionalRequest(request),
    ].join('\n'),
  },
];

export function getBuiltinSkillBySlash(prompt: string): { skill: BuiltinSkill; request: string } | null {
  const match = prompt.match(/^\/(note-surgeon|atomic-split|vault-cartographer)(?:\s+([\s\S]+))?$/);
  if (!match) return null;
  const skill = BUILTIN_SKILLS.find((item) => item.id === match[1]);
  if (!skill) return null;
  return {
    skill,
    request: (match[2] || '').trim(),
  };
}
