export type PermissionMode = 'review' | 'auto' | 'yolo';
export type PreferredModel =
  | 'default'
  | 'gemini-3.1-pro-high'
  | 'gemini-3.1-pro-low'
  | 'gemini-3-flash'
  | 'claude-sonnet-4.6-thinking'
  | 'claude-opus-4.6-thinking'
  | 'gpt-oss-120b';
export type ImageMode =
  | 'infographic'
  | 'poster'
  | 'cartoon'
  | 'concept'
  | 'diagram'
  | 'thumbnail'
  | 'avatar'
  | 'product'
  | 'ecommerce'
  | 'ui';
export type VisualOutputType = 'png' | 'svg';

export interface ObsigravitySettings {
  antigravityCliPath: string;
  preferredModel: PreferredModel;
  permissionMode: PermissionMode;
  autoIncludeActiveNote: boolean;
  pinnedNotePaths: string[];
  excludedNotePaths: string[];
  environmentVariables: string;
  mediaFolder: string;
  omx: {
    enabled: boolean;
    lastDoctorStatus: 'unknown' | 'pass' | 'warn' | 'fail';
    lastCheckedAt: number | null;
  };
  blockedCommands: {
    unix: string[];
    windows: string[];
  };
  allowedExportPaths: string[];
  conversationHistory: ConversationSession[];
  activeConversationId: string | null;
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system' | 'error';
  content: string;
  timestamp: number;
}

export interface ConversationSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ConversationMessage[];
}

export interface AgentQuery {
  prompt: string;
  cwd: string;
  activeNotePath?: string;
  activeNoteContent?: string;
  selectedText?: string;
  pinnedNotes?: Array<{ path: string; content: string }>;
}

export type AgentEvent =
  | { type: 'text'; content: string }
  | { type: 'progress'; content: string }
  | { type: 'error'; content: string }
  | { type: 'done' };

export interface AgentProvider {
  query(input: AgentQuery): AsyncGenerator<AgentEvent>;
  cancel(): void;
  resetSession(): void;
  getSessionId(): string | null;
  setSessionId(id: string | null): void;
}

export const DEFAULT_SETTINGS: ObsigravitySettings = {
  antigravityCliPath: '',
  preferredModel: 'default',
  permissionMode: 'review',
  autoIncludeActiveNote: true,
  pinnedNotePaths: [],
  excludedNotePaths: [],
  environmentVariables: '',
  mediaFolder: 'attachments/obsigravity',
  omx: {
    enabled: false,
    lastDoctorStatus: 'unknown',
    lastCheckedAt: null,
  },
  blockedCommands: {
    unix: ['rm -rf', 'chmod 777', 'chmod -R 777'],
    windows: ['Remove-Item -Recurse -Force', 'rd /s /q', 'del /s /q', 'format', 'diskpart'],
  },
  allowedExportPaths: [],
  conversationHistory: [],
  activeConversationId: null,
};
