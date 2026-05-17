// ==========================================
// OpenCode Android - Configuration
// ==========================================

import type { AppConfig, Provider, ModelInfo } from '../types';

const CUBA_PROXY_BASE = 'https://opencode.aiql.com';

// ---- OpenCode Zen Free Models ----
const OPENCODE_FREE_MODELS: ModelInfo[] = [
  { id: 'deepseek-v4-flash-free', name: 'DeepSeek V4 Flash Free', contextLength: 131072, isFree: true, description: 'Razonamiento + tool calling, gratuito' },
  { id: 'big-pickle', name: 'Big Pickle', contextLength: 131072, isFree: true, description: 'Modelo personalizado de OpenCode, gratuito' },
  { id: 'minimax-m2.5-free', name: 'MiniMax M2.5 Free', contextLength: 131072, isFree: true, description: 'Modelo de razonamiento, gratuito' },
  { id: 'nemotron-3-super-free', name: 'Nemotron 3 Super Free', contextLength: 131072, isFree: true, description: 'NVIDIA razonamiento, gratuito' },
];

// ---- OpenCode Zen Paid Models ----
const OPENCODE_PAID_MODELS: ModelInfo[] = [
  { id: 'gpt-5.5', name: 'GPT 5.5', contextLength: 200000 },
  { id: 'gpt-5.5-pro', name: 'GPT 5.5 Pro', contextLength: 200000 },
  { id: 'gpt-5.4', name: 'GPT 5.4', contextLength: 128000 },
  { id: 'claude-opus-4-7', name: 'Claude Opus 4.7', contextLength: 200000 },
  { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', contextLength: 200000 },
  { id: 'gemini-3-1-pro', name: 'Gemini 3.1 Pro', contextLength: 2000000 },
  { id: 'qwen3.6-plus', name: 'Qwen 3.6 Plus', contextLength: 131072 },
  { id: 'glm-5.1', name: 'GLM 5.1', contextLength: 131072 },
];

// ---- Default Providers ----
export const DEFAULT_PROVIDERS: Provider[] = [
  {
    id: 'opencode',
    name: 'OpenCode Zen (FREE)',
    baseUrl: 'https://opencode.ai/zen/v1',
    proxyBaseUrl: `${CUBA_PROXY_BASE}/v1`,
    apiKey: 'public',
    enabled: true,
    isFree: true,
    models: [...OPENCODE_FREE_MODELS, ...OPENCODE_PAID_MODELS],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    proxyBaseUrl: `https://openrouter.aiql.com/v1`,
    apiKey: '',
    enabled: true,
    models: [
      { id: 'qwen/qwen3-235b-a22b:free', name: 'Qwen3 235B (Free)', isFree: true },
      { id: 'deepseek/deepseek-r1:free', name: 'DeepSeek R1 (Free)', isFree: true },
      { id: 'google/gemini-2.5-flash-preview:free', name: 'Gemini 2.5 Flash (Free)', isFree: true },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    proxyBaseUrl: `https://openai.aiql.com/v1`,
    apiKey: '',
    enabled: true,
    models: [
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    proxyBaseUrl: `https://anthropic.aiql.com/v1`,
    apiKey: '',
    enabled: true,
    models: [
      { id: 'claude-sonnet-4-5-20250514', name: 'Claude Sonnet 4.5' },
      { id: 'claude-haiku-4-5-20250514', name: 'Claude Haiku 4.5' },
    ],
  },
];

// ---- System Prompt (OpenCode-style) ----
export const SYSTEM_PROMPT = `You are OpenCode, an expert AI coding assistant running on Android. You help users write, debug, refactor, and understand code.

You have access to tools that let you execute shell commands, read and write files, search code, and fetch web content. Use these tools proactively to help the user.

Guidelines:
- Execute shell commands when asked to run, test, or debug code
- Read files before editing them to understand context
- Use glob/grep to search for files and patterns
- Write complete, working code — no placeholders or TODOs
- Explain what you're doing and why
- For multi-step tasks, break them down and execute step by step
- When editing files, use file_edit for precise changes and file_write for new files

Current directory: /sdcard
Device: Android (ARM)`;

// ---- Tool Definitions (OpenAI function calling format) ----
export const TOOL_DEFINITIONS = [
  {
    type: 'function' as const,
    function: {
      name: 'shell',
      description: 'Execute a shell command on the device. Returns stdout, stderr, and exit code.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'The shell command to execute' },
          timeout: { type: 'number', description: 'Timeout in seconds (default 30)' },
        },
        required: ['command'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'file_read',
      description: 'Read the contents of a file. Returns the file content as text.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Absolute path to the file' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'file_write',
      description: 'Write content to a file. Creates the file and parent directories if they do not exist.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Absolute path to the file' },
          content: { type: 'string', description: 'Content to write' },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'file_edit',
      description: 'Edit a file by replacing old text with new text. Use for precise edits.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Absolute path to the file' },
          old_text: { type: 'string', description: 'Text to find and replace' },
          new_text: { type: 'string', description: 'Replacement text' },
        },
        required: ['path', 'old_text', 'new_text'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'list_dir',
      description: 'List contents of a directory. Returns names, types, and sizes.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Absolute path to directory' },
          show_hidden: { type: 'boolean', description: 'Show hidden files (default false)' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'glob',
      description: 'Find files matching a glob pattern in a directory.',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Glob pattern (e.g. **/*.py)' },
          path: { type: 'string', description: 'Directory to search in (default /sdcard)' },
        },
        required: ['pattern'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'grep',
      description: 'Search for a regex pattern in files within a directory.',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Regex pattern to search for' },
          path: { type: 'string', description: 'Directory to search in' },
          file_pattern: { type: 'string', description: 'File glob pattern (e.g. *.py)' },
        },
        required: ['pattern'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'web_fetch',
      description: 'Fetch the content of a URL. Returns the page text.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL to fetch' },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'mkdir',
      description: 'Create a directory and all parent directories.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Absolute path to create' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'rm',
      description: 'Delete a file or directory.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Absolute path to delete' },
          recursive: { type: 'boolean', description: 'Delete directory recursively (default false)' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'mv',
      description: 'Move or rename a file or directory.',
      parameters: {
        type: 'object',
        properties: {
          source: { type: 'string', description: 'Source path' },
          destination: { type: 'string', description: 'Destination path' },
        },
        required: ['source', 'destination'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'cp',
      description: 'Copy a file or directory.',
      parameters: {
        type: 'object',
        properties: {
          source: { type: 'string', description: 'Source path' },
          destination: { type: 'string', description: 'Destination path' },
        },
        required: ['source', 'destination'],
      },
    },
  },
];

// ---- Default Config ----
export const DEFAULT_CONFIG: AppConfig = {
  providers: DEFAULT_PROVIDERS,
  activeProvider: 'opencode',
  activeModel: 'deepseek-v4-flash-free',
  proxyEnabled: false,
  proxyBaseUrl: CUBA_PROXY_BASE,
  streaming: true,
  temperature: 0.7,
  maxTokens: 16384,
  systemPrompt: SYSTEM_PROMPT,
  approvalMode: 'auto_edit',
  fontSize: 14,
  maxAgentSteps: 30,
  workingDir: '/sdcard',
};
