# Obsigravity

Obsigravity is a desktop-only Obsidian plugin that connects your vault to the Antigravity CLI (`agy`).

V1 focuses on the capability that is currently native in the local Antigravity CLI environment: **image generation from the active note**. Antigravity-native video and TTS/audio briefing remain capability-gated until Antigravity exposes native tools for them; Grok Build video is available as an explicit external-CLI lane when `grok` is installed.

## What It Does

- **Antigravity sidebar in Obsidian**: Chat with Antigravity from a native Obsidian sidebar.
- **Active note context**: The current note, selected text, and pinned notes can be sent to Antigravity automatically.
- **Conversation history**: Reopen recent plugin conversations from the header history menu.
- **Built-in Obsidian skills**: Use `/note-surgeon`, `/atomic-split`, `/vault-cartographer`, `/skill-forge`, and `/sukgo` immediately after installation.
- **Claude/Gemini tool import**: Bring Claude Code or Gemini plugin packs into Antigravity through `agy plugin import`.
- **Claude-to-AGY conversion**: One-click convert local Claude Code skills and slash commands into an Antigravity plugin that AGY can validate, install, enable, and use.
- **Claude slash catalog**: Discover local Claude Code commands and skills so they appear in Obsigravity slash suggestions.
- **Local slash handling**: `/skills`, `/help`, and `/model` are handled inside Obsigravity instead of being sent to AGY as raw prompts.
- **Brief casual replies**: Simple greetings are answered locally instead of triggering active-note analysis.
- **No default vault scan**: Normal chat sends note text as context without exposing the whole vault as an AGY workspace.
- **External CLI detection**: Auto-detect optional Claude Code, Codex CLI, and Grok CLI installs so future slash-command routes can enable themselves only when available.
- **External CLI routing**: Use `/claude`, `/codex`, `/grok`, or `/collab` to call local Claude Code, Codex CLI, and Grok Build from the Obsidian sidebar with active-note context.
- **Model preference**: Choose a preferred AGY model lane from the sidebar or settings. Obsigravity passes the preference into each run while AGY keeps control of actual model switching.
- **Image generation from notes**: Draft a production prompt from the active note, review it, generate a raster image with Antigravity, save it into the vault, and embed it in the note.
- **Grok Build video generation**: Use the video button, command palette, or `/grok-video` to ask Grok Build to generate a real MP4 from the active note and embed it.
- **Capability probe**: Check native Antigravity support for image, video, and TTS without silently falling back to other providers.

## Built-in Obsidian Skills

Obsigravity ships with Obsidian-native skills. They do not require Claude Code skills to be installed.

- `/note-surgeon <optional direction>` repairs the active note: structure, headings, frontmatter, tags, callouts, duplicate sections, and link candidates.
- `/atomic-split <optional direction>` breaks a long active note or selected text into linked atomic notes and leaves a backlink/index trail in the source note.
- `/vault-cartographer <optional scope>` maps the active note neighborhood or a named folder into clusters, missing links, MOC candidates, orphan notes, and an optional Mermaid/JSON graph sketch.
- `/skill-forge <workflow idea>` turns an Obsidian workflow idea into a reusable slash skill contract, generated `SKILL.md`, test prompts, and an SDK upgrade path.
- `/sukgo <framework or question>` ports the sukgo decision-making workflow into Obsigravity. It can apply steelman, devil's advocate, premortem, 6 hats, inversion, 5 whys, decision matrix, first principles, OODA, Toulmin, or compare mode to the active note.

These skills run through Antigravity with active-note context and explicit workspace access. Normal chat remains note-context-only and does not scan the vault unless the user asks for mapping/search.

## Current Capability Boundary

Local testing showed:

| Capability | V1 status | Policy |
| --- | --- | --- |
| Image | Enabled | Uses Antigravity native image generation |
| Generative video | Experimental | Uses Grok Build when installed; AGY-native video remains disabled |
| TTS/audio briefing | Not enabled | Marked future/planned until native support exists |

Obsigravity does **not** use Gemini CLI/API, Vertex AI, Veo, browser recording, ffmpeg, HTML animation, SVG/code drawing, or placeholder files as hidden fallbacks for unsupported media lanes.

Memory Map was intentionally removed from the V1 surface. Obsigravity now focuses on Antigravity-native workspace control, imported skills, slash-command style prompting, pinned note context, and image generation instead of duplicating Obsidian note search.

## Requirements

- Obsidian desktop.
- Node.js 20+ for development.
- Antigravity CLI installed and authenticated.
- `agy` available on PATH, configured manually in plugin settings, or installed from the Obsigravity settings page.

On this machine, the CLI is typically detected at:

```text
~/.local/bin/agy
```

### Windows Notes

Obsigravity includes a Windows-specific Antigravity launch path for `agy --print`.
On Windows, GUI apps such as Obsidian do not provide the same terminal/TTY environment
as a normal shell. Older Obsigravity builds could therefore show only
`Antigravity process started` or return an empty/error response even though AGY had
completed a model round trip. The current build avoids `cmd.exe` argument mangling,
detects common official `agy.exe` install locations, and routes AGY through
`conhost.exe --headless` when needed so stdout reaches the plugin.

## One-click Setup

Open **Obsidian Settings -> Community plugins -> Obsigravity**.

The settings page includes:

- **Install / update AGY**: runs the official Antigravity CLI installer.
- **Start Google Sign-In**: starts Antigravity CLI so it can open the browser-based Google OAuth flow when no saved session exists.
- **Recheck**: verifies `agy --help` from Obsidian's environment and saves the detected CLI path.
- **Convert Claude skills**: generates `~/.gemini/obsigravity/plugins/obsigravity-claude-tools` from local Claude Code `SKILL.md` files and slash-command markdown, then runs `agy plugin validate`, `agy plugin install`, `agy plugin enable`, and `agy plugin list`.
- **Import Claude/Gemini plugins**: runs `agy plugin import claude`, `agy plugin import gemini`, or both.
- **Claude command discovery**: scans local Claude Code command and skill folders and exposes them in the slash picker.
- **External CLI connectors**: detects local `claude`, `codex`, and `grok` binaries and stores their paths for future provider routing.
- **Model preference**: stores your preferred AGY model and includes it in Obsigravity prompts.

## External CLI Collaboration

Obsigravity can call local companion CLIs when they are installed:

- `/claude <task>` sends the task to Claude Code CLI.
- `/codex <task>` sends the task to Codex CLI.
- `/grok <task>` sends the task to Grok Build CLI.
- `/grok-video <direction>` asks Grok Build to generate and embed an MP4 from the active note.
- `/sukgo <framework or question>` runs sukgo-style decision analysis against the active note.
- `/collab <task>` runs Claude, Codex, and Grok in parallel and renders a multi-model comparison.

The active note, selected text, and pinned notes are included as context. Permission mode maps conservatively into each CLI: Safe uses read-only/default behavior, Auto allows normal automatic workspace work where supported, and Yolo maps to each CLI's bypass/full-access mode.

For video, Grok Build must create a real playable MP4 at the exact vault-relative target path. Obsigravity refuses placeholders and embeds the file only after it exists.

Official install commands used by the plugin:

```bash
curl -fsSL https://antigravity.google/cli/install.sh | bash
```

```powershell
irm https://antigravity.google/cli/install.ps1 | iex
```

## BRAT Installation

Obsigravity is prepared for BRAT installation from GitHub releases.

1. Install **Obsidian42 - BRAT** from Obsidian Community Plugins.
2. Open BRAT settings.
3. Click **Add Beta Plugin**.
4. Paste:

```text
https://github.com/reallygood83/obsigravity
```

5. Enable **Obsigravity** in Obsidian Community Plugins.

Each release should include:

- `main.js`
- `manifest.json`
- `styles.css`

## Development

```bash
npm install
npm run build
```

Manual install for local development:

```text
<vault>/.obsidian/plugins/obsigravity/
  main.js
  manifest.json
  styles.css
```

Then enable **Obsigravity** in Obsidian settings.

## Security Notes

- Safe mode runs Antigravity with sandboxing.
- Auto and Yolo auto-approve Antigravity tool permission requests and should only be used in trusted, backed-up vaults.
- Generated files are saved inside the configured vault media folder.
- Obsigravity keeps AGY-native video/TTS disabled unless Antigravity exposes native generation support. Grok Build video is an explicit external-CLI lane.

## Contributors

- [reallygood83](https://github.com/reallygood83) - project creator and maintainer.
- [starhunt](https://github.com/starhunt) - Windows Antigravity CLI launch fix, including ConPTY handling and official `agy.exe` path detection.
