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
  thinking?: string;
  model?: string;
  provider?: string;
  /** Agent step number for multi-step tool use */
  step?: number;
}

export interface ToolCall {
  id: string;
  type: ToolType;
  name: string;
  params: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'error' | 'waiting_approval';
  output?: string;
  requiresApproval: boolean;
  /** Duration in ms */
  duration?: number;
}

export type ToolType = 'shell' | 'file_read' | 'file_write' | 'file_edit' | 'web_fetch' | 'web_search' | 'web_scrape' | 'glob' | 'grep' | 'code_execute' | 'mkdir' | 'rm' | 'mv' | 'cp' | 'list_dir' | 'npx_install';

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
  /** Max agent loop iterations to prevent infinite loops */
  maxAgentSteps: number;
  /** Working directory for shell commands */
  workingDir: string;
}

export interface StreamChunk {
  type: 'content' | 'tool_call' | 'tool_result' | 'thinking' | 'error' | 'done' | 'agent_step';
  content?: string;
  toolCall?: ToolCall;
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

/** API message format - matches OpenAI chat completion API */
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

export type ViewMode = 'chat' | 'terminal' | 'files' | 'settings';

/** Agent run state for UI feedback */
export interface AgentState {
  status: 'idle' | 'thinking' | 'calling_tool' | 'executing' | 'waiting_approval' | 'done' | 'error';
  currentStep: number;
  totalSteps: number;
  thinkingText?: string;
  currentTool?: string;
}
