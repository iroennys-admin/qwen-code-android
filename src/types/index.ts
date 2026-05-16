export interface Provider {
  id: string;
  name: string;
  baseUrl: string;
  proxyBaseUrl: string;
  apiKey: string;
  models: ModelInfo[];
  enabled: boolean;
}

export interface ModelInfo {
  id: string;
  name: string;
  contextLength?: number;
  description?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: number;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  isStreaming?: boolean;
  model?: string;
  provider?: string;
}

export interface ToolCall {
  id: string;
  type: 'shell' | 'file_read' | 'file_write' | 'file_edit' | 'web_fetch' | 'glob' | 'grep';
  name: string;
  params: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'error' | 'waiting_approval';
  output?: string;
  requiresApproval: boolean;
}

export interface ToolResult {
  toolCallId: string;
  output: string;
  error?: string;
}

export interface Session {
  id: string;
  name: string;
  messages: ChatMessage[];
  provider: string;
  model: string;
  createdAt: number;
  updatedAt: number;
}

export interface AppConfig {
  providers: Provider[];
  activeProvider: string;
  activeModel: string;
  proxyEnabled: boolean;
  proxyBaseUrl: string;
  streaming: boolean;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  approvalMode: 'ask' | 'auto_edit' | 'yolo';
  lowRamMode: boolean;
  fontSize: number;
  theme: 'dark' | 'light';
}

export interface StreamChunk {
  type: 'content' | 'tool_call' | 'tool_result' | 'thinking' | 'error' | 'done';
  content?: string;
  toolCall?: ToolCall;
  toolResult?: ToolResult;
  thinking?: string;
  error?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface ShellResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export type ViewMode = 'chat' | 'terminal' | 'files' | 'settings';
