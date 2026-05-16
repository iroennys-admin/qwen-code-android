// Default configuration for the Qwen Code Android app
// Proxy base URL for Cuba connectivity (iql)
const CUBA_PROXY_BASE = 'https://iql.is';

import type { AppConfig, Provider, ModelInfo } from '../types';

const NVIDIAMODELS: ModelInfo[] = [
  { id: 'nvidia/llama-3.1-nemotron-70b-instruct', name: 'Nemotron 70B', contextLength: 131072 },
  { id: 'nvidia/llama-3.3-nemotron-super-49b-v1', name: 'Nemotron Super 49B', contextLength: 131072 },
  { id: 'nvidia/deepseek-llm-r1', name: 'DeepSeek R1', contextLength: 131072 },
  { id: 'nvidia/qwen2.5-72b-instruct', name: 'Qwen 2.5 72B', contextLength: 131072 },
  { id: 'nvidia/mistral-large-2411', name: 'Mistral Large', contextLength: 131072 },
  { id: 'nvidia/llama-3.1-405b-instruct', name: 'Llama 3.1 405B', contextLength: 131072 },
];

const OPENROUTER_MODELS: ModelInfo[] = [
  { id: 'qwen/qwen3-235b-a22b:free', name: 'Qwen3 235B (Free)', contextLength: 131072 },
  { id: 'qwen/qwen3-30b-a3b:free', name: 'Qwen3 30B (Free)', contextLength: 131072 },
  { id: 'deepseek/deepseek-r1:free', name: 'DeepSeek R1 (Free)', contextLength: 163840 },
  { id: 'deepseek/deepseek-r1-0528:free', name: 'DeepSeek R1 0528 (Free)', contextLength: 163840 },
  { id: 'google/gemini-2.5-pro-exp-03-25:free', name: 'Gemini 2.5 Pro (Free)', contextLength: 1048576 },
  { id: 'meta-llama/llama-4-maverick:free', name: 'Llama 4 Maverick (Free)', contextLength: 1048576 },
  { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4', contextLength: 200000 },
  { id: 'openai/gpt-4o', name: 'GPT-4o', contextLength: 128000 },
  { id: 'openai/o3', name: 'O3', contextLength: 200000 },
  { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro', contextLength: 1048576 },
];

const MISTRAL_MODELS: ModelInfo[] = [
  { id: 'mistral-large-latest', name: 'Mistral Large', contextLength: 131072 },
  { id: 'mistral-medium-latest', name: 'Mistral Medium', contextLength: 131072 },
  { id: 'codestral-latest', name: 'Codestral', contextLength: 256000 },
  { id: 'mistral-small-latest', name: 'Mistral Small', contextLength: 131072 },
  { id: 'open-mistral-nemo', name: 'Mistral Nemo', contextLength: 131072 },
  { id: 'open-codestral-mamba', name: 'Codestral Mamba', contextLength: 256000 },
];

const GROK_MODELS: ModelInfo[] = [
  { id: 'grok-3', name: 'Grok 3', contextLength: 131072 },
  { id: 'grok-3-mini', name: 'Grok 3 Mini', contextLength: 131072 },
  { id: 'grok-2', name: 'Grok 2', contextLength: 131072 },
];

export const DEFAULT_PROVIDERS: Provider[] = [
  {
    id: 'openrouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    proxyBaseUrl: `${CUBA_PROXY_BASE}/openrouter/api/v1`,
    apiKey: '',
    models: OPENROUTER_MODELS,
    enabled: true,
  },
  {
    id: 'nvidia',
    name: 'NVIDIA NIM',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    proxyBaseUrl: `${CUBA_PROXY_BASE}/nvidia/v1`,
    apiKey: '',
    models: NVIDIAMODELS,
    enabled: true,
  },
  {
    id: 'mistral',
    name: 'Mistral',
    baseUrl: 'https://api.mistral.ai/v1',
    proxyBaseUrl: `${CUBA_PROXY_BASE}/mistral/v1`,
    apiKey: '',
    models: MISTRAL_MODELS,
    enabled: true,
  },
  {
    id: 'grok',
    name: 'Grok (xAI)',
    baseUrl: 'https://api.x.ai/v1',
    proxyBaseUrl: `${CUBA_PROXY_BASE}/xai/v1`,
    apiKey: '',
    models: GROK_MODELS,
    enabled: true,
  },
];

export const DEFAULT_CONFIG: AppConfig = {
  providers: DEFAULT_PROVIDERS,
  activeProvider: 'openrouter',
  activeModel: 'qwen/qwen3-235b-a22b:free',
  proxyEnabled: true,
  proxyBaseUrl: CUBA_PROXY_BASE,
  streaming: true,
  temperature: 0.7,
  maxTokens: 8192,
  systemPrompt: `You are Qwen Code, an advanced AI coding assistant running on Android/Termux. You have access to tools that let you execute shell commands, read and write files, search the web, and more. When the user asks you to do something, use the appropriate tools to accomplish the task. Always explain what you're doing step by step.

Available tools:
- shell: Execute shell commands on the device
- file_read: Read file contents
- file_write: Write/create files
- file_edit: Edit files with find/replace
- web_fetch: Fetch web content
- glob: Find files by pattern
- grep: Search file contents

When you need to run a command, use the shell tool. When you need to read or modify files, use the file tools. Be helpful, precise, and thorough.`,
  approvalMode: 'ask',
  lowRamMode: false,
  fontSize: 14,
  theme: 'dark',
};

export const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'shell',
      description: 'Execute a shell command on the device. Returns stdout, stderr, and exit code.',
      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'The shell command to execute',
          },
          timeout: {
            type: 'number',
            description: 'Timeout in seconds (default: 30)',
          },
        },
        required: ['command'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'file_read',
      description: 'Read the contents of a file',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path to the file to read',
          },
          start_line: {
            type: 'number',
            description: 'Start line number (1-based)',
          },
          end_line: {
            type: 'number',
            description: 'End line number',
          },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'file_write',
      description: 'Write content to a file (creates or overwrites)',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path to the file to write',
          },
          content: {
            type: 'string',
            description: 'Content to write',
          },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'file_edit',
      description: 'Edit a file by replacing old_text with new_text',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path to the file to edit',
          },
          old_text: {
            type: 'string',
            description: 'Text to find and replace',
          },
          new_text: {
            type: 'string',
            description: 'Replacement text',
          },
        },
        required: ['path', 'old_text', 'new_text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'web_fetch',
      description: 'Fetch content from a URL',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'URL to fetch',
          },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'glob',
      description: 'Find files matching a pattern',
      parameters: {
        type: 'object',
        properties: {
          pattern: {
            type: 'string',
            description: 'Glob pattern (e.g., "**/*.py")',
          },
          path: {
            type: 'string',
            description: 'Base directory to search in',
          },
        },
        required: ['pattern'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'grep',
      description: 'Search for a pattern in files',
      parameters: {
        type: 'object',
        properties: {
          pattern: {
            type: 'string',
            description: 'Search pattern (regex)',
          },
          path: {
            type: 'string',
            description: 'Directory or file to search in',
          },
          include: {
            type: 'string',
            description: 'File pattern to include (e.g., "*.py")',
          },
        },
        required: ['pattern'],
      },
    },
  },
];
