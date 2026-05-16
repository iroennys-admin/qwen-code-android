// Default configuration for the Qwen Code Android app
const CUBA_PROXY_BASE = 'https://nvidia.aiql.com';

import type { AppConfig, Provider, ModelInfo } from '../types';

const NVIDIA_MODELS: ModelInfo[] = [
  { id: 'nvidia/nemotron-3-super-120b-a12b', name: 'Nemotron 3 Super 120B', contextLength: 131072 },
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
    id: 'nvidia',
    name: 'NVIDIA NIM',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    proxyBaseUrl: 'https://nvidia.aiql.com/v1',
    apiKey: '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',
    models: NVIDIA_MODELS,
    enabled: true,
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    proxyBaseUrl: 'https://openrouter.aiql.com/v1',
    apiKey: '',
    models: OPENROUTER_MODELS,
    enabled: true,
  },
  {
    id: 'mistral',
    name: 'Mistral',
    baseUrl: 'https://api.mistral.ai/v1',
    proxyBaseUrl: 'https://mistral.aiql.com/v1',
    apiKey: '',
    models: MISTRAL_MODELS,
    enabled: true,
  },
  {
    id: 'grok',
    name: 'Grok (xAI)',
    baseUrl: 'https://api.x.ai/v1',
    proxyBaseUrl: 'https://xai.aiql.com/v1',
    apiKey: '',
    models: GROK_MODELS,
    enabled: true,
  },
];

const AGENT_SYSTEM_PROMPT = `You are Qwen Code, an advanced AI coding agent running on an Android device. You have FULL ACCESS to the entire device filesystem and can execute any command, create and edit any file, debug programs, search the web, and perform any task the user requests. You are essentially a developer with root-level shell access.

## Core Principle: AUTONOMOUS EXECUTION
You are an autonomous agent. When given a task:
1. THINK about what needs to be done and plan your approach
2. EXECUTE the necessary tools to accomplish the task
3. OBSERVE the results of your actions
4. ITERATE if something does not work as expected
5. COMPLETE the task fully before reporting back

NEVER just describe how to do something - DO IT. Never stop after one step if more work is needed. Keep going until the task is truly complete.

## Device Filesystem
You have access to the FULL Android filesystem:
- /sdcard/ - User storage (Downloads, Documents, Pictures, etc.)
- /storage/ - External storage
- /data/data/com.qwen.code.android/ - App private storage
- /tmp/ - Temporary files
- All directories the user has permissions for

IMPORTANT: Use /sdcard/ as the default home directory, NOT /home/user.

## Available Tools (16 total)

### Code Execution
- **code_execute**: Execute code in Python, JavaScript, Node.js, Bash, Ruby, or Perl. The code is written to a temp file and executed.
- **npx_install**: Run any npx package instantly (auto-installs and executes). Use for tools like create-react-app, degit, typescript, etc.

### Shell & System
- **shell**: Execute any shell command on the device. Full shell access.
- **list_dir**: List directory contents with file details (permissions, size, date)

### File Operations (full access)
- **file_read**: Read file contents (supports line ranges with start_line/end_line)
- **file_write**: Create or overwrite a file with content. Creates parent directories automatically.
- **file_edit**: Edit a file by replacing specific text (supports replace_all)
- **mkdir**: Create directories (including parent directories)
- **rm**: Delete files or directories (supports recursive)
- **mv**: Move/rename files or directories
- **cp**: Copy files or directories (supports recursive)

### Web & Internet
- **web_search**: Search the web using DuckDuckGo. Returns titles, URLs, and snippets.
- **web_scrape**: Scrape a webpage and extract clean text content and links.
- **web_fetch**: Fetch raw content from a URL. Returns HTML or text.

### Search
- **glob**: Find files matching a pattern (e.g., "**/*.py", "src/**/*.ts")
- **grep**: Search for text patterns in files (supports include filter)

## How to Work

### When Writing Code:
1. Write code to a file using file_write (use /sdcard/ as base directory)
2. Execute it using code_execute or shell
3. Check the output for errors
4. If errors, read the file, edit it, and try again
5. Iterate until the code works correctly

### When Debugging:
1. Read the error message carefully
2. Use file_read to examine the relevant code
3. Identify the issue and fix it with file_edit
4. Re-run the code to verify the fix
5. If the fix does not work, try a different approach

### When Searching the Web:
1. Use web_search to find information (works from Cuba via DuckDuckGo)
2. Use web_scrape to get detailed content from a specific page
3. Use web_fetch for raw HTML/API responses
4. IMPORTANT: web_search and web_scrape use native HTTP (bypasses CORS), so they always work

### When Using NPX Skills:
- Use npx_install to run any npm package instantly without installing it globally
- Examples: npx_install with package="create-react-app" and args="my-app"
- This auto-installs and runs the package in one step

### When Creating Projects:
1. Plan the file structure
2. Create directories with mkdir (use /sdcard/projects/)
3. Write each file with file_write
4. Test the project by running it
5. Fix any issues iteratively

## Important Guidelines
- Always explain what you are doing in Spanish before each step
- Show the user the results of your actions
- If a command fails, explain why and try an alternative approach
- Be thorough - complete the ENTIRE task, not just part of it
- When creating code, write clean, well-commented code
- Use the appropriate tool for each task
- If unsure about something, check it rather than guessing
- Keep iterating until the task is truly complete
- DO IT, do not just describe how to do it

## Language
The user communicates in Spanish. Respond in Spanish but write code, file names, and technical terms in English as appropriate. Always explain your actions in Spanish.`;

export const DEFAULT_CONFIG: AppConfig = {
  providers: DEFAULT_PROVIDERS,
  activeProvider: 'nvidia',
  activeModel: 'nvidia/nemotron-3-super-120b-a12b',
  proxyEnabled: true,
  proxyBaseUrl: CUBA_PROXY_BASE,
  streaming: true,
  temperature: 0.7,
  maxTokens: 8192,
  systemPrompt: AGENT_SYSTEM_PROMPT,
  approvalMode: 'auto_edit',
  lowRamMode: false,
  fontSize: 14,
  theme: 'dark',
  maxAgentSteps: 30,
  workingDir: '/sdcard',
};

export const TOOL_DEFINITIONS = [
  {
    type: 'function' as const,
    function: {
      name: 'shell',
      description: 'Execute a shell command on the device. Returns stdout, stderr, and exit code. Use for any system command, package management, git, pip, npm, etc.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'The shell command to execute' },
          timeout: { type: 'number', description: 'Timeout in seconds (default: 60)' },
        },
        required: ['command'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'code_execute',
      description: 'Execute code in a programming language. The code is written to a temporary file and executed. Use this to run Python, JavaScript, or other code. Returns the output and any errors.',
      parameters: {
        type: 'object',
        properties: {
          language: { type: 'string', enum: ['python', 'python3', 'javascript', 'js', 'node', 'bash', 'sh', 'ruby', 'perl'], description: 'Programming language' },
          code: { type: 'string', description: 'The code to execute' },
          timeout: { type: 'number', description: 'Timeout in seconds (default: 30)' },
        },
        required: ['language', 'code'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'npx_install',
      description: 'Run any npx package instantly. Auto-installs and executes the package. Use for tools like create-react-app, degit, typescript compiler, etc. Example: npx_install with package="create-react-app" args="my-app"',
      parameters: {
        type: 'object',
        properties: {
          package: { type: 'string', description: 'The npm package to run with npx (e.g., "create-react-app", "typescript", "prettier")' },
          args: { type: 'string', description: 'Arguments to pass to the package' },
          timeout: { type: 'number', description: 'Timeout in seconds (default: 120)' },
        },
        required: ['package'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'file_read',
      description: 'Read the contents of a file. Supports line ranges for large files. Has access to the full device filesystem.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to the file to read (e.g., "/sdcard/Documents/code.py")' },
          start_line: { type: 'number', description: 'Start line number (1-based)' },
          end_line: { type: 'number', description: 'End line number' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'file_write',
      description: 'Write content to a file (creates or overwrites). Creates parent directories automatically. Has access to the full device filesystem.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to the file to write (e.g., "/sdcard/projects/hello.py")' },
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
      description: 'Edit a file by replacing old_text with new_text. Use replace_all to replace all occurrences.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to the file to edit' },
          old_text: { type: 'string', description: 'Text to find and replace' },
          new_text: { type: 'string', description: 'Replacement text' },
          replace_all: { type: 'boolean', description: 'Replace all occurrences' },
        },
        required: ['path', 'old_text', 'new_text'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'mkdir',
      description: 'Create a directory (and all parent directories if needed)',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string', description: 'Directory path to create' } },
        required: ['path'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'rm',
      description: 'Delete a file or directory',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to delete' },
          recursive: { type: 'boolean', description: 'Delete recursively for directories' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'mv',
      description: 'Move or rename a file or directory',
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
      description: 'Copy a file or directory',
      parameters: {
        type: 'object',
        properties: {
          source: { type: 'string', description: 'Source path' },
          destination: { type: 'string', description: 'Destination path' },
          recursive: { type: 'boolean', description: 'Copy recursively' },
        },
        required: ['source', 'destination'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'list_dir',
      description: 'List directory contents with file details (permissions, size, date). Lists the full filesystem.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory path (default: /sdcard)' },
          all: { type: 'boolean', description: 'Show hidden files' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'web_search',
      description: 'Search the web using DuckDuckGo. Returns search results with titles, URLs, and snippets. Works from Cuba. Use this when you need to find information online.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          num_results: { type: 'number', description: 'Number of results (default: 10)' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'web_scrape',
      description: 'Scrape a webpage and extract clean text content. Returns the page title, text content, and links. Works from Cuba. Use this when you need detailed content from a specific URL.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL to scrape' },
          include_links: { type: 'boolean', description: 'Include extracted links' },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'web_fetch',
      description: 'Fetch raw content from a URL. Returns HTML or text. Works from Cuba via native HTTP. Use for API calls, raw HTML, or when you need the exact response.',
      parameters: {
        type: 'object',
        properties: { url: { type: 'string', description: 'URL to fetch' } },
        required: ['url'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'glob',
      description: 'Find files matching a pattern. Returns matching file paths.',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Glob pattern (e.g., "**/*.py")' },
          path: { type: 'string', description: 'Base directory to search in' },
        },
        required: ['pattern'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'grep',
      description: 'Search for a pattern in files. Returns matching lines with file paths and line numbers.',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Search pattern (regex)' },
          path: { type: 'string', description: 'Directory or file to search in' },
          include: { type: 'string', description: 'File pattern to include (e.g., "*.py")' },
        },
        required: ['pattern'],
      },
    },
  },
];
