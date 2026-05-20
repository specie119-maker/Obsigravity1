import { ItemView, MarkdownRenderer, Notice, setIcon, type TFile, type WorkspaceLeaf } from 'obsidian';

import type ObsigravityPlugin from '../main';
import type { ConversationMessage, ConversationSession, MemoryMapResult, PermissionMode } from '../core/types';

export const VIEW_TYPE_OBSIGRAVITY = 'obsigravity-view';

const OBSIGRAVITY_LOGO = {
  viewBox: '0 0 24 24',
  path: 'M12 2.8a4.2 4.2 0 0 1 3.64 2.1 4.2 4.2 0 0 1 5.56 5.56A4.2 4.2 0 0 1 19.1 14.1a4.2 4.2 0 0 1-5.56 5.56A4.2 4.2 0 0 1 9.9 21.2a4.2 4.2 0 0 1-5.56-5.56A4.2 4.2 0 0 1 2.8 12a4.2 4.2 0 0 1 2.1-3.64A4.2 4.2 0 0 1 10.46 2.8 4.4 4.4 0 0 1 12 2.8Zm0 2.1a2.1 2.1 0 0 0-1.05.28L7.32 7.27a2.1 2.1 0 0 0-1.05 1.82v4.18a2.1 2.1 0 0 0 1.05 1.82l3.63 2.09a2.1 2.1 0 0 0 2.1 0l3.63-2.09a2.1 2.1 0 0 0 1.05-1.82V9.09a2.1 2.1 0 0 0-1.05-1.82l-3.63-2.09A2.1 2.1 0 0 0 12 4.9Zm0 3.1 3.46 2v4L12 16l-3.46-2v-4L12 8Z',
};

const ANTIGRAVITY_SLASH_COMMANDS = [
  { name: '/help', hint: 'Show Antigravity help', description: 'Ask Antigravity CLI for available commands and usage.' },
  { name: '/status', hint: 'Show agent status', description: 'Ask Antigravity to summarize workspace, permissions, and active note context.' },
  { name: '/probe', hint: 'Probe media support', description: 'Check native image, video, and TTS capability honesty.' },
  { name: '/image', hint: 'Generate image', description: 'Generate an Antigravity-native image from the active note.' },
  { name: '/diff', hint: 'Review vault changes', description: 'Ask Antigravity to summarize local file changes.' },
  { name: '/memory', hint: 'Context notes', description: 'Ask Antigravity to use active and pinned note context.' },
];

export class ObsigravityView extends ItemView {
  private plugin: ObsigravityPlugin;
  private messagesEl: HTMLElement | null = null;
  private inputEl: HTMLTextAreaElement | null = null;
  private memoryMapEl: HTMLElement | null = null;
  private fileIndicatorEl: HTMLElement | null = null;
  private selectionIndicatorEl: HTMLElement | null = null;
  private slashDropdownEl: HTMLElement | null = null;
  private historyMenuEl: HTMLElement | null = null;
  private welcomeEl: HTMLElement | null = null;
  private messages: ConversationMessage[] = [];
  private currentConversationId: string | null = null;
  private relatedNotes: MemoryMapResult[] = [];
  private hiddenRelatedPaths = new Set<string>();
  private memoryMapRenderToken = 0;
  private isMemoryMapExpanded = true;
  private isRunning = false;
  private selectedSlashCommandIndex = 0;

  constructor(leaf: WorkspaceLeaf, plugin: ObsigravityPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_TYPE_OBSIGRAVITY;
  }

  getDisplayText(): string {
    return 'Obsigravity';
  }

  getIcon(): string {
    return 'bot';
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass('oc-container');

    const header = container.createDiv({ cls: 'oc-header' });
    this.buildHeader(header);

    this.messagesEl = container.createDiv({ cls: 'oc-messages' });
    this.restoreActiveConversation();

    const inputContainerEl = container.createDiv({ cls: 'oc-input-container' });
    this.buildInputArea(inputContainerEl);

    this.registerEvent(this.app.workspace.on('active-leaf-change', () => this.renderFileChips()));
    this.registerEvent(this.app.workspace.on('file-open', () => {
      this.relatedNotes = [];
      this.hiddenRelatedPaths.clear();
      this.renderMemoryMapPanel();
      this.renderFileChips();
    }));
    this.registerDomEvent(document, 'click', () => this.hideHistoryMenu());
    void this.renderMemoryMapPanel();
    this.renderFileChips();
  }

  async onClose(): Promise<void> {
    this.plugin.agent.cancel();
  }

  refreshContextChips(): void {
    void this.renderMemoryMapPanel();
    this.renderFileChips();
  }

  private buildHeader(header: HTMLElement): void {
    const titleContainer = header.createDiv({ cls: 'oc-title' });
    const logoEl = titleContainer.createSpan({ cls: 'oc-logo' });
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', OBSIGRAVITY_LOGO.viewBox);
    svg.setAttribute('width', '18');
    svg.setAttribute('height', '18');
    svg.setAttribute('fill', 'none');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', OBSIGRAVITY_LOGO.path);
    path.setAttribute('fill', 'currentColor');
    svg.appendChild(path);
    logoEl.appendChild(svg);
    titleContainer.createEl('h4', { text: 'Obsigravity' });

    const headerActions = header.createDiv({ cls: 'oc-header-actions' });

    const historyContainer = headerActions.createDiv({ cls: 'oc-history-container' });
    const historyBtn = historyContainer.createDiv({ cls: 'oc-header-btn' });
    setIcon(historyBtn, 'history');
    historyBtn.setAttribute('aria-label', 'Show conversation history');
    historyBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      this.toggleHistoryMenu();
    });
    this.historyMenuEl = historyContainer.createDiv({ cls: 'oc-history-menu' });
    this.historyMenuEl.addEventListener('click', (event) => event.stopPropagation());
    this.renderHistoryMenu();

    const visualBtn = headerActions.createDiv({ cls: 'oc-header-btn' });
    setIcon(visualBtn, 'image');
    visualBtn.setAttribute('aria-label', 'Generate Obsigravity image from note');
    visualBtn.addEventListener('click', () => void this.plugin.generateImageFromActiveNote());

    const newBtn = headerActions.createDiv({ cls: 'oc-header-btn' });
    setIcon(newBtn, 'plus');
    newBtn.setAttribute('aria-label', 'New conversation');
    newBtn.addEventListener('click', () => this.createNewConversation());
  }

  private buildInputArea(inputContainerEl: HTMLElement): void {
    const inputWrapper = inputContainerEl.createDiv({ cls: 'oc-input-wrapper' });

    this.selectionIndicatorEl = inputWrapper.createDiv({ cls: 'oc-selection-indicator' });
    this.selectionIndicatorEl.style.display = 'none';

    this.memoryMapEl = inputWrapper.createDiv({ cls: 'oc-memory-map-panel' });

    this.fileIndicatorEl = inputWrapper.createDiv({ cls: 'oc-file-indicator' });

    this.inputEl = inputWrapper.createEl('textarea', {
      cls: 'oc-input',
      attr: {
        placeholder: 'Ask Antigravity about this vault...',
        rows: '3',
      },
    });
    this.inputEl.addEventListener('keydown', (event) => {
      if (this.handleSlashKeydown(event)) return;
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        void this.submit();
      }
    });
    this.inputEl.addEventListener('input', () => {
      this.autoResizeInput();
      this.renderSlashCommands();
    });
    this.inputEl.addEventListener('blur', () => {
      window.setTimeout(() => this.hideSlashCommands(), 120);
    });

    this.slashDropdownEl = inputWrapper.createDiv({ cls: 'oc-slash-dropdown' });
    this.slashDropdownEl.addEventListener('wheel', (event) => event.stopPropagation());

    const toolbar = inputWrapper.createDiv({ cls: 'oc-input-toolbar' });
    this.buildPermissionToggle(toolbar);

    const sendBtn = toolbar.createDiv({ cls: 'oc-header-btn oc-send-btn', attr: { 'aria-label': 'Send message' } });
    setIcon(sendBtn, 'send');
    sendBtn.addEventListener('click', () => void this.submit());
  }

  private buildPermissionToggle(parent: HTMLElement): void {
    const toggle = parent.createDiv({ cls: 'oc-permission-toggle' });
    const label = toggle.createSpan({ cls: 'oc-permission-label' });
    const switchEl = toggle.createDiv({ cls: 'oc-toggle-switch' });
    this.updatePermissionToggle(label, switchEl);
    toggle.addEventListener('click', async () => {
      this.plugin.settings.permissionMode = this.nextPermissionMode(this.plugin.settings.permissionMode);
      await this.plugin.saveSettings();
      this.updatePermissionToggle(label, switchEl);
    });
  }

  private updatePermissionToggle(label: HTMLElement, switchEl: HTMLElement): void {
    const mode = this.plugin.settings.permissionMode;
    switchEl.toggleClass('active', mode === 'auto' || mode === 'yolo');
    label.setText(mode === 'review' ? 'Safe' : mode === 'auto' ? 'AUTO' : 'Yolo');
  }

  private nextPermissionMode(mode: PermissionMode): PermissionMode {
    if (mode === 'review') return 'auto';
    if (mode === 'auto') return 'yolo';
    return 'review';
  }

  private renderWelcome(): void {
    if (!this.welcomeEl) return;
    this.welcomeEl.empty();
    this.welcomeEl.createDiv({ cls: 'oc-welcome-greeting', text: 'How can I help you today?' });
  }

  private async renderMemoryMapPanel(): Promise<void> {
    if (!this.memoryMapEl) return;
    const renderToken = ++this.memoryMapRenderToken;

    const status = await this.plugin.getMemoryMapStatus();
    if (renderToken !== this.memoryMapRenderToken || !this.memoryMapEl) return;

    this.memoryMapEl.empty();
    this.memoryMapEl.toggleClass('is-collapsed', !this.isMemoryMapExpanded);
    const header = this.memoryMapEl.createDiv({ cls: 'oc-memory-map-header' });
    const title = header.createDiv({ cls: 'oc-memory-map-title' });
    title.setAttribute('role', 'button');
    title.setAttribute('aria-expanded', String(this.isMemoryMapExpanded));
    title.addEventListener('click', async () => {
      this.isMemoryMapExpanded = !this.isMemoryMapExpanded;
      await this.renderMemoryMapPanel();
    });
    setIcon(title.createSpan({ cls: 'oc-memory-map-toggle' }), this.isMemoryMapExpanded ? 'chevron-down' : 'chevron-right');
    setIcon(title.createSpan({ cls: 'oc-memory-map-icon' }), 'network');
    title.createSpan({ text: status.built ? `Memory Map · ${status.count} notes` : 'Memory Map not built' });

    const actions = header.createDiv({ cls: 'oc-memory-map-actions' });
    if (this.relatedNotes.length > 0) {
      const clearBtn = actions.createEl('button', { cls: 'oc-memory-map-btn', text: 'Clear' });
      clearBtn.addEventListener('click', async () => {
        this.relatedNotes = [];
        this.hiddenRelatedPaths.clear();
        await this.renderMemoryMapPanel();
      });
    }

    const buildBtn = actions.createEl('button', { cls: 'oc-memory-map-btn', text: status.built ? 'Rebuild' : 'Build Memory Map' });
    buildBtn.addEventListener('click', async () => {
      buildBtn.setText('Building...');
      await this.plugin.buildMemoryMap();
      await this.renderMemoryMapPanel();
    });

    const findBtn = actions.createEl('button', { cls: 'oc-memory-map-btn oc-memory-map-primary', text: 'Find Context' });
    findBtn.disabled = !Boolean(this.plugin.getActiveMarkdownFile());
    findBtn.addEventListener('click', async () => {
      findBtn.setText('Finding...');
      this.relatedNotes = await this.plugin.findRelatedNotes();
      this.hiddenRelatedPaths.clear();
      this.isMemoryMapExpanded = true;
      await this.renderMemoryMapPanel();
    });

    if (!this.isMemoryMapExpanded) return;

    const visibleResults = this.relatedNotes.filter((result) => !this.hiddenRelatedPaths.has(result.path));
    if (visibleResults.length === 0) {
      const hint = this.memoryMapEl.createDiv({ cls: 'oc-memory-map-hint' });
      hint.setText(status.built ? 'Click Find Context to recommend related notes.' : 'Build once, then find related notes from this vault.');
      return;
    }

    const list = this.memoryMapEl.createDiv({ cls: 'oc-memory-map-results' });
    for (const result of visibleResults) {
      this.createRelatedNoteChip(list, result);
    }
  }

  private createRelatedNoteChip(parent: HTMLElement, result: MemoryMapResult): void {
    const chip = parent.createDiv({ cls: 'oc-memory-chip' });
    chip.addEventListener('click', () => void this.openNote(result.path));

    const name = chip.createSpan({ cls: 'oc-memory-chip-name', text: result.title });
    name.setAttribute('title', result.path);
    chip.createSpan({ cls: 'oc-memory-chip-reason', text: result.reasons[0] || `score ${result.score}` });

    const tooltip = chip.createDiv({ cls: 'oc-memory-chip-tooltip' });
    tooltip.createDiv({ cls: 'oc-memory-tooltip-title', text: result.title });
    tooltip.createDiv({ cls: 'oc-memory-tooltip-path', text: result.path });
    const reasons = tooltip.createDiv({ cls: 'oc-memory-tooltip-reasons' });
    if (result.reasons.length > 0) {
      for (const reason of result.reasons) {
        reasons.createDiv({ cls: 'oc-memory-tooltip-reason', text: reason });
      }
    } else {
      reasons.createDiv({ cls: 'oc-memory-tooltip-reason', text: '규칙 기반 점수로 추천됨' });
    }
    tooltip.createDiv({ cls: 'oc-memory-tooltip-score', text: `Relevance score ${result.score}` });

    const add = chip.createSpan({ cls: 'oc-memory-chip-action' });
    setIcon(add, 'plus');
    add.setAttribute('aria-label', 'Add note to Obsigravity context');
    add.setAttribute('title', 'Add to context');
    add.addEventListener('click', async (event) => {
      event.stopPropagation();
      await this.plugin.pinNote(result.path);
      this.renderFileChips();
      new Notice(`Added context: ${result.title}`);
    });

    const hide = chip.createSpan({ cls: 'oc-memory-chip-action' });
    setIcon(hide, 'x');
    hide.setAttribute('aria-label', 'Hide recommendation');
    hide.setAttribute('title', 'Hide this recommendation');
    hide.addEventListener('click', async (event) => {
      event.stopPropagation();
      this.hiddenRelatedPaths.add(result.path);
      await this.renderMemoryMapPanel();
    });
  }

  private renderFileChips(): void {
    if (!this.fileIndicatorEl) return;
    this.fileIndicatorEl.empty();

    const activeFile = this.plugin.getActiveMarkdownFile();
    if (activeFile && !this.plugin.isNoteExcluded(activeFile.path)) {
      this.createFileChip(activeFile.path, {
        current: this.plugin.settings.autoIncludeActiveNote,
        pinned: this.plugin.isNotePinned(activeFile.path),
      });
    }

    for (const pinnedPath of this.plugin.settings.pinnedNotePaths) {
      if (pinnedPath === activeFile?.path) continue;
      if (this.plugin.isNoteExcluded(pinnedPath)) continue;
      this.createFileChip(pinnedPath, { pinned: true });
    }

    const hasChips = this.fileIndicatorEl.children.length > 0;
    this.fileIndicatorEl.style.display = hasChips ? 'flex' : 'none';
  }

  private createFileChip(filePath: string, options: { current?: boolean; pinned?: boolean }): void {
    if (!this.fileIndicatorEl) return;
    const chip = this.fileIndicatorEl.createDiv({ cls: 'oc-file-chip' });
    if (options.pinned) {
      chip.addClass('oc-file-chip-pinned');
    } else if (options.current) {
      chip.addClass('oc-file-chip-current');
    } else {
      chip.addClass('oc-file-chip-attached');
    }

    const icon = chip.createSpan({ cls: 'oc-file-chip-icon' });
    setIcon(icon, 'file-text');
    const normalizedPath = filePath.replace(/\\/g, '/');
    const filename = normalizedPath.split('/').pop() || filePath;
    const name = chip.createSpan({ cls: 'oc-file-chip-name', text: filename });
    name.setAttribute('title', options.current ? `Current: ${filePath}` : filePath);

    const pin = chip.createSpan({ cls: 'oc-file-chip-pin' });
    setIcon(pin, options.pinned ? 'pin-off' : 'pin');
    pin.setAttribute('aria-label', options.pinned ? 'Unpin note' : 'Pin note');
    pin.setAttribute('title', options.pinned ? 'Pinned - click to unpin' : 'Click to pin this note');
    pin.addEventListener('click', async (event) => {
      event.stopPropagation();
      if (this.plugin.isNotePinned(filePath)) await this.plugin.unpinNote(filePath);
      else await this.plugin.pinNote(filePath);
      this.renderFileChips();
    });

    const remove = chip.createSpan({ cls: 'oc-file-chip-remove' });
    setIcon(remove, 'x');
    remove.setAttribute('aria-label', 'Remove note from Obsigravity context');
    remove.setAttribute('title', 'Remove this note from the chat context');
    remove.addEventListener('click', async (event) => {
      event.stopPropagation();
      await this.plugin.excludeNote(filePath);
      this.renderFileChips();
    });

    chip.addEventListener('click', () => void this.openNote(filePath));
  }

  private async openNote(filePath: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (!file || !('extension' in file)) return;
    await this.app.workspace.getLeaf(false).openFile(file as TFile);
  }

  private createNewConversation(): void {
    this.plugin.agent.cancel();
    this.plugin.agent.resetSession();
    this.messages = [];
    this.currentConversationId = null;
    this.plugin.settings.activeConversationId = null;
    void this.plugin.saveSettings();
    this.messagesEl?.empty();
    this.welcomeEl = this.messagesEl?.createDiv({ cls: 'oc-welcome' }) || null;
    this.renderWelcome();
    this.renderHistoryMenu();
  }

  private reopen(): void {
    const leaf = this.leaf;
    void leaf.setViewState({ type: VIEW_TYPE_OBSIGRAVITY, active: true });
  }

  private autoResizeInput(): void {
    if (!this.inputEl) return;
    this.inputEl.style.height = 'auto';
    this.inputEl.style.height = `${Math.min(this.inputEl.scrollHeight, 200)}px`;
  }

  private handleSlashKeydown(event: KeyboardEvent): boolean {
    if (!this.slashDropdownEl?.hasClass('visible')) return false;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.selectedSlashCommandIndex = Math.min(this.selectedSlashCommandIndex + 1, this.getFilteredSlashCommands().length - 1);
      this.renderSlashCommands();
      return true;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.selectedSlashCommandIndex = Math.max(this.selectedSlashCommandIndex - 1, 0);
      this.renderSlashCommands();
      return true;
    }

    if (event.key === 'Tab' || event.key === 'Enter') {
      const command = this.getFilteredSlashCommands()[this.selectedSlashCommandIndex];
      if (command) {
        event.preventDefault();
        this.insertSlashCommand(command.name);
        return true;
      }
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      this.hideSlashCommands();
      return true;
    }

    return false;
  }

  private getSlashQuery(): string | null {
    if (!this.inputEl) return null;
    const value = this.inputEl.value;
    const cursor = this.inputEl.selectionStart ?? value.length;
    const beforeCursor = value.slice(0, cursor);
    if (!beforeCursor.startsWith('/')) return null;
    if (beforeCursor.includes('\n')) return null;
    if (beforeCursor.includes(' ')) return null;
    return beforeCursor.toLowerCase();
  }

  private getFilteredSlashCommands(): typeof ANTIGRAVITY_SLASH_COMMANDS {
    const query = this.getSlashQuery();
    if (query === null) return [];
    return ANTIGRAVITY_SLASH_COMMANDS.filter((command) => command.name.startsWith(query));
  }

  private renderSlashCommands(): void {
    if (!this.slashDropdownEl) return;
    const commands = this.getFilteredSlashCommands();
    this.slashDropdownEl.empty();

    if (commands.length === 0) {
      this.hideSlashCommands();
      return;
    }

    this.selectedSlashCommandIndex = Math.min(this.selectedSlashCommandIndex, commands.length - 1);
    this.slashDropdownEl.addClass('visible');

    for (const [index, command] of commands.entries()) {
      const item = this.slashDropdownEl.createDiv({ cls: 'oc-slash-item' });
      if (index === this.selectedSlashCommandIndex) {
        item.addClass('selected');
        window.requestAnimationFrame(() => item.scrollIntoView({ block: 'nearest' }));
      }
      item.createSpan({ cls: 'oc-slash-name', text: command.name });
      item.createSpan({ cls: 'oc-slash-hint', text: command.hint });
      item.createDiv({ cls: 'oc-slash-desc', text: command.description });
      item.addEventListener('mousedown', (event) => {
        event.preventDefault();
        this.insertSlashCommand(command.name);
      });
    }
  }

  private insertSlashCommand(command: string): void {
    if (!this.inputEl) return;
    this.inputEl.value = `${command} `;
    this.inputEl.focus();
    this.inputEl.setSelectionRange(this.inputEl.value.length, this.inputEl.value.length);
    this.autoResizeInput();
    this.hideSlashCommands();
  }

  private hideSlashCommands(): void {
    this.slashDropdownEl?.removeClass('visible');
    this.selectedSlashCommandIndex = 0;
  }

  private async submit(): Promise<void> {
    if (!this.inputEl || this.isRunning) return;
    const prompt = this.inputEl.value.trim();
    if (!prompt) return;

    this.inputEl.value = '';
    this.autoResizeInput();
    this.isRunning = true;
    this.appendMessage({ role: 'user', content: prompt, timestamp: Date.now() });

    try {
      const context = await this.plugin.getActiveNoteContext();
      let assistantBuffer = '';
      const assistantEl = this.createMessageEl('assistant');
      const progressEl = this.createProgressTimeline(assistantEl);
      const progressListEl = progressEl.querySelector('.oc-progress-list') as HTMLElement;
      this.appendProgressStep(progressListEl, 'Antigravity process started');
      const contentEl = assistantEl.createDiv({ cls: 'oc-message-content' });

      for await (const event of this.plugin.agent.query({
        prompt,
        cwd: this.plugin.getVaultPath(),
        activeNotePath: context?.path,
        activeNoteContent: context?.content,
        selectedText: context?.selection,
        pinnedNotes: context?.pinnedNotes,
      })) {
        if (event.type === 'text') {
          assistantBuffer += event.content;
          progressEl.addClass('is-complete');
          this.appendProgressStep(progressListEl, 'Final response received');
          await this.renderMarkdown(assistantBuffer, contentEl);
        } else if (event.type === 'progress') {
          this.appendProgressStep(progressListEl, event.content);
        } else if (event.type === 'error') {
          progressEl.addClass('is-error');
          this.appendProgressStep(progressListEl, `Error: ${event.content}`);
          this.appendMessage({ role: 'error', content: event.content, timestamp: Date.now() });
        }
      }

      progressEl.addClass('is-complete');

      if (assistantBuffer.trim()) {
        this.messages.push({ role: 'assistant', content: assistantBuffer, timestamp: Date.now() });
        this.saveCurrentConversation();
        this.renderHistoryMenu();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      new Notice(message);
      this.appendMessage({ role: 'error', content: message, timestamp: Date.now() });
    } finally {
      this.isRunning = false;
    }
  }

  private appendMessage(message: ConversationMessage): void {
    this.messages.push(message);
    this.saveCurrentConversation();
    this.renderHistoryMenu();
    const el = this.createMessageEl(message.role);
    const content = el.createDiv({ cls: 'oc-message-content' });
    if (message.role === 'assistant') {
      void this.renderMarkdown(message.content, content);
    } else {
      content.setText(message.content);
    }
  }

  private restoreActiveConversation(): void {
    const active = this.plugin.settings.conversationHistory.find((session) => session.id === this.plugin.settings.activeConversationId);
    if (!active) {
      this.messages = [];
      this.currentConversationId = null;
      this.welcomeEl = this.messagesEl?.createDiv({ cls: 'oc-welcome' }) || null;
      this.renderWelcome();
      return;
    }

    this.currentConversationId = active.id;
    this.messages = [...active.messages];
    this.renderConversationMessages();
  }

  private renderConversationMessages(): void {
    if (!this.messagesEl) return;
    this.messagesEl.empty();
    if (this.messages.length === 0) {
      this.welcomeEl = this.messagesEl.createDiv({ cls: 'oc-welcome' });
      this.renderWelcome();
      return;
    }

    this.welcomeEl = null;
    for (const message of this.messages) {
      const el = this.createMessageEl(message.role);
      const content = el.createDiv({ cls: 'oc-message-content' });
      if (message.role === 'assistant') {
        void this.renderMarkdown(message.content, content);
      } else {
        content.setText(message.content);
      }
    }
  }

  private saveCurrentConversation(): void {
    if (this.messages.length === 0) return;
    const now = Date.now();
    if (!this.currentConversationId) {
      this.currentConversationId = `conv-${now}-${Math.random().toString(36).slice(2, 8)}`;
    }

    const existing = this.plugin.settings.conversationHistory.filter((session) => session.id !== this.currentConversationId);
    const createdAt = this.plugin.settings.conversationHistory.find((session) => session.id === this.currentConversationId)?.createdAt || now;
    const session: ConversationSession = {
      id: this.currentConversationId,
      title: this.buildConversationTitle(this.messages),
      createdAt,
      updatedAt: now,
      messages: [...this.messages],
    };

    this.plugin.settings.conversationHistory = [session, ...existing]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 30);
    this.plugin.settings.activeConversationId = session.id;
    void this.plugin.saveSettings();
  }

  private buildConversationTitle(messages: ConversationMessage[]): string {
    const firstUserMessage = messages.find((message) => message.role === 'user')?.content.trim();
    if (!firstUserMessage) return 'Untitled conversation';
    return firstUserMessage.replace(/\s+/g, ' ').slice(0, 72);
  }

  private toggleHistoryMenu(): void {
    if (!this.historyMenuEl) return;
    this.renderHistoryMenu();
    this.historyMenuEl.toggleClass('visible', !this.historyMenuEl.hasClass('visible'));
  }

  private hideHistoryMenu(): void {
    this.historyMenuEl?.removeClass('visible');
  }

  private renderHistoryMenu(): void {
    if (!this.historyMenuEl) return;
    this.historyMenuEl.empty();
    this.historyMenuEl.createDiv({ cls: 'oc-history-header', text: 'Conversation History' });
    const list = this.historyMenuEl.createDiv({ cls: 'oc-history-list' });

    if (this.plugin.settings.conversationHistory.length === 0) {
      list.createDiv({ cls: 'oc-history-empty', text: 'No conversations yet.' });
      return;
    }

    for (const session of this.plugin.settings.conversationHistory) {
      const item = list.createDiv({ cls: 'oc-history-item' });
      item.toggleClass('active', session.id === this.currentConversationId);
      const icon = item.createSpan({ cls: 'oc-history-item-icon' });
      setIcon(icon, 'message-square');

      const content = item.createDiv({ cls: 'oc-history-item-content' });
      content.setAttribute('role', 'button');
      content.setAttribute('tabindex', '0');
      content.createDiv({ cls: 'oc-history-item-title', text: session.title });
      content.createDiv({ cls: 'oc-history-item-date', text: this.formatHistoryDate(session.updatedAt) });
      content.addEventListener('click', () => this.restoreConversation(session.id));
      content.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          this.restoreConversation(session.id);
        }
      });

      const actions = item.createDiv({ cls: 'oc-history-item-actions' });
      const deleteBtn = actions.createEl('button', { cls: 'oc-action-btn oc-delete-btn', attr: { 'aria-label': 'Delete conversation' } });
      setIcon(deleteBtn, 'trash-2');
      deleteBtn.addEventListener('click', async (event) => {
        event.stopPropagation();
        await this.deleteConversation(session.id);
      });
    }
  }

  private restoreConversation(sessionId: string): void {
    const session = this.plugin.settings.conversationHistory.find((item) => item.id === sessionId);
    if (!session) return;
    this.currentConversationId = session.id;
    this.messages = [...session.messages];
    this.plugin.settings.activeConversationId = session.id;
    void this.plugin.saveSettings();
    this.renderConversationMessages();
    this.renderHistoryMenu();
    this.hideHistoryMenu();
  }

  private async deleteConversation(sessionId: string): Promise<void> {
    this.plugin.settings.conversationHistory = this.plugin.settings.conversationHistory.filter((session) => session.id !== sessionId);
    if (this.currentConversationId === sessionId) {
      this.currentConversationId = null;
      this.messages = [];
      this.plugin.settings.activeConversationId = null;
      this.messagesEl?.empty();
      this.welcomeEl = this.messagesEl?.createDiv({ cls: 'oc-welcome' }) || null;
      this.renderWelcome();
    }
    await this.plugin.saveSettings();
    this.renderHistoryMenu();
  }

  private formatHistoryDate(timestamp: number): string {
    return new Date(timestamp).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private createMessageEl(role: ConversationMessage['role']): HTMLElement {
    if (this.welcomeEl) {
      this.welcomeEl.remove();
      this.welcomeEl = null;
    }
    const className = role === 'user'
      ? 'oc-message oc-message-user'
      : role === 'error'
        ? 'oc-message oc-message-assistant oc-message-error'
        : 'oc-message oc-message-assistant';
    const el = this.messagesEl!.createDiv({ cls: className });
    this.messagesEl!.scrollTop = this.messagesEl!.scrollHeight;
    return el;
  }

  private createProgressTimeline(parent: HTMLElement): HTMLElement {
    const wrapper = parent.createDiv({ cls: 'oc-progress-timeline' });
    const header = wrapper.createDiv({ cls: 'oc-progress-header' });
    header.createSpan({ cls: 'oc-progress-dot' });
    header.createSpan({ cls: 'oc-progress-title', text: 'Antigravity working steps' });
    wrapper.createDiv({ cls: 'oc-progress-list' });
    return wrapper;
  }

  private appendProgressStep(listEl: HTMLElement, message: string): void {
    const previous = listEl.lastElementChild;
    if (previous?.textContent === message) return;
    const item = listEl.createDiv({ cls: 'oc-progress-step' });
    item.setText(message);
    const maxItems = 24;
    while (listEl.children.length > maxItems) {
      listEl.firstElementChild?.remove();
    }
    item.scrollIntoView({ block: 'nearest' });
    if (this.messagesEl) this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  private async renderMarkdown(markdown: string, el: HTMLElement): Promise<void> {
    el.empty();
    await MarkdownRenderer.renderMarkdown(markdown, el, '', this);
    if (this.messagesEl) this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }
}
