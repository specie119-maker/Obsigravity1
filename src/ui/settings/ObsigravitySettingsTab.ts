import { Notice, PluginSettingTab, Setting } from 'obsidian';

import type ObsigravityPlugin from '../../main';
import { findAntigravityCli } from '../../core/antigravity/AntigravityCliResolver';
import { detectExternalClis, EXTERNAL_CLI_DEFINITIONS, type ExternalCliId } from '../../core/cli/ExternalCliResolver';
import {
  importAntigravityPlugins,
  getAntigravityAuthPreview,
  getAntigravityInstallPreview,
  installAntigravityCli,
  listAntigravityPlugins,
  probeAntigravityCli,
  startGoogleSignIn,
  type AntigravityPluginImportSource,
} from '../../core/installer/AntigravityInstaller';
import { buildProcessEnv } from '../../core/settings/env';
import type { PermissionMode, PreferredModel } from '../../core/types';

export class ObsigravitySettingsTab extends PluginSettingTab {
  plugin: ObsigravityPlugin;
  private setupLogEl: HTMLElement | null = null;

  constructor(plugin: ObsigravityPlugin) {
    super(plugin.app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl('h2', { text: 'Obsigravity' });

    const antigravityCard = containerEl.createDiv({ cls: 'obsigravity-settings-card' });
    antigravityCard.createEl('h3', { text: 'Antigravity CLI' });
    antigravityCard.createEl('p', {
      text: 'Obsigravity uses Antigravity CLI as the native agent runtime for note-derived image generation. Video and TTS remain capability-gated until Antigravity exposes native support.',
    });
    const detectedAntigravity = findAntigravityCli('', buildProcessEnv(this.plugin.settings.environmentVariables).PATH);
    antigravityCard.createEl('p', {
      cls: 'obsigravity-settings-hint',
      text: detectedAntigravity ? `Detected Antigravity CLI: ${detectedAntigravity}` : 'Antigravity CLI was not auto-detected yet.',
    });

    new Setting(antigravityCard)
      .setName('Antigravity CLI path')
      .setDesc('Leave empty for auto-detection. The CLI is usually named agy.')
      .addText((text) => text
        .setPlaceholder(process.platform === 'win32' ? 'C:\\Users\\you\\AppData\\Local\\antigravity-cli\\agy.exe' : '/Users/you/.local/bin/agy')
        .setValue(this.plugin.settings.antigravityCliPath)
        .onChange(async (value) => {
          this.plugin.settings.antigravityCliPath = value.trim();
          await this.plugin.saveSettings();
        }))
      .addButton((button) => button
        .setButtonText('Use detected')
        .setDisabled(!detectedAntigravity)
        .onClick(async () => {
          if (!detectedAntigravity) return;
          this.plugin.settings.antigravityCliPath = detectedAntigravity;
          await this.plugin.saveSettings();
          this.display();
        }));

    const setupCard = containerEl.createDiv({ cls: 'obsigravity-settings-card' });
    setupCard.createEl('h3', { text: 'One-click setup' });
    setupCard.createEl('p', {
      text: 'Install Antigravity CLI, start Google Sign-In, then recheck detection without leaving Obsidian.',
    });
    setupCard.createEl('pre', {
      cls: 'obsigravity-status-line',
      text: [
        getAntigravityInstallPreview(),
        getAntigravityAuthPreview(this.plugin.settings.antigravityCliPath || detectedAntigravity || 'agy'),
      ].join('\n'),
    });

    new Setting(setupCard)
      .addButton((button) => button
        .setButtonText('Install / update AGY')
        .setCta()
        .onClick(() => void this.installAntigravity()))
      .addButton((button) => button
        .setButtonText('Start Google Sign-In')
        .onClick(() => void this.startSignIn()))
      .addButton((button) => button
        .setButtonText('Recheck')
        .onClick(() => void this.recheckAntigravity()));

    this.setupLogEl = setupCard.createEl('pre', {
      cls: 'obsigravity-status-line',
      text: detectedAntigravity
        ? `Ready: ${detectedAntigravity}`
        : 'Antigravity CLI is not detected yet.',
    });

    new Setting(antigravityCard)
      .setName('Model preference')
      .setDesc('Stored as an Obsigravity preference and passed into AGY prompts. AGY still owns the actual model switch.')
      .addDropdown((dropdown) => dropdown
        .addOption('default', 'AGY default')
        .addOption('gemini-3.1-pro-high', 'Gemini 3.1 Pro High')
        .addOption('gemini-3.1-pro-low', 'Gemini 3.1 Pro Low')
        .addOption('gemini-3-flash', 'Gemini 3 Flash')
        .addOption('claude-sonnet-4.6-thinking', 'Claude Sonnet 4.6 Thinking')
        .addOption('claude-opus-4.6-thinking', 'Claude Opus 4.6 Thinking')
        .addOption('gpt-oss-120b', 'GPT-OSS-120b')
        .setValue(this.plugin.settings.preferredModel)
        .onChange(async (value) => {
          this.plugin.settings.preferredModel = value as PreferredModel;
          await this.plugin.saveSettings();
        }));

    const pluginCard = containerEl.createDiv({ cls: 'obsigravity-settings-card' });
    pluginCard.createEl('h3', { text: 'Skills and slash tools' });
    pluginCard.createEl('p', {
      text: 'Import Claude Code or Gemini plugin packs into Antigravity with agy plugin import, then use their skills and slash-command surfaces from Obsigravity prompts.',
    });
    new Setting(pluginCard)
      .addButton((button) => button
        .setButtonText('Import Claude')
        .setCta()
        .onClick(() => void this.importPlugins('claude')))
      .addButton((button) => button
        .setButtonText('Import Gemini')
        .onClick(() => void this.importPlugins('gemini')))
      .addButton((button) => button
        .setButtonText('Import all')
        .onClick(() => void this.importPlugins('all')))
      .addButton((button) => button
        .setButtonText('List plugins')
        .onClick(() => void this.listPlugins()));

    pluginCard.createEl('p', {
      cls: 'obsigravity-settings-hint',
      text: 'Obsigravity does not copy secrets. Imports are delegated to the local AGY plugin manager.',
    });

    const externalCliCard = containerEl.createDiv({ cls: 'obsigravity-settings-card' });
    externalCliCard.createEl('h3', { text: 'External CLI connectors' });
    externalCliCard.createEl('p', {
      text: 'Obsigravity can detect optional local CLIs and later route slash-command tasks to them. Missing CLIs stay disabled instead of blocking the plugin.',
    });
    const detectedExternal = detectExternalClis(
      this.plugin.settings.externalCliPaths,
      buildProcessEnv(this.plugin.settings.environmentVariables).PATH,
    );

    for (const definition of EXTERNAL_CLI_DEFINITIONS) {
      const detected = detectedExternal[definition.id];
      new Setting(externalCliCard)
        .setName(definition.name)
        .setDesc(detected ? `Detected: ${detected}` : 'Not detected. Leave empty unless you installed this CLI.')
        .addText((text) => text
          .setPlaceholder(definition.commandNames[0])
          .setValue(this.plugin.settings.externalCliPaths[definition.id])
          .onChange(async (value) => {
            this.plugin.settings.externalCliPaths[definition.id] = value.trim();
            await this.plugin.saveSettings();
          }))
        .addButton((button) => button
          .setButtonText('Use detected')
          .setDisabled(!detected)
          .onClick(async () => {
            if (!detected) return;
            this.plugin.settings.externalCliPaths[definition.id] = detected;
            await this.plugin.saveSettings();
            this.display();
          }));
    }

    new Setting(externalCliCard)
      .addButton((button) => button
        .setButtonText('Auto-detect all')
        .setCta()
        .onClick(() => void this.autodetectExternalClis()));

    new Setting(antigravityCard)
      .setName('Permission mode')
      .setDesc('Safe runs Antigravity sandboxed. Auto and Yolo auto-approve CLI tool permission requests.')
      .addDropdown((dropdown) => dropdown
        .addOption('review', 'Safe')
        .addOption('auto', 'Auto')
        .addOption('yolo', 'Yolo')
        .setValue(this.plugin.settings.permissionMode)
        .onChange(async (value) => {
          this.plugin.settings.permissionMode = value as PermissionMode;
          await this.plugin.saveSettings();
        }));

    new Setting(antigravityCard)
      .setName('Probe media capabilities')
      .setDesc('Checks native Antigravity support for image, video, and TTS without enabling fallback providers.')
      .addButton((button) => button
        .setButtonText('Probe')
        .onClick(() => void this.plugin.probeAntigravityCapabilities()));

    new Setting(antigravityCard)
      .setName('Auto-include active note')
      .setDesc('Automatically attach the currently open markdown note to every Antigravity prompt.')
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.autoIncludeActiveNote)
        .onChange(async (value) => {
          this.plugin.settings.autoIncludeActiveNote = value;
          await this.plugin.saveSettings();
        }));

    const envCard = containerEl.createDiv({ cls: 'obsigravity-settings-card' });
    envCard.createEl('h3', { text: 'Environment' });
    new Setting(envCard)
      .setName('Environment variables')
      .setDesc('One KEY=VALUE per line. Use this mainly to expose PATH so Obsidian can find agy.')
      .addTextArea((text) => {
        text
          .setPlaceholder('PATH=/Users/you/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin')
          .setValue(this.plugin.settings.environmentVariables)
          .onChange(async (value) => {
            this.plugin.settings.environmentVariables = value;
            await this.plugin.saveSettings();
          });
        text.inputEl.rows = 6;
        text.inputEl.style.width = '100%';
      });

    const imageCard = containerEl.createDiv({ cls: 'obsigravity-settings-card' });
    imageCard.createEl('h3', { text: 'Image assets' });
    imageCard.createEl('p', {
      text: 'Generated images are saved in the vault and embedded into the active note after prompt review.',
    });
    new Setting(imageCard)
      .setName('Media folder')
      .addText((text) => text
        .setValue(this.plugin.settings.mediaFolder)
        .onChange(async (value) => {
          this.plugin.settings.mediaFolder = value.trim() || 'attachments/obsigravity';
          await this.plugin.saveSettings();
        }));
  }

  private appendSetupLog(line: string): void {
    if (!this.setupLogEl) return;
    this.setupLogEl.appendText(line);
    this.setupLogEl.scrollTop = this.setupLogEl.scrollHeight;
  }

  private resetSetupLog(message: string): void {
    if (!this.setupLogEl) return;
    this.setupLogEl.setText(`${message}\n`);
  }

  private async installAntigravity(): Promise<void> {
    this.resetSetupLog('Installing Antigravity CLI...');
    try {
      const detected = await installAntigravityCli(this.plugin.settings.environmentVariables, (line) => this.appendSetupLog(line));
      if (detected) {
        this.plugin.settings.antigravityCliPath = detected;
        await this.plugin.saveSettings();
      }
      new Notice('Antigravity CLI install finished.');
      this.display();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.appendSetupLog(`\nFAILED: ${message}\n`);
      new Notice(`Antigravity install failed: ${message}`);
    }
  }

  private async startSignIn(): Promise<void> {
    this.resetSetupLog('Starting Google Sign-In through Antigravity CLI...');
    try {
      await startGoogleSignIn(
        this.plugin.settings.antigravityCliPath,
        this.plugin.settings.environmentVariables,
        this.plugin.getVaultPath(),
        (line) => this.appendSetupLog(line),
      );
      new Notice('Google Sign-In check completed.');
      await this.recheckAntigravity(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.appendSetupLog(`\nFAILED: ${message}\n`);
      new Notice(`Google Sign-In failed: ${message}`);
    }
  }

  private async recheckAntigravity(showNotice = true): Promise<void> {
    this.resetSetupLog('Rechecking Antigravity CLI...');
    try {
      const detected = await probeAntigravityCli(
        this.plugin.settings.antigravityCliPath,
        this.plugin.settings.environmentVariables,
        (line) => this.appendSetupLog(line),
      );
      if (detected) {
        this.plugin.settings.antigravityCliPath = detected;
        await this.plugin.saveSettings();
        this.appendSetupLog(`\nReady: ${detected}\n`);
      }
      if (showNotice) new Notice(detected ? 'Antigravity CLI is ready.' : 'Antigravity CLI was not found.');
      this.display();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.appendSetupLog(`\nFAILED: ${message}\n`);
      if (showNotice) new Notice(`Antigravity recheck failed: ${message}`);
    }
  }

  private async importPlugins(source: AntigravityPluginImportSource): Promise<void> {
    this.resetSetupLog(`Importing ${source} Antigravity plugins...`);
    try {
      await importAntigravityPlugins(
        source,
        this.plugin.settings.antigravityCliPath,
        this.plugin.settings.environmentVariables,
        this.plugin.getVaultPath(),
        (line) => this.appendSetupLog(line),
      );
      new Notice(`Antigravity plugin import finished: ${source}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.appendSetupLog(`\nFAILED: ${message}\n`);
      new Notice(`Antigravity plugin import failed: ${message}`);
    }
  }

  private async listPlugins(): Promise<void> {
    this.resetSetupLog('Listing Antigravity plugins...');
    try {
      await listAntigravityPlugins(
        this.plugin.settings.antigravityCliPath,
        this.plugin.settings.environmentVariables,
        this.plugin.getVaultPath(),
        (line) => this.appendSetupLog(line),
      );
      new Notice('Antigravity plugin list completed.');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.appendSetupLog(`\nFAILED: ${message}\n`);
      new Notice(`Antigravity plugin list failed: ${message}`);
    }
  }

  private async autodetectExternalClis(): Promise<void> {
    await this.plugin.autodetectExternalClis();
    const detected = detectExternalClis(
      this.plugin.settings.externalCliPaths,
      buildProcessEnv(this.plugin.settings.environmentVariables).PATH,
    );
    const found = (Object.entries(detected) as Array<[ExternalCliId, string | null]>)
      .filter(([, cliPath]) => Boolean(cliPath))
      .map(([id, cliPath]) => `${id}: ${cliPath}`)
      .join('\n');

    new Notice(found ? 'External CLI detection completed.' : 'No external CLIs detected.');
    this.display();
    this.resetSetupLog(found ? `Detected external CLIs:\n${found}` : 'No external CLIs detected.');
  }
}
