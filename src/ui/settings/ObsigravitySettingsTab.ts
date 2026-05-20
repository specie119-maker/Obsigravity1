import { PluginSettingTab, Setting } from 'obsidian';

import type ObsigravityPlugin from '../../main';
import { findAntigravityCli } from '../../core/antigravity/AntigravityCliResolver';
import { buildProcessEnv } from '../../core/settings/env';
import type { PermissionMode } from '../../core/types';

export class ObsigravitySettingsTab extends PluginSettingTab {
  plugin: ObsigravityPlugin;

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
}
