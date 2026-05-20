# Obsigravity

Obsigravity is a desktop-only Obsidian plugin that connects your vault to the Antigravity CLI (`agy`).

V1 focuses on the capability that is currently native in the local Antigravity CLI environment: **image generation from the active note**. Video generation and TTS/audio briefing are intentionally capability-gated until Antigravity exposes native tools for them.

## What It Does

- **Antigravity sidebar in Obsidian**: Chat with Antigravity from a native Obsidian sidebar.
- **Active note context**: The current note, selected text, and pinned notes can be sent to Antigravity automatically.
- **Conversation history**: Reopen recent plugin conversations from the header history menu.
- **Claude/Gemini tool import**: Bring Claude Code or Gemini plugin packs into Antigravity through `agy plugin import`.
- **Claude slash catalog**: Discover local Claude Code commands and skills so they appear in Obsigravity slash suggestions.
- **Local slash handling**: `/skills`, `/help`, and `/model` are handled inside Obsigravity instead of being sent to AGY as raw prompts.
- **Brief casual replies**: Simple greetings are answered locally instead of triggering active-note analysis.
- **External CLI detection**: Auto-detect optional Claude Code, Codex CLI, and Grok CLI installs so future slash-command routes can enable themselves only when available.
- **Model preference**: Choose a preferred AGY model lane from the sidebar or settings. Obsigravity passes the preference into each run while AGY keeps control of actual model switching.
- **Image generation from notes**: Draft a production prompt from the active note, review it, generate a raster image with Antigravity, save it into the vault, and embed it in the note.
- **Capability probe**: Check native Antigravity support for image, video, and TTS without silently falling back to other providers.

## Current Capability Boundary

Local testing showed:

| Capability | V1 status | Policy |
| --- | --- | --- |
| Image | Enabled | Uses Antigravity native image generation |
| Generative video | Not enabled | Marked future/planned until native support exists |
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

## One-click Setup

Open **Obsidian Settings -> Community plugins -> Obsigravity**.

The settings page includes:

- **Install / update AGY**: runs the official Antigravity CLI installer.
- **Start Google Sign-In**: starts Antigravity CLI so it can open the browser-based Google OAuth flow when no saved session exists.
- **Recheck**: verifies `agy --help` from Obsidian's environment and saves the detected CLI path.
- **Import Claude/Gemini plugins**: runs `agy plugin import claude`, `agy plugin import gemini`, or both.
- **Claude command discovery**: scans local Claude Code command and skill folders and exposes them in the slash picker.
- **External CLI connectors**: detects local `claude`, `codex`, and `grok` binaries and stores their paths for future provider routing.
- **Model preference**: stores your preferred AGY model and includes it in Obsigravity prompts.

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
- Obsigravity keeps video/TTS disabled unless Antigravity exposes native generation support.
