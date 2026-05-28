// ==========================================
// OpenCode Android v2 - Configuration
// ==========================================

import type { AppConfig, Provider } from '../types';

// Cuba-friendly reverse proxy base. Each provider has its own subdomain.
// Falls back to direct if proxy is disabled.
const PROXY_BASE = 'https://opencode.aiql.com';

// ---- Default Providers (all FREE tiers + popular paid options) ----
export const DEFAULT_PROVIDERS: Provider[] = [
  // ============ Z.AI (GLM) - China's strongest free coding model ============
  {
    id: 'zai',
    name: 'Z.AI (GLM)',
    emoji: '🇨🇳',
    baseUrl: 'https://api.z.ai/api/paas/v4',
    proxyBaseUrl: `${PROXY_BASE}/zai/v4`,
    apiKey: '',
    enabled: true,
    isFree: true,
    signupUrl: 'https://z.ai/manage-apikey/apikey-list',
    notes: 'Modelos GLM gratis (flash) y de pago. OpenAI-compatible. Excelente para código.',
    models: [
      { id: 'glm-4.6', name: 'GLM-4.6', contextLength: 200000, description: 'Modelo flagship Z.AI, excelente para código', supportsTools: true, supportsThinking: true },
      { id: 'glm-4.5', name: 'GLM-4.5', contextLength: 128000, supportsTools: true, supportsThinking: true },
      { id: 'glm-4.5-air', name: 'GLM-4.5 Air', contextLength: 128000, supportsTools: true, description: 'Más rápido y barato' },
      { id: 'glm-4.5-flash', name: 'GLM-4.5 Flash ⚡', contextLength: 128000, isFree: true, description: 'GRATIS - Rápido', supportsTools: true },
      { id: 'glm-4-flash', name: 'GLM-4 Flash ⚡', contextLength: 128000, isFree: true, description: 'GRATIS', supportsTools: true },
      { id: 'glm-4v-flash', name: 'GLM-4V Flash 👁️', contextLength: 128000, isFree: true, description: 'GRATIS con visión', supportsVision: true },
    ],
  },

  // ============ Groq - Fastest inference, large free tier ============
  {
    id: 'groq',
    name: 'Groq',
    emoji: '⚡',
    baseUrl: 'https://api.groq.com/openai/v1',
    proxyBaseUrl: `${PROXY_BASE}/groq/v1`,
    apiKey: '',
    enabled: true,
    isFree: true,
    signupUrl: 'https://console.groq.com/keys',
    notes: 'Inferencia ultra rápida (LPU). Generoso tier gratis sin tarjeta.',
    models: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', contextLength: 131072, isFree: true, supportsTools: true },
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B ⚡', contextLength: 131072, isFree: true, supportsTools: true },
      { id: 'qwen/qwen3-32b', name: 'Qwen 3 32B', contextLength: 131072, isFree: true, supportsTools: true },
      { id: 'openai/gpt-oss-120b', name: 'GPT-OSS 120B', contextLength: 131072, isFree: true, supportsTools: true },
      { id: 'openai/gpt-oss-20b', name: 'GPT-OSS 20B', contextLength: 131072, isFree: true, supportsTools: true },
      { id: 'moonshotai/kimi-k2-instruct', name: 'Kimi K2', contextLength: 131072, isFree: true, supportsTools: true },
      { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 Distill 70B', contextLength: 131072, isFree: true, supportsTools: true, supportsThinking: true },
    ],
  },

  // ============ Cerebras - Fastest reasoning ============
  {
    id: 'cerebras',
    name: 'Cerebras',
    emoji: '🧠',
    baseUrl: 'https://api.cerebras.ai/v1',
    proxyBaseUrl: `${PROXY_BASE}/cerebras/v1`,
    apiKey: '',
    enabled: true,
    isFree: true,
    signupUrl: 'https://cloud.cerebras.ai/platform/',
    notes: 'Wafer-scale chips, +2000 tok/s. Free tier 1M tokens/día.',
    models: [
      { id: 'llama-3.3-70b', name: 'Llama 3.3 70B', contextLength: 8192, isFree: true, supportsTools: true },
      { id: 'llama3.1-8b', name: 'Llama 3.1 8B', contextLength: 8192, isFree: true, supportsTools: true },
      { id: 'qwen-3-32b', name: 'Qwen 3 32B', contextLength: 16384, isFree: true, supportsTools: true },
      { id: 'qwen-3-235b-a22b-instruct-2507', name: 'Qwen 3 235B', contextLength: 131072, isFree: true, supportsTools: true },
      { id: 'gpt-oss-120b', name: 'GPT-OSS 120B', contextLength: 8192, isFree: true, supportsTools: true },
    ],
  },

  // ============ Google AI Studio (Gemini) ============
  {
    id: 'gemini',
    name: 'Google Gemini',
    emoji: '✨',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    proxyBaseUrl: `${PROXY_BASE}/gemini/v1beta/openai`,
    apiKey: '',
    enabled: true,
    isFree: true,
    signupUrl: 'https://aistudio.google.com/apikey',
    notes: 'OpenAI-compatible. Gemini Flash gratis con visión y 1M de contexto.',
    models: [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', contextLength: 1048576, isFree: true, supportsVision: true, supportsTools: true },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', contextLength: 1048576, isFree: true, supportsVision: true, supportsTools: true, supportsThinking: true },
      { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', contextLength: 1048576, isFree: true, supportsVision: true, supportsTools: true },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', contextLength: 1048576, isFree: true, supportsVision: true, supportsTools: true },
    ],
  },

  // ============ OpenRouter - Hub multimodelo ============
  {
    id: 'openrouter',
    name: 'OpenRouter',
    emoji: '🔀',
    baseUrl: 'https://openrouter.ai/api/v1',
    proxyBaseUrl: `${PROXY_BASE}/openrouter/v1`,
    apiKey: '',
    enabled: true,
    isFree: true,
    signupUrl: 'https://openrouter.ai/keys',
    notes: '+300 modelos vía un solo API key. Incluye decenas de modelos gratis.',
    extraHeaders: {
      'HTTP-Referer': 'https://github.com/iroennys-admin/qwen-code-android',
      'X-Title': 'OpenCode Android',
    },
    models: [
      { id: 'z-ai/glm-4.6', name: 'GLM-4.6 (via OR)', contextLength: 200000, supportsTools: true },
      { id: 'deepseek/deepseek-chat-v3.1:free', name: 'DeepSeek V3.1 (Free)', contextLength: 163840, isFree: true, supportsTools: true },
      { id: 'deepseek/deepseek-r1:free', name: 'DeepSeek R1 (Free)', contextLength: 163840, isFree: true, supportsThinking: true },
      { id: 'qwen/qwen3-coder:free', name: 'Qwen3 Coder (Free)', contextLength: 262144, isFree: true, supportsTools: true },
      { id: 'qwen/qwen3-235b-a22b:free', name: 'Qwen3 235B (Free)', contextLength: 131072, isFree: true, supportsTools: true },
      { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B (Free)', contextLength: 131072, isFree: true, supportsTools: true },
      { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash (Free)', contextLength: 1048576, isFree: true, supportsVision: true, supportsTools: true },
      { id: 'moonshotai/kimi-k2:free', name: 'Kimi K2 (Free)', contextLength: 131072, isFree: true, supportsTools: true },
      { id: 'mistralai/mistral-small-3.2-24b-instruct:free', name: 'Mistral Small 3.2 (Free)', contextLength: 96000, isFree: true, supportsTools: true },
      { id: 'nvidia/llama-3.1-nemotron-70b-instruct:free', name: 'Nemotron 70B (Free)', contextLength: 131072, isFree: true },
    ],
  },

  // ============ NVIDIA NIM ============
  {
    id: 'nvidia',
    name: 'NVIDIA NIM',
    emoji: '💚',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    proxyBaseUrl: `${PROXY_BASE}/nvidia/v1`,
    apiKey: '',
    enabled: true,
    isFree: true,
    signupUrl: 'https://build.nvidia.com/',
    notes: '100+ modelos open-source gratis con créditos generosos.',
    models: [
      { id: 'deepseek-ai/deepseek-r1', name: 'DeepSeek R1', contextLength: 128000, isFree: true, supportsThinking: true },
      { id: 'deepseek-ai/deepseek-v3.1', name: 'DeepSeek V3.1', contextLength: 128000, isFree: true, supportsTools: true },
      { id: 'meta/llama-3.3-70b-instruct', name: 'Llama 3.3 70B', contextLength: 128000, isFree: true, supportsTools: true },
      { id: 'qwen/qwen3-coder-480b-a35b-instruct', name: 'Qwen3 Coder 480B', contextLength: 262144, isFree: true, supportsTools: true },
      { id: 'nvidia/llama-3.3-nemotron-super-49b-v1', name: 'Nemotron Super 49B', contextLength: 128000, isFree: true },
      { id: 'mistralai/mistral-large-2-instruct', name: 'Mistral Large 2', contextLength: 128000, isFree: true, supportsTools: true },
    ],
  },

  // ============ Mistral AI ============
  {
    id: 'mistral',
    name: 'Mistral AI',
    emoji: '🌪️',
    baseUrl: 'https://api.mistral.ai/v1',
    proxyBaseUrl: `${PROXY_BASE}/mistral/v1`,
    apiKey: '',
    enabled: true,
    isFree: true,
    signupUrl: 'https://console.mistral.ai/api-keys',
    notes: 'Tier gratis "La Plateforme" con 1B tokens/mes.',
    models: [
      { id: 'mistral-large-latest', name: 'Mistral Large', contextLength: 128000, isFree: true, supportsTools: true },
      { id: 'mistral-small-latest', name: 'Mistral Small', contextLength: 128000, isFree: true, supportsTools: true },
      { id: 'codestral-latest', name: 'Codestral', contextLength: 256000, isFree: true, supportsTools: true, description: 'Especialista en código' },
      { id: 'open-mistral-nemo', name: 'Mistral Nemo', contextLength: 128000, isFree: true, supportsTools: true },
      { id: 'pixtral-large-latest', name: 'Pixtral Large 👁️', contextLength: 128000, isFree: true, supportsVision: true },
    ],
  },

  // ============ DeepSeek (cheap, almost free) ============
  {
    id: 'deepseek',
    name: 'DeepSeek',
    emoji: '🐳',
    baseUrl: 'https://api.deepseek.com/v1',
    proxyBaseUrl: `${PROXY_BASE}/deepseek/v1`,
    apiKey: '',
    enabled: true,
    signupUrl: 'https://platform.deepseek.com/api_keys',
    notes: 'Súper barato. Modelos R1 (razonamiento) y V3 (chat/código).',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek V3', contextLength: 64000, supportsTools: true },
      { id: 'deepseek-reasoner', name: 'DeepSeek R1', contextLength: 64000, supportsThinking: true },
    ],
  },

  // ============ GitHub Models ============
  {
    id: 'github',
    name: 'GitHub Models',
    emoji: '🐙',
    baseUrl: 'https://models.inference.ai.azure.com',
    proxyBaseUrl: `${PROXY_BASE}/github/v1`,
    apiKey: '',
    enabled: true,
    isFree: true,
    signupUrl: 'https://github.com/settings/personal-access-tokens/new',
    notes: 'Free con PAT de GitHub. GPT-4o, o4-mini, Llama, Phi-4, etc.',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', contextLength: 128000, isFree: true, supportsTools: true, supportsVision: true },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', contextLength: 128000, isFree: true, supportsTools: true },
      { id: 'o4-mini', name: 'o4 Mini', contextLength: 200000, isFree: true, supportsThinking: true },
      { id: 'Phi-4', name: 'Phi-4', contextLength: 16384, isFree: true },
      { id: 'Meta-Llama-3.1-405B-Instruct', name: 'Llama 3.1 405B', contextLength: 128000, isFree: true, supportsTools: true },
    ],
  },

  // ============ Cohere ============
  {
    id: 'cohere',
    name: 'Cohere',
    emoji: '🟣',
    baseUrl: 'https://api.cohere.ai/compatibility/v1',
    proxyBaseUrl: `${PROXY_BASE}/cohere/v1`,
    apiKey: '',
    enabled: true,
    isFree: true,
    signupUrl: 'https://dashboard.cohere.com/api-keys',
    notes: 'Command R/R+ con tier de prueba gratuito.',
    models: [
      { id: 'command-r-plus', name: 'Command R+', contextLength: 128000, isFree: true, supportsTools: true },
      { id: 'command-r', name: 'Command R', contextLength: 128000, isFree: true, supportsTools: true },
      { id: 'command-r7b', name: 'Command R7B', contextLength: 128000, isFree: true, supportsTools: true },
    ],
  },

  // ============ SambaNova ============
  {
    id: 'sambanova',
    name: 'SambaNova',
    emoji: '🦛',
    baseUrl: 'https://api.sambanova.ai/v1',
    proxyBaseUrl: `${PROXY_BASE}/sambanova/v1`,
    apiKey: '',
    enabled: true,
    isFree: true,
    signupUrl: 'https://cloud.sambanova.ai/apis',
    notes: 'Inferencia rápida. Free con DeepSeek V3.1, Llama 4.',
    models: [
      { id: 'DeepSeek-V3.1', name: 'DeepSeek V3.1', contextLength: 128000, isFree: true, supportsTools: true },
      { id: 'Meta-Llama-3.3-70B-Instruct', name: 'Llama 3.3 70B', contextLength: 131072, isFree: true, supportsTools: true },
      { id: 'Qwen2.5-72B-Instruct', name: 'Qwen 2.5 72B', contextLength: 131072, isFree: true, supportsTools: true },
      { id: 'Llama-4-Maverick-17B-128E-Instruct', name: 'Llama 4 Maverick', contextLength: 131072, isFree: true, supportsTools: true },
    ],
  },

  // ============ xAI Grok ============
  {
    id: 'xai',
    name: 'xAI Grok',
    emoji: '🤖',
    baseUrl: 'https://api.x.ai/v1',
    proxyBaseUrl: `${PROXY_BASE}/xai/v1`,
    apiKey: '',
    enabled: true,
    signupUrl: 'https://console.x.ai/',
    notes: '$25 USD de créditos gratis al registrarse.',
    models: [
      { id: 'grok-4', name: 'Grok 4', contextLength: 256000, supportsTools: true, supportsVision: true },
      { id: 'grok-3', name: 'Grok 3', contextLength: 131072, supportsTools: true },
      { id: 'grok-3-mini', name: 'Grok 3 Mini', contextLength: 131072, supportsTools: true },
      { id: 'grok-code-fast-1', name: 'Grok Code Fast', contextLength: 131072, supportsTools: true },
    ],
  },

  // ============ OpenAI ============
  {
    id: 'openai',
    name: 'OpenAI',
    emoji: '🟢',
    baseUrl: 'https://api.openai.com/v1',
    proxyBaseUrl: `${PROXY_BASE}/openai/v1`,
    apiKey: '',
    enabled: true,
    signupUrl: 'https://platform.openai.com/api-keys',
    notes: 'API oficial OpenAI (pago).',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', contextLength: 128000, supportsTools: true, supportsVision: true },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', contextLength: 128000, supportsTools: true },
      { id: 'o3-mini', name: 'o3 Mini', contextLength: 200000, supportsThinking: true },
    ],
  },

  // ============ Anthropic ============
  {
    id: 'anthropic',
    name: 'Anthropic',
    emoji: '🅰️',
    baseUrl: 'https://api.anthropic.com/v1',
    proxyBaseUrl: `${PROXY_BASE}/anthropic/v1`,
    apiKey: '',
    enabled: true,
    style: 'anthropic',
    signupUrl: 'https://console.anthropic.com/settings/keys',
    notes: 'Claude (pago). Usa API Messages.',
    models: [
      { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5', contextLength: 200000, supportsTools: true, supportsVision: true, supportsThinking: true },
      { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', contextLength: 200000, supportsTools: true, supportsVision: true },
      { id: 'claude-haiku-4-5-20250514', name: 'Claude Haiku 4.5', contextLength: 200000, supportsTools: true },
    ],
  },

  // ============ Custom (user-defined) ============
  {
    id: 'custom',
    name: 'Custom (OpenAI-compatible)',
    emoji: '⚙️',
    baseUrl: 'https://api.example.com/v1',
    proxyBaseUrl: '',
    apiKey: '',
    enabled: true,
    notes: 'Endpoint personalizado OpenAI-compatible (Ollama, LocalAI, LMStudio).',
    models: [
      { id: 'custom-model', name: 'Custom Model' },
    ],
  },
];

// ---- System Prompt ----
export const SYSTEM_PROMPT = `You are OpenCode, an expert AI coding agent running on Android. You help users write, debug, refactor, search, and understand code directly on their phone.

You have access to powerful tools: execute shell commands, read/write/edit files, search code, fetch web pages, perform web searches, manage TODOs, and remember things across sessions. Use these tools proactively.

GUIDELINES:
- Think step by step. For non-trivial tasks, break them down.
- Read files BEFORE editing them to understand context.
- Use glob/grep to discover files and patterns.
- Use file_edit for precise changes, file_write for new files.
- Execute shell commands when you need to run, test, or inspect things.
- When asked a factual question that depends on current info, use web_search.
- When the user wants to track tasks, use todo_add / todo_update.
- Use memory_save for information the user wants you to remember long term.
- Write complete, working code — no placeholders or "TODO" comments unless explicitly asked.
- Be concise in chat; verbose in code.
- Format code with proper markdown fences (\`\`\`lang ... \`\`\`).
- If you need to install something, suggest packages available via pkg/apt/pip.

ENVIRONMENT:
- Platform: Android (ARM64/ARMv7)
- Working directory: /sdcard (user's storage)
- Shell: sh (BusyBox/Toybox). Use POSIX-compatible commands.
- You can install packages if Termux/proot is available.

Be helpful, accurate, and proactive.`;

// ---- Tool Definitions (OpenAI function calling format) ----
export const TOOL_DEFINITIONS = [
  {
    type: 'function' as const,
    function: {
      name: 'shell',
      description: 'Execute a shell command on the Android device. Returns stdout, stderr and exit code. Use for running scripts, inspecting the system, installing packages, running tests, git operations, etc.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'The shell command to execute' },
          timeout: { type: 'number', description: 'Timeout in seconds (default 60)' },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
        required: ['command'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'file_read',
      description: 'Read a file. Returns its full text content. Supports an optional line range.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Absolute or relative path' },
          start_line: { type: 'number', description: 'Optional 1-based start line' },
          end_line: { type: 'number', description: 'Optional 1-based end line' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'file_write',
      description: 'Write content to a file (creates or overwrites). Creates parent directories as needed.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          content: { type: 'string' },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'file_edit',
      description: 'Find-and-replace exact text in a file. The old_text must appear exactly once.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          old_text: { type: 'string', description: 'Exact substring to replace' },
          new_text: { type: 'string', description: 'Replacement text' },
        },
        required: ['path', 'old_text', 'new_text'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'file_append',
      description: 'Append content to the end of a file (creating it if needed).',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          content: { type: 'string' },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'list_dir',
      description: 'List the contents of a directory. Returns names, types and sizes.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          show_hidden: { type: 'boolean' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'glob',
      description: 'Find files matching a shell glob pattern (e.g. **/*.py).',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string' },
          path: { type: 'string' },
        },
        required: ['pattern'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'grep',
      description: 'Search a regex pattern recursively in files. Returns filename:line:match lines.',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string' },
          path: { type: 'string' },
          file_pattern: { type: 'string', description: 'File glob e.g. *.py' },
        },
        required: ['pattern'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'web_fetch',
      description: 'Fetch a URL and return its text content (HTML is converted to readable text).',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string' },
          max_chars: { type: 'number', description: 'Truncate output (default 20000)' },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'web_search',
      description: 'Search the web. Returns top results with title, URL and snippet.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          num_results: { type: 'number', description: 'Max results (default 5)' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'mkdir',
      description: 'Create a directory (and parents).',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string' } },
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
          path: { type: 'string' },
          recursive: { type: 'boolean' },
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
          source: { type: 'string' },
          destination: { type: 'string' },
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
          source: { type: 'string' },
          destination: { type: 'string' },
        },
        required: ['source', 'destination'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'todo_add',
      description: 'Add a TODO item to the user task list.',
      parameters: {
        type: 'object',
        properties: { text: { type: 'string' } },
        required: ['text'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'todo_list',
      description: 'List current TODO items.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'todo_complete',
      description: 'Mark a TODO as done by its id.',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'memory_save',
      description: 'Persist a key/value fact that the agent should remember in future conversations.',
      parameters: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          value: { type: 'string' },
        },
        required: ['key', 'value'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'memory_get',
      description: 'Retrieve all remembered facts.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'clipboard_copy',
      description: 'Copy text to the device clipboard.',
      parameters: {
        type: 'object',
        properties: { text: { type: 'string' } },
        required: ['text'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'clipboard_read',
      description: 'Read text from the device clipboard.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'notify',
      description: 'Show a toast/notification on the device.',
      parameters: {
        type: 'object',
        properties: {
          message: { type: 'string' },
        },
        required: ['message'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'device_info',
      description: 'Get information about the Android device (model, OS, storage, etc.).',
      parameters: { type: 'object', properties: {} },
    },
  },
];

// Tools that should always require user approval before execution.
export const APPROVAL_REQUIRED_TOOLS = new Set([
  'shell', 'rm', 'file_write', 'file_edit', 'file_append', 'mv',
]);

// ---- Default Config ----
export const DEFAULT_CONFIG: AppConfig = {
  providers: DEFAULT_PROVIDERS,
  activeProvider: 'zai',
  activeModel: 'glm-4.5-flash',
  proxyEnabled: false,
  proxyBaseUrl: PROXY_BASE,
  streaming: true,
  temperature: 0.7,
  maxTokens: 8192,
  systemPrompt: SYSTEM_PROMPT,
  approvalMode: 'auto_edit',
  fontSize: 14,
  maxAgentSteps: 25,
  workingDir: '/sdcard',
  theme: 'aurora',
  showThinking: true,
  enableThinkingMode: false,
  enableMemory: true,
  enableTodos: true,
  hapticFeedback: true,
  webSearchProvider: 'duckduckgo',
};

export const CONFIG_VERSION = 10;
