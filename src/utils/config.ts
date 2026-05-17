// Default configuration for the Qwen Code Android app v3.0.0
const CUBA_PROXY_BASE = 'https://nvidia.aiql.com';

import type { AppConfig, Provider, ModelInfo } from '../types';

const NVIDIA_MODELS: ModelInfo[] = [
  { id: 'z-ai/glm-5.1', name: 'GLM-5.1 (Flagship)', contextLength: 203000 },
  { id: 'z-ai/glm5', name: 'GLM-5', contextLength: 200000 },
  { id: 'nvidia/nemotron-3-super-120b-a12b', name: 'Nemotron 3 Super 120B', contextLength: 131072 },
  { id: 'nvidia/llama-3.1-nemotron-ultra-253b-v1', name: 'Nemotron Ultra 253B', contextLength: 131072 },
  { id: 'qwen/qwen3.5-397b-a17b', name: 'Qwen 3.5 397B', contextLength: 131072 },
  { id: 'qwen/qwen3-coder-480b-a35b-instruct', name: 'Qwen3 Coder 480B', contextLength: 131072 },
  { id: 'deepseek-ai/deepseek-v4-pro', name: 'DeepSeek V4 Pro', contextLength: 131072 },
  { id: 'meta/llama-4-maverick-17b-128e-instruct', name: 'Llama 4 Maverick', contextLength: 131072 },
  { id: 'nvidia/llama-3.3-nemotron-super-49b-v1', name: 'Nemotron Super 49B', contextLength: 131072 },
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

const ZAI_MODELS: ModelInfo[] = [
  { id: 'glm-5.1', name: 'GLM-5.1 (Flagship)', contextLength: 203000 },
  { id: 'glm-5', name: 'GLM-5', contextLength: 200000 },
  { id: 'glm-5-turbo', name: 'GLM-5 Turbo', contextLength: 200000 },
  { id: 'glm-4.7', name: 'GLM-4.7', contextLength: 131072 },
  { id: 'glm-4.5-air', name: 'GLM-4.5 Air', contextLength: 131072 },
  { id: 'glm-4.4', name: 'GLM-4.4', contextLength: 131072 },
  { id: 'glm-4.3', name: 'GLM-4.3', contextLength: 131072 },
];

const MODAL_MODELS: ModelInfo[] = [
  { id: 'glm-5.1', name: 'GLM-5.1 (Free)', contextLength: 203000 },
];

const OPENCODE_FREE_MODELS: ModelInfo[] = [
  // Free models - no API key needed, use apiKey "public"
  { id: 'deepseek-v4-flash-free', name: 'DeepSeek V4 Flash (FREE)', contextLength: 200000, description: 'Most capable free model, reasoning + tool call' },
  { id: 'qwen3.6-plus-free', name: 'Qwen3.6 Plus (FREE)', contextLength: 262144, description: 'Alibaba Qwen3.6, reasoning + tool call' },
  { id: 'big-pickle', name: 'Big Pickle (FREE)', contextLength: 200000, description: 'OpenCode custom model, reasoning + tool call' },
  { id: 'minimax-m2.5-free', name: 'MiniMax M2.5 (FREE)', contextLength: 204800, description: 'MiniMax reasoning model' },
  { id: 'nemotron-3-super-free', name: 'Nemotron 3 Super (FREE)', contextLength: 204800, description: 'NVIDIA Nemotron reasoning model' },
];

const OPENCODE_PAID_MODELS: ModelInfo[] = [
  // Paid models - require OPENCODE_API_KEY
  { id: 'glm-5.1', name: 'GLM-5.1', contextLength: 204800, description: 'Z.ai flagship model' },
  { id: 'glm-5', name: 'GLM-5', contextLength: 204800 },
  { id: 'gpt-5.1', name: 'GPT-5.1', contextLength: 400000 },
  { id: 'gpt-5.4-nano', name: 'GPT-5.4 Nano', contextLength: 400000 },
  { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', contextLength: 1000000 },
  { id: 'gemini-3-flash', name: 'Gemini 3 Flash', contextLength: 1048576 },
  { id: 'qwen3-coder', name: 'Qwen3 Coder', contextLength: 262144 },
  { id: 'kimi-k2.5', name: 'Kimi K2.5', contextLength: 262144 },
];

export const DEFAULT_PROVIDERS: Provider[] = [
  {
    id: 'opencode',
    name: 'OpenCode Zen (FREE)',
    baseUrl: 'https://opencode.ai/zen/v1',
    proxyBaseUrl: '',
    apiKey: 'public',  // Free models use "public" as API key
    models: [...OPENCODE_FREE_MODELS, ...OPENCODE_PAID_MODELS],
    enabled: true,
  },
  {
    id: 'nvidia',
    name: 'NVIDIA NIM (GLM-5.1 FREE)',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    proxyBaseUrl: 'https://nvidia.aiql.com/v1',
    apiKey: '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',
    models: NVIDIA_MODELS,
    enabled: true,
  },
  {
    id: 'zai',
    name: 'Z.ai (GLM API)',
    baseUrl: 'https://api.z.ai/api/paas/v4',
    proxyBaseUrl: 'https://zai.aiql.com/v1',
    apiKey: '23296a27f5804820a1f9256e8c2ebc41.103euTSJeqU5Vni3',
    models: ZAI_MODELS,
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

const AGENT_SYSTEM_PROMPT = `You are Qwen Code v3.3.2, an advanced AI agent running on an Android device with FULL DEVICE CONTROL. You can execute commands, read/write any file, send messages, make calls, control other apps, read the screen, automate UI interactions, and perform ANY task the user requests. You are essentially the user's personal assistant with complete access to their phone.

## Core Principle: AUTONOMOUS EXECUTION
You are an autonomous agent. When given a task:
1. THINK about what needs to be done and plan your approach
2. EXECUTE the necessary tools to accomplish the task
3. OBSERVE the results of your actions
4. ITERATE if something does not work as expected
5. COMPLETE the task fully before reporting back

NEVER just describe how to do something - DO IT. Never stop after one step if more work is needed. Keep going until the task is truly complete.

## Device Access (Full Control)
You have COMPLETE access to the Android device:
- /sdcard/ - User storage (Downloads, Documents, Pictures, etc.)
- /storage/ - External storage
- /data/ - App data (where accessible)
- /system/ - System files (read-only without root)
- All directories the user has permissions for

IMPORTANT: Use /sdcard/ as the default home directory, NOT /home/user.

## Available Tools (28 total)

### Code Execution
- **code_execute**: Execute code in Python, JavaScript, Node.js, Bash, Ruby, or Perl
- **npx_install**: Run any npx package instantly (auto-installs and executes)

### Shell & System
- **shell**: Execute any shell command on the device. Full shell access.
- **list_dir**: List directory contents with file details
- **get_device_info**: Get device info (manufacturer, model, Android version, storage, root status)
- **show_toast**: Show a brief toast message on screen

### File Operations (full access)
- **file_read**: Read file contents (supports line ranges)
- **file_write**: Create or overwrite a file with content. Creates parent directories automatically.
- **file_edit**: Edit a file by replacing specific text (supports replace_all)
- **mkdir**: Create directories (including parent directories)
- **rm**: Delete files or directories (supports recursive)
- **mv**: Move/rename files or directories
- **cp**: Copy files or directories

### Web & Internet (Fixed - works from Cuba)
- **web_search**: Search the web using DuckDuckGo or Google. Returns titles, URLs, and snippets.
- **web_scrape**: Scrape a webpage and extract clean text content and links.
- **web_fetch**: Fetch raw content from a URL. Returns HTML or text.

### Search
- **glob**: Find files matching a pattern (e.g., "**/*.py")
- **grep**: Search for text patterns in files (supports include filter)

### SMS & Messaging
- **send_sms**: Send an SMS message to any phone number. Requires SMS permission.
- **read_sms**: Read recent SMS messages. Can filter by phone number.

### WhatsApp
- **send_whatsapp**: Open WhatsApp with a message for a specific number, or share text via WhatsApp. User must press Send in WhatsApp. Use phone_number with country code (e.g., "5355555555" for Cuba).

### Phone & Calls
- **make_call**: Make a phone call to any number. Requires CALL_PHONE permission.
- **read_call_log**: Read recent call log entries (incoming, outgoing, missed).

### Contacts
- **read_contacts**: Read device contacts. Can search by name. Returns name and phone numbers.

### App Control
- **launch_app**: Launch any app by package name (e.g., "com.whatsapp", "com.android.chrome")
- **list_apps**: List all user-installed apps on the device

### UI Automation (Accessibility Service)
IMPORTANT: The Accessibility Service must be enabled first in Settings > Accessibility > Qwen Code.
- **read_screen**: Read all visible text on the current screen. Returns current app and all text elements.
- **click_text**: Click on a UI element by its text content. Use exact_match for precise matching.
- **click_at**: Click at specific screen coordinates (x, y)
- **type_text**: Type text into the currently focused input field
- **swipe**: Perform a swipe gesture from one point to another
- **press_back**: Press the Android back button
- **press_home**: Press the Android home button

### Notifications
- **read_notifications**: Read all active device notifications. Requires notification access permission.
- **dismiss_notification**: Dismiss a specific notification by its key

### Clipboard
- **clipboard_read**: Read text from the clipboard
- **clipboard_write**: Copy text to the clipboard

## How to Work

### When Sending WhatsApp Messages:
1. Use send_whatsapp with the phone number (with country code, no +) and message
2. WhatsApp will open with the message pre-filled
3. If you have Accessibility Service enabled, you can then use click_text to press "Send"
4. Example: send_whatsapp phone_number="5355555555" message="Hola, como estas?"
5. Then: click_text text="Enviar" to auto-press send

### When Automating Apps:
1. Launch the app with launch_app (e.g., launch_app package_name="com.whatsapp")
2. Read the screen with read_screen to see what's on display
3. Interact using click_text, click_at, type_text, swipe
4. Navigate with press_back and press_home
5. Read the screen again to verify actions

### When Writing Code:
1. Write code to a file using file_write (use /sdcard/ as base directory)
2. Execute it using code_execute or shell
3. Check the output for errors
4. If errors, read the file, edit it, and try again
5. Iterate until the code works correctly

### When Searching the Web:
1. Use web_search to find information
2. Use web_scrape to get detailed content from a specific page
3. Use web_fetch for raw HTML/API responses

### When Using NPX Skills:
- Use npx_install to run any npm package instantly
- Examples: npx_install with package="create-react-app" and args="my-app"

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
- For WhatsApp automation, always check if Accessibility is available first
- If a permission is missing, tell the user exactly how to enable it in Settings

## Language
The user communicates in Spanish. Respond in Spanish but write code, file names, and technical terms in English as appropriate. Always explain your actions in Spanish.`;

export const DEFAULT_CONFIG: AppConfig = {
  providers: DEFAULT_PROVIDERS,
  activeProvider: 'opencode',
  activeModel: 'deepseek-v4-flash-free',
  proxyEnabled: false,
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
  // Shell & Code
  {
    type: 'function' as const,
    function: {
      name: 'shell',
      description: 'Execute a shell command on the device. Returns stdout, stderr, and exit code.',
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
      description: 'Execute code in a programming language. The code is written to a temporary file and executed.',
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
      description: 'Run any npx package instantly. Auto-installs and executes the package. Use for tools like create-react-app, degit, typescript compiler, etc.',
      parameters: {
        type: 'object',
        properties: {
          package: { type: 'string', description: 'The npm package to run with npx' },
          args: { type: 'string', description: 'Arguments to pass to the package' },
          timeout: { type: 'number', description: 'Timeout in seconds (default: 120)' },
        },
        required: ['package'],
      },
    },
  },
  // File Operations
  {
    type: 'function' as const,
    function: {
      name: 'file_read',
      description: 'Read the contents of a file. Supports line ranges. Has access to the full device filesystem.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to the file to read' },
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
      description: 'Write content to a file (creates or overwrites). Creates parent directories automatically.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to the file to write' },
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
        },
        required: ['source', 'destination'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'list_dir',
      description: 'List directory contents with file details. Lists the full filesystem.',
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
  // Web
  {
    type: 'function' as const,
    function: {
      name: 'web_search',
      description: 'Search the web using DuckDuckGo or Google. Returns search results with titles, URLs, and snippets.',
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
      description: 'Scrape a webpage and extract clean text content. Returns page title, text content, and links.',
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
      description: 'Fetch raw content from a URL. Returns HTML or text. Use for API calls or raw content.',
      parameters: {
        type: 'object',
        properties: { url: { type: 'string', description: 'URL to fetch' } },
        required: ['url'],
      },
    },
  },
  // Search
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
  // SMS
  {
    type: 'function' as const,
    function: {
      name: 'send_sms',
      description: 'Send an SMS message to a phone number. Requires SMS permission.',
      parameters: {
        type: 'object',
        properties: {
          phone_number: { type: 'string', description: 'Phone number to send SMS to' },
          message: { type: 'string', description: 'SMS message content' },
        },
        required: ['phone_number', 'message'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'read_sms',
      description: 'Read recent SMS messages. Can filter by phone number.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Number of messages to read (default: 20)' },
          phone_number: { type: 'string', description: 'Filter by phone number' },
        },
        required: [],
      },
    },
  },
  // WhatsApp
  {
    type: 'function' as const,
    function: {
      name: 'send_whatsapp',
      description: 'Open WhatsApp with a message for a specific number. User must press Send in WhatsApp. With Accessibility enabled, can auto-press send. Phone number should include country code without + (e.g., "5355555555" for Cuba).',
      parameters: {
        type: 'object',
        properties: {
          phone_number: { type: 'string', description: 'Phone number with country code (no +). e.g., "5355555555"' },
          message: { type: 'string', description: 'Message to send' },
        },
        required: ['message'],
      },
    },
  },
  // Phone
  {
    type: 'function' as const,
    function: {
      name: 'make_call',
      description: 'Make a phone call to a number. Requires CALL_PHONE permission.',
      parameters: {
        type: 'object',
        properties: {
          phone_number: { type: 'string', description: 'Phone number to call' },
        },
        required: ['phone_number'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'read_call_log',
      description: 'Read recent call log entries (incoming, outgoing, missed).',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Number of entries (default: 20)' },
        },
        required: [],
      },
    },
  },
  // Contacts
  {
    type: 'function' as const,
    function: {
      name: 'read_contacts',
      description: 'Read device contacts. Can search by name. Returns name and phone numbers.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Number of contacts (default: 50)' },
          search: { type: 'string', description: 'Search by name' },
        },
        required: [],
      },
    },
  },
  // Apps
  {
    type: 'function' as const,
    function: {
      name: 'launch_app',
      description: 'Launch an app by package name (e.g., "com.whatsapp", "com.android.chrome", "com.telegram.messenger")',
      parameters: {
        type: 'object',
        properties: {
          package_name: { type: 'string', description: 'App package name (e.g., "com.whatsapp")' },
          action: { type: 'string', description: 'Intent action (optional)' },
          data: { type: 'string', description: 'Intent data URI (optional)' },
        },
        required: ['package_name'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'list_apps',
      description: 'List all user-installed apps on the device.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  // Accessibility / UI Automation
  {
    type: 'function' as const,
    function: {
      name: 'read_screen',
      description: 'Read all visible text on the current screen. Returns current app package name and all text elements. Requires Accessibility Service enabled.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'click_text',
      description: 'Click on a UI element by its text content. Requires Accessibility Service enabled.',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Text of the element to click' },
          exact_match: { type: 'boolean', description: 'Require exact text match (default: false)' },
        },
        required: ['text'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'click_at',
      description: 'Click at specific screen coordinates. Requires Accessibility Service enabled.',
      parameters: {
        type: 'object',
        properties: {
          x: { type: 'number', description: 'X coordinate' },
          y: { type: 'number', description: 'Y coordinate' },
        },
        required: ['x', 'y'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'type_text',
      description: 'Type text into the currently focused input field. Requires Accessibility Service enabled.',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Text to type' },
        },
        required: ['text'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'swipe',
      description: 'Perform a swipe gesture. Requires Accessibility Service enabled.',
      parameters: {
        type: 'object',
        properties: {
          start_x: { type: 'number', description: 'Start X coordinate' },
          start_y: { type: 'number', description: 'Start Y coordinate' },
          end_x: { type: 'number', description: 'End X coordinate' },
          end_y: { type: 'number', description: 'End Y coordinate' },
          duration: { type: 'number', description: 'Duration in ms (default: 300)' },
        },
        required: ['start_x', 'start_y', 'end_x', 'end_y'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'press_back',
      description: 'Press the Android back button. Requires Accessibility Service enabled.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'press_home',
      description: 'Press the Android home button. Requires Accessibility Service enabled.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  // Notifications
  {
    type: 'function' as const,
    function: {
      name: 'read_notifications',
      description: 'Read all active device notifications. Requires notification access permission.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Number of notifications (default: 20)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'dismiss_notification',
      description: 'Dismiss a notification by its key.',
      parameters: {
        type: 'object',
        properties: {
          key: { type: 'string', description: 'Notification key from read_notifications' },
        },
        required: ['key'],
      },
    },
  },
  // Clipboard
  {
    type: 'function' as const,
    function: {
      name: 'clipboard_read',
      description: 'Read text from the clipboard.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'clipboard_write',
      description: 'Copy text to the clipboard.',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Text to copy to clipboard' },
        },
        required: ['text'],
      },
    },
  },
  // Device Info
  {
    type: 'function' as const,
    function: {
      name: 'get_device_info',
      description: 'Get device information (manufacturer, model, Android version, storage, root status).',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'show_toast',
      description: 'Show a brief toast message on the device screen.',
      parameters: {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'Toast message to display' },
        },
        required: ['message'],
      },
    },
  },
  // OpenCode Tools
  {
    type: 'function' as const,
    function: {
      name: 'opencode_setup',
      description: 'Set up the OpenCode AI environment. Installs proot-distro, Ubuntu rootfs, and OpenCode binary. This is required before using opencode_run.',
      parameters: {
        type: 'object',
        properties: {
          reinstall: { type: 'boolean', description: 'Force reinstall even if already installed' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'opencode_run',
      description: 'Run a command inside the OpenCode proot Ubuntu environment. Use this to execute opencode or any Linux command.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Command to run inside proot Ubuntu' },
          timeout: { type: 'number', description: 'Timeout in seconds (default: 60)' },
        },
        required: ['command'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'opencode_status',
      description: 'Check the OpenCode installation status. Returns whether proot, Ubuntu, and OpenCode are installed.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
];
