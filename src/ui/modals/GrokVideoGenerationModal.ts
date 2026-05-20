import { Modal, Setting, type App } from 'obsidian';

export interface GrokVideoGenerationInput {
  prompt: string;
}

export class GrokVideoGenerationModal extends Modal {
  private resolve: ((value: GrokVideoGenerationInput | null) => void) | null = null;
  private prompt = '';

  constructor(app: App) {
    super(app);
  }

  openAndWait(): Promise<GrokVideoGenerationInput | null> {
    this.open();
    return new Promise((resolve) => {
      this.resolve = resolve;
    });
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: 'Generate Grok video' });
    contentEl.createEl('p', {
      text: 'Obsigravity will ask Grok Build to create a real MP4 from the active note, save it in the vault, and embed it at the top.',
    });

    new Setting(contentEl)
      .setName('Direction')
      .setDesc('Optional video style, duration, aspect ratio, narration, or platform instructions.')
      .addTextArea((text) => {
        text
          .setPlaceholder('Create a 10 second vertical briefing video with Korean title cards and subtle motion...')
          .onChange((value) => {
            this.prompt = value;
          });
        text.inputEl.rows = 6;
        text.inputEl.style.width = '100%';
      });

    new Setting(contentEl)
      .addButton((button) => {
        button
          .setButtonText('Generate MP4 with Grok Build')
          .setCta()
          .onClick(() => {
            this.resolve?.({ prompt: this.prompt });
            this.resolve = null;
            this.close();
          });
      })
      .addButton((button) => {
        button
          .setButtonText('Cancel')
          .onClick(() => {
            this.resolve?.(null);
            this.resolve = null;
            this.close();
          });
      });
  }

  onClose(): void {
    this.contentEl.empty();
    if (this.resolve) {
      this.resolve(null);
      this.resolve = null;
    }
  }
}
