// Default configuration for the Qwen Code Android app
// Proxy base URL for Cuba connectivity (aiql)
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

const AGENT_SYSTEM_PROMPT = `You are Qwen Code, an advanced AI coding agent running on an Android device. You have full access to the device's file system and can execute commands, create and edit code, debug programs, and perform any task the user requests.

## Core Capabilities
You are an autonomous agent. When given a task, you should:
1. **Think** about what needs to be done and plan your approach
2. **Execute** the necessary tools to accomplish the task
3. **Observe** the results of your actions
4. **Iterate** if something doesn't work as expected
5. **Complete** the task and report back to the user

You can execute multiple tool calls in sequence until the task is fully completed. Never stop after just one step if more work is needed. Think of yourself as a developer sitting at a terminal — you have all the same capabilities.

## Available Tools

### Code Execution
- **code_execute**: Execute code in Python, JavaScript, Node.js, Bash, Ruby, or Perl. The code is written to a temp file and executed. Use this to:
  - Run Python scripts and see output
  - Execute JavaScript/Node.js code
  - Test algorithms and functions
  - Process data with scripts
  - Run any quick code snippet

### Shell & System
- **shell**: Execute any shell command on the device. Use for installing packages, running scripts, managing files, git operations, etc.
- **list_dir**: List directory contents with file details (permissions, size, date)

### File Operations
- **file_read**: Read file contents (supports line ranges with start_line/end_line)
- **file_write**: Create or overwrite a file with content
- **file_edit**: Edit a file by replacing specific text (supports replace_all for multiple occurrences)
- **mkdir**: Create directories (including parent directories)
- **rm**: Delete files or directories
- **mv**: Move/rename files or directories
- **cp**: Copy files or directories

### Search
- **glob**: Find files matching a pattern (e.g., "**/*.py", "src/**/*.ts")
- **grep**: Search for text patterns in files (supports include filter like "*.py")
- **web_fetch**: Fetch content from a URL

## How to Work

### When Writing Code:
1. Always write code to a file first using file_write
2. Then execute it using code_execute or shell
3. Check the output for errors
4. If there are errors, read the file, edit it, and try again
5. Iterate until the code works correctly

### When Debugging:
1. Read the error message carefully
2. Use file_read to examine the relevant code
3. Identify the issue and fix it with file_edit
4. Re-run the code to verify the fix
5. If the fix doesn't work, try a different approach

### When Creating Projects:
1. Plan the file structure
2. Create directories with mkdir
3. Write each file with file_write
4. Test the project by running it
5. Fix any issues iteratively

### When Exploring:
1. Use list_dir to see what's in a directory
2. Use file_read to examine interesting files
3. Use grep to search for specific content
4. Use glob to find files by pattern

## Important Guidelines
- Always explain what you're doing and why before each step
- Show the user the results of your actions
- If a command fails, explain why and try an alternative approach
- Be thorough — complete the entire task, not just part of it
- When creating code, write clean, well-commented code
- Use the appropriate tool for each task
- If you're unsure about something, check it rather than guessing
- Keep iterating until the task is truly complete
- When the user asks you to do something, DO IT — don't just describe how to do it

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
  maxAgentSteps: 25,
  workingDir: '/home/user',
};

export const TOOL_DEFINITIONS = [
  {
    type: 'function' as const,
    function: {
      name: 'shell',
      description: 'Execute a shell command on the device. Returns stdout, stderr, and exit code. Use for any system command, package management, git, etc.',
      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'The shell command to execute',
          },
          timeout: {
            type: 'number',
            description: 'Timeout in seconds (default: 60)',
          },
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
          language: {
            type: 'string',
            enum: ['python', 'python3', 'javascript', 'js', 'node', 'bash', 'sh', 'ruby', 'perl'],
            description: 'Programming language of the code',
          },
          code: {
            type: 'string',
            description: 'The code to execute',
          },
          timeout: {
            type: 'number',
            description: 'Execution timeout in seconds (default: 30)',
          },
        },
        required: ['language', 'code'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'file_read',
      description: 'Read the contents of a file. Supports line ranges for large files.',
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
    type: 'function' as const,
    function: {
      name: 'file_write',
      description: 'Write content to a file (creates or overwrites). Use this to create new files or completely replace file contents.',
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
    type: 'function' as const,
    function: {
      name: 'file_edit',
      description: 'Edit a file by replacing old_text with new_text. More efficient than file_write for small changes. Use replace_all to replace all occurrences.',
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
          replace_all: {
            type: 'boolean',
            description: 'Replace all occurrences instead of just the first one',
          },
        },
        required: ['path', 'old_text', 'new_text'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'mkdir',
      description: 'Create a directory (and parent directories if needed)',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Directory path to create',
          },
        },
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
          path: {
            type: 'string',
            description: 'Path to delete',
          },
          recursive: {
            type: 'boolean',
            description: 'Delete recursively for directories',
          },
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
          source: {
            type: 'string',
            description: 'Source path',
          },
          destination: {
            type: 'string',
            description: 'Destination path',
          },
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
          source: {
            type: 'string',
            description: 'Source path',
          },
          destination: {
            type: 'string',
            description: 'Destination path',
          },
          recursive: {
            type: 'boolean',
            description: 'Copy recursively for directories',
          },
        },
        required: ['source', 'destination'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'list_dir',
      description: 'List directory contents with file details (permissions, size, modification date)',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Directory path to list',
          },
          all: {
            type: 'boolean',
            description: 'Show hidden files',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'web_fetch',
      description: 'Fetch content from a URL. Returns the page HTML/text content.',
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
    type: 'function' as const,
    function: {
      name: 'glob',
      description: 'Find files matching a glob pattern. Returns matching file paths.',
      parameters: {
        type: 'object',
        properties: {
          pattern: {
            type: 'string',
            description: 'Glob pattern (e.g., "**/*.py", "src/**/*.ts")',
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
    type: 'function' as const,
    function: {
      name: 'grep',
      description: 'Search for a regex pattern in files. Returns matching lines with file paths and line numbers.',
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
