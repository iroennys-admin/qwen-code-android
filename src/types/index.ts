// ==========================================
// OpenCode Android - Type Definitions
// ==========================================

export interface Provider {
  id: string;
  name: string;
  baseUrl: string;
  proxyBaseUrl: string;
  apiKey: string;
  models: ModelInfo[];
  enabled: boolean;
  isFree?: boolean;
}

export interface ModelInfo {
  id: string;
  name: string;
  contextLength?: number;
  description?: string;
  isFree?: boolean;
}

export interface OpenCodeMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: number;
  toolCalls?: OpenCodeToolCall[];
  toolResults?: ToolResult[];
  isStreaming?: boolean;
  thinking?: string;
  model?: string;
  provider?: string;
  step?: number;
}

export interface OpenCodeToolCall {
  id: string;
  type: ToolType;
  name: string;
  params: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'error' | 'waiting_approval';
  output?: string;
  requiresApproval: boolean;
  duration?: number;
}

export type ToolType =
  | 'shell' | 'file_read' | 'file_write' | 'file_edit'
  | 'web_fetch' | 'web_search'
  | 'glob' | 'grep' | 'code_execute'
  | 'mkdir' | 'rm' | 'mv' | 'cp' | 'list_dir';

export interface ToolResult {
  toolCallId: string;
  output: string;
  error?: string;
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
  fontSize: number;
  maxAgentSteps: number;
  workingDir: string;
}

export interface StreamChunk {
  type: 'content' | 'tool_call' | 'tool_result' | 'thinking' | 'error' | 'done' | 'agent_step';
  content?: string;
  toolCall?: OpenCodeToolCall;
  toolResult?: ToolResult;
  thinking?: string;
  error?: string;
  step?: number;
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

export interface ApiMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | null;
  tool_calls?: ApiToolCall[];
  tool_call_id?: string;
}

export interface ApiToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export type ViewMode = 'chat' | 'terminal' | 'files' | 'settings' | 'opencode-setup';

export interface AgentState {
  status: 'idle' | 'thinking' | 'calling_tool' | 'executing' | 'waiting_approval' | 'done' | 'error';
  currentStep: number;
  totalSteps: number;
  thinkingText?: string;
  currentTool?: string;
}
