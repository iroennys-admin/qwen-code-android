// ==========================================
import * as bridgeMod from './bridge';
// OpenCode CLI - In-app JavaScript port of opencode.
// Runs inside the WebView (works on any arch including 32-bit ARMv7).
//
// Commands:
//   opencode                          → interactive REPL
//   opencode "prompt"                 → one-shot prompt
//   opencode --model <id>             → switch model
//   opencode --provider <id>          → switch provider
//   opencode --list-models            → list available models
//   opencode --list-providers         → list providers
//   opencode --config                 → show config
//   opencode help                     → help
// ==========================================

import type { AppConfig, OpenCodeMessage, ApiMessage, OpenCodeToolCall } from '../types';
import { runAgentLoop, chatMessagesToApiMessages } from './agent';

export interface CliEnv {
  config: AppConfig;
  saveConfig: (c: AppConfig) => void;
  print: (text: string, type?: 'stdout' | 'stderr' | 'info') => void;
  /** Ask user for next line of input (used by REPL). */
  readLine: (prompt: string) => Promise<string | null>;
  /** Set/unset interactive mode (terminal blocks input while CLI runs). */
  setBusy: (busy: boolean) => void;
}

const BANNER = `╔══════════════════════════════════════════════╗
║  ◆ OpenCode CLI v2  — AI coding agent        ║
║  Integrated in-app. Type 'help' for commands ║
╚══════════════════════════════════════════════╝`;

const HELP = `OpenCode CLI commands:
  /help                     Show this help
  /exit                     Exit the REPL
  /model <id>               Switch model
  /provider <id>            Switch provider
  /models                   List models for current provider
  /providers                List providers
  /config                   Show current config
  /clear                    Clear screen
  /reset                    Reset conversation history
  /system <text>            Set system prompt for this session
  /tools                    List available tools
  /history                  Show recent messages
  /save <file>              Save conversation to file
  /load <file>              Load conversation from file (json)

Any other text is sent to the AI agent.
You can also run:  opencode "prompt"   for a one-shot call.`;

// Quick history scoped to one CLI session
let convo: OpenCodeMessage[] = [];
let aborted = false;

export async function runOpencodeCommand(argv: string[], env: CliEnv): Promise<void> {
  // Parse flags
  const args: string[] = [];
  const flags: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const v = argv[i + 1];
      if (v && !v.startsWith('--')) { flags[k] = v; i++; }
      else flags[k] = true;
    } else args.push(a);
  }

  // No args → interactive REPL
  if (args.length === 0 && Object.keys(flags).length === 0) {
    return repl(env);
  }

  if (flags.help || args[0] === 'help') { env.print(HELP + '\n'); return; }
  if (flags['list-providers'] || args[0] === 'providers') {
    listProviders(env); return;
  }
  if (flags['list-models'] || args[0] === 'models') {
    listModels(env); return;
  }
  if (flags.config || args[0] === 'config') {
    showConfig(env); return;
  }
  if (flags.provider && typeof flags.provider === 'string') {
    setProvider(env, flags.provider as string); return;
  }
  if (flags.model && typeof flags.model === 'string') {
    setModel(env, flags.model as string); return;
  }
  if (flags.version || args[0] === 'version') {
    env.print('opencode v2.0.0 (in-app)\n'); return;
  }

  // One-shot: opencode "prompt..."
  const prompt = args.join(' ');
  if (prompt.trim()) {
    await runOnce(env, prompt);
    return;
  }

  env.print(HELP + '\n');
}

// ----------------- REPL -----------------
async function repl(env: CliEnv): Promise<void> {
  env.print(BANNER + '\n', 'info');
  const p = env.config.providers.find(x => x.id === env.config.activeProvider);
  env.print(`Provider: ${p?.emoji || ''} ${p?.name}  ·  Model: ${env.config.activeModel}\n`, 'info');
  env.print(`Approval mode: ${env.config.approvalMode}\n`, 'info');
  env.print(`Working dir: ${env.config.workingDir}\n\n`, 'info');

  while (true) {
    const line = await env.readLine('opencode> ');
    if (line === null) { env.print('\n[exit]\n'); return; }
    const text = line.trim();
    if (!text) continue;

    // Slash commands
    if (text.startsWith('/')) {
      const stop = await handleSlash(text, env);
      if (stop) return;
      continue;
    }

    aborted = false;
    await runOnce(env, text);
  }
}

async function handleSlash(line: string, env: CliEnv): Promise<boolean> {
  const [cmd, ...rest] = line.split(/\s+/);
  const arg = rest.join(' ');
  switch (cmd) {
    case '/help': env.print(HELP + '\n'); return false;
    case '/exit': case '/quit': case '/q': env.print('bye 👋\n'); return true;
    case '/clear': env.print('\x1b[2J'); return false;
    case '/reset': convo = []; env.print('✔ History cleared\n', 'info'); return false;
    case '/providers': listProviders(env); return false;
    case '/models': listModels(env); return false;
    case '/config': showConfig(env); return false;
    case '/provider': if (arg) setProvider(env, arg); else env.print('Usage: /provider <id>\n', 'stderr'); return false;
    case '/model': if (arg) setModel(env, arg); else env.print('Usage: /model <id>\n', 'stderr'); return false;
    case '/system':
      if (arg) {
        env.saveConfig({ ...env.config, systemPrompt: arg });
        env.print(`✔ System prompt set (${arg.length} chars)\n`, 'info');
      } else env.print(`Current system prompt:\n${env.config.systemPrompt}\n`);
      return false;
    case '/tools': {
      const tools = ['shell','file_read','file_write','file_edit','file_append','list_dir','glob','grep','web_fetch','web_search','mkdir','rm','mv','cp','todo_add','todo_list','todo_complete','memory_save','memory_get','clipboard_copy','clipboard_read','notify','device_info'];
      env.print('Available tools:\n  ' + tools.join(', ') + '\n');
      return false;
    }
    case '/history':
      if (!convo.length) { env.print('(no messages)\n'); return false; }
      for (const m of convo) {
        env.print(`[${m.role}] ${m.content.slice(0, 200)}${m.content.length > 200 ? '…' : ''}\n`);
      }
      return false;
    case '/save': {
      if (!arg) { env.print('Usage: /save <file>\n', 'stderr'); return false; }
      try {
        const { writeFile } = bridgeMod;
        await writeFile(arg, JSON.stringify(convo, null, 2));
        env.print(`✔ Saved ${convo.length} messages to ${arg}\n`, 'info');
      } catch (e: any) { env.print(`✗ ${e.message}\n`, 'stderr'); }
      return false;
    }
    case '/load': {
      if (!arg) { env.print('Usage: /load <file>\n', 'stderr'); return false; }
      try {
        const { readFile } = bridgeMod;
        const j = JSON.parse(await readFile(arg));
        convo = j;
        env.print(`✔ Loaded ${convo.length} messages\n`, 'info');
      } catch (e: any) { env.print(`✗ ${e.message}\n`, 'stderr'); }
      return false;
    }
    case '/abort': aborted = true; env.print('aborting…\n'); return false;
    default: env.print(`Unknown command: ${cmd}. Type /help\n`, 'stderr'); return false;
  }
}

function listProviders(env: CliEnv) {
  env.print('Providers:\n');
  for (const p of env.config.providers) {
    const star = p.id === env.config.activeProvider ? '*' : ' ';
    const free = p.isFree ? ' [FREE]' : '';
    const key = p.apiKey ? '🔑' : '  ';
    env.print(` ${star} ${key} ${p.id.padEnd(12)} ${p.emoji || ''} ${p.name}${free}\n`);
  }
}

function listModels(env: CliEnv) {
  const p = env.config.providers.find(x => x.id === env.config.activeProvider);
  if (!p) { env.print('No active provider\n', 'stderr'); return; }
  env.print(`Models for ${p.name}:\n`);
  for (const m of p.models) {
    const star = m.id === env.config.activeModel ? '*' : ' ';
    const free = m.isFree ? ' [FREE]' : '';
    const ctx = m.contextLength ? ` ${Math.round(m.contextLength / 1000)}k` : '';
    env.print(` ${star} ${m.id}  —  ${m.name}${ctx}${free}\n`);
  }
}

function showConfig(env: CliEnv) {
  const p = env.config.providers.find(x => x.id === env.config.activeProvider);
  env.print(JSON.stringify({
    activeProvider: env.config.activeProvider,
    providerName: p?.name,
    activeModel: env.config.activeModel,
    temperature: env.config.temperature,
    maxTokens: env.config.maxTokens,
    maxAgentSteps: env.config.maxAgentSteps,
    approvalMode: env.config.approvalMode,
    workingDir: env.config.workingDir,
    proxyEnabled: env.config.proxyEnabled,
    hasApiKey: !!p?.apiKey,
  }, null, 2) + '\n');
}

function setProvider(env: CliEnv, id: string) {
  const p = env.config.providers.find(x => x.id === id);
  if (!p) { env.print(`✗ Unknown provider: ${id}\n`, 'stderr'); return; }
  env.saveConfig({ ...env.config, activeProvider: id, activeModel: p.models[0]?.id || env.config.activeModel });
  env.print(`✔ Switched to ${p.name} · model ${p.models[0]?.id}\n`, 'info');
}
function setModel(env: CliEnv, id: string) {
  const p = env.config.providers.find(x => x.id === env.config.activeProvider);
  if (!p) { env.print('No provider\n', 'stderr'); return; }
  if (!p.models.find(m => m.id === id)) env.print(`(warning: ${id} not in provider model list)\n`);
  env.saveConfig({ ...env.config, activeModel: id });
  env.print(`✔ Model: ${id}\n`, 'info');
}

// ----------------- One-shot prompt -----------------
async function runOnce(env: CliEnv, prompt: string): Promise<void> {
  const p = env.config.providers.find(x => x.id === env.config.activeProvider);
  if (!p?.apiKey) {
    env.print(`✗ No API key for ${p?.name}. Configure it in Settings (⚙️).\n`, 'stderr');
    return;
  }

  env.setBusy(true);
  try {
    const history = chatMessagesToApiMessages(convo);
    const newAssistant: OpenCodeMessage = {
      id: `m_${Date.now()}`, role: 'assistant', content: '', timestamp: Date.now(),
      toolCalls: [], thinking: '', model: env.config.activeModel, provider: env.config.activeProvider,
    };
    const userMsg: OpenCodeMessage = { id: `m_${Date.now()}u`, role: 'user', content: prompt, timestamp: Date.now() };
    convo.push(userMsg);
    convo.push(newAssistant);

    let buffered = '';
    let printedThinkingHeader = false;
    let inToolBlock = false;
    const toolMap = new Map<string, OpenCodeToolCall>();

    await runAgentLoop(env.config, history, prompt, {
      onStateChange: () => {},
      onContent: (t) => {
        if (inToolBlock) { env.print('\n'); inToolBlock = false; }
        buffered += t;
        newAssistant.content = buffered;
        env.print(t);
      },
      onThinking: (t) => {
        if (env.config.showThinking) {
          if (!printedThinkingHeader) { env.print('\n💭 ', 'info'); printedThinkingHeader = true; }
          env.print(t, 'info');
        }
      },
      onToolCall: (tc) => {
        toolMap.set(tc.id, tc);
        newAssistant.toolCalls = [...(newAssistant.toolCalls || []), tc];
        env.print(`\n\n🔧 ${tc.name}(${summarize(tc.params)})`, 'info');
        inToolBlock = true;
      },
      onToolStart: (id) => {
        const tc = toolMap.get(id);
        if (tc) tc.status = 'running';
        env.print(` …`, 'info');
      },
      onToolResult: (id, output, error) => {
        const tc = toolMap.get(id);
        if (tc) { tc.output = output; tc.status = error ? 'error' : 'completed'; }
        const snippet = output.length > 400 ? output.slice(0, 400) + `\n…(+${output.length - 400} chars)` : output;
        env.print(error ? ` ✗\n${snippet}\n` : ` ✓\n${snippet}\n`, error ? 'stderr' : 'info');
      },
      onToolApproval: async (tc) => {
        const ans = await env.readLine(`\n⚠️  Allow ${tc.name}? [y/N] `);
        return ans !== null && /^y(es)?$/i.test(ans.trim());
      },
      onUsage: (u) => { newAssistant.usage = u; },
      onDone: () => {
        env.print(`\n\n[done · ${newAssistant.usage?.totalTokens || 0} tok]\n`, 'info');
      },
      onError: (e) => { env.print(`\n✗ ${e}\n`, 'stderr'); },
      shouldAbort: () => aborted,
    });
  } finally {
    env.setBusy(false);
  }
}

function summarize(p: Record<string, any>): string {
  if (p.command) return `"${truncate(String(p.command), 60)}"`;
  if (p.path) return `path="${p.path}"`;
  if (p.url) return `url="${p.url}"`;
  if (p.query) return `query="${p.query}"`;
  const k = Object.keys(p)[0];
  if (k) return `${k}="${truncate(String(p[k]), 40)}"`;
  return '';
}
function truncate(s: string, n: number) { return s.length > n ? s.slice(0, n) + '…' : s; }
