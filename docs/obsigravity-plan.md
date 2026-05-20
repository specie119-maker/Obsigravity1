# Obsigravity Plan

## One-line Concept

Obsigravity is an Obsidian-native Antigravity CLI workflow that turns the current note into a generated image artifact and embeds the result back into the vault.

## Product Thesis

Codexian proves the useful pattern: Obsidian note context can drive a local AI CLI, show progress, save generated assets, and insert Markdown embeds. Obsigravity applies that pattern to Antigravity CLI with an agent-runtime identity: note context, local file workflow, capability probing, and an expansion path through Antigravity plugins, MCP, skills, hooks, and subagents.

## V1 Success Workflow

1. Open or select an Obsidian note.
2. Click `Generate Obsigravity image from active note`.
3. Obsigravity reads the active note and selected text.
4. Obsigravity asks Antigravity CLI to draft a note-aware image prompt.
5. The user reviews the prompt.
6. Obsigravity runs Antigravity native image generation.
7. The generated raster image is saved to the configured vault media folder.
8. The note receives an Obsidian Markdown embed for the image.

## Product Principles

- Antigravity-first: v1 does not silently fall back to Gemini CLI/API or other providers.
- Obsidian-native: files live in the vault and embeds remain normal Markdown.
- Trust-mode based: safe by default, automation by explicit opt-in.
- Capability-honest: unsupported outputs are shown as unavailable/planned.
- Preview before mutation in Safe mode.
- Image-first v1: video and TTS stay future lanes until native Antigravity support is verified.

## Trust Modes

| Mode | CLI generation | Vault save | Note embed |
| --- | --- | --- | --- |
| Safe | after plan preview | after approval | after preview/approval |
| Auto | automatic | automatic | approval required |
| Yolo | automatic | automatic | automatic after opt-in |

## V1 Feature Set

- Antigravity CLI path detection for `agy` / `antigravity`.
- CLI diagnostics and setup hints.
- Active note and selected-text context.
- Obsigravity image prompt planner.
- Capability probe for image, video, and audio outputs.
- Media output folder setting.
- Progress modal or sidebar timeline.
- Markdown embed insertion below YAML frontmatter.
- Safe/Auto/Yolo automation modes.

## Technical Shape

Recommended modules:

- `AntigravityCliResolver`
- `AntigravityProvider`
- `NoteContextService`
- `ObsigravityImagePlanner`
- `ObsigravityImageRunner`
- `MediaAssetService`
- `EmbedService`
- `ObsigravityView`
- `ObsigravitySettingsTab`

## Open Risk

Local probes confirmed native image generation through Antigravity's `generate_image` capability, but did not confirm native generative video or TTS. `agy --help` currently shows general prompt/print and plugin-management commands, not direct image/video/TTS subcommands. The v1 UI should therefore expose image generation and keep video/TTS capability-gated.

## Next Step

Ship the image lane first, then revisit video/TTS only if Antigravity CLI exposes native tools or the product rule changes to allow non-Antigravity fallback providers.
