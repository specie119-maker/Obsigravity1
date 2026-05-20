import { Notice, PluginSettingTab, Setting } from 'obsidian';

import type ObsigravityPlugin from '../../main';
import { findAntigravityCli } from '../../core/antigravity/AntigravityCliResolver';
import {
  getAntigravityAuthPreview,
  getAntigravityInstallPreview,
  installAntigravityCli,
  probeAntigravityCli,
  startGoogleSignIn,
} from '../../core/installer/AntigravityInstaller';
import { buildProcessEnv } from '../../core/settings/env';
import type { PermissionMode } from '../../core/types';

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
}
