// ==========================================
// OpenCode Android v2 - Type Definitions
// ==========================================

export interface Provider {
  id: string;
  name: string;
  emoji?: string;
  baseUrl: string;
  proxyBaseUrl: string;
  apiKey: string;
  models: ModelInfo[];
  enabled: boolean;
  isFree?: boolean;
  signupUrl?: string;
  notes?: string;
  /** Extra body fields to include on every request (e.g. {thinking:{type:'enabled'}}) */
  extraBody?: Record<string, unknown>;
  /** Extra HTTP headers (e.g. for OpenRouter ranking) */
  extraHeaders?: Record<string, string>;
  /** API style: 'openai' (default) | 'anthropic' (messages API) */
  style?: 'openai' | 'anthropic';
}

export interface ModelInfo {
  id: string;
  name: string;
  contextLength?: number;
  description?: string;
  isFree?: boolean;
  supportsVision?: boolean;
  supportsTools?: boolean;
  supportsThinking?: boolean;
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
  attachments?: Attachment[];
  usage?: TokenUsage;
  error?: string;
}

export interface Attachment {
  type: 'image' | 'file';
  name: string;
  dataUrl?: string;
  path?: string;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface OpenCodeToolCall {
  id: string;
  type: ToolType;
  name: string;
  params: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'error' | 'waiting_approval' | 'denied';
  output?: string;
  requiresApproval: boolean;
  duration?: number;
  startedAt?: number;
}

export type ToolType = string;

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
  theme: 'dark' | 'midnight' | 'aurora' | 'cyber';
  showThinking: boolean;
  enableThinkingMode: boolean;
  enableMemory: boolean;
  enableTodos: boolean;
  hapticFeedback: boolean;
  webSearchProvider: 'duckduckgo' | 'searxng' | 'tavily';
  searxngUrl?: string;
}

export interface StreamChunk {
  type: 'content' | 'tool_call' | 'tool_result' | 'thinking' | 'error' | 'done' | 'agent_step' | 'usage';
  content?: string;
  toolCall?: OpenCodeToolCall;
  toolResult?: ToolResult;
  thinking?: string;
  error?: string;
  step?: number;
  usage?: TokenUsage;
}

export interface ShellResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface ApiMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | null | Array<{ type: string; text?: string; image_url?: { url: string } }>;
  tool_calls?: ApiToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface ApiToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export type ViewMode = 'chat' | 'zai' | 'terminal' | 'files' | 'settings' | 'about';

export interface AgentState {
  status: 'idle' | 'thinking' | 'calling_tool' | 'executing' | 'waiting_approval' | 'done' | 'error';
  currentStep: number;
  totalSteps: number;
  thinkingText?: string;
  currentTool?: string;
}

export interface TodoItem {
  id: string;
  text: string;
  done: boolean;
  createdAt: number;
}

export interface MemoryEntry {
  key: string;
  value: string;
  updatedAt: number;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: OpenCodeMessage[];
  createdAt: number;
  updatedAt: number;
  provider: string;
  model: string;
}
