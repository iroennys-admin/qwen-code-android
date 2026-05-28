// ==========================================
// OpenCode v2 - Main App
// ==========================================

import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { AppConfig, OpenCodeMessage, ViewMode, OpenCodeToolCall, AgentState, Provider } from './types';
import { DEFAULT_CONFIG, CONFIG_VERSION } from './utils/config';
import { runAgentLoop, chatMessagesToApiMessages } from './services/agent';
import { vibrate } from './services/bridge';

import ChatView from './components/ChatView';
import SettingsView from './components/SettingsView';
import TerminalView from './components/TerminalView';
import FileExplorer from './components/FileExplorer';
import AboutView from './components/AboutView';

// ---------- Persistence ----------
function loadConfig(): AppConfig {
  try {
    const v = localStorage.getItem('oc_config_version');
    if (v && parseInt(v, 10) >= CONFIG_VERSION) {
      const raw = localStorage.getItem('oc_config');
      if (raw) {
        const parsed = JSON.parse(raw);
        // Re-merge providers with current defaults so new ones appear
        const providers: Provider[] = DEFAULT_CONFIG.providers.map(dp => {
          const existing = parsed.providers?.find((p: any) => p.id === dp.id);
          return existing
            ? { ...dp, apiKey: existing.apiKey || '', baseUrl: existing.baseUrl || dp.baseUrl, proxyBaseUrl: existing.proxyBaseUrl ?? dp.proxyBaseUrl }
            : dp;
        });
        return { ...DEFAULT_CONFIG, ...parsed, providers };
      }
    }
    localStorage.setItem('oc_config_version', String(CONFIG_VERSION));
  } catch {}
  return DEFAULT_CONFIG;
}

function saveConfig(c: AppConfig) {
  try { localStorage.setItem('oc_config', JSON.stringify(c)); } catch {}
}

function loadMessages(): OpenCodeMessage[] {
  try {
    const raw = localStorage.getItem('oc_messages');
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveMessages(m: OpenCodeMessage[]) {
  try { localStorage.setItem('oc_messages', JSON.stringify(m.slice(-200))); } catch {}
}

// ---------- App ----------
export default function App() {
  const [config, setConfig] = useState<AppConfig>(loadConfig);
  const [messages, setMessages] = useState<OpenCodeMessage[]>(loadMessages);
  const [view, setView] = useState<ViewMode>('chat');
  const [isGenerating, setIsGenerating] = useState(false);
  const [agentState, setAgentState] = useState<AgentState>({ status: 'idle', currentStep: 0, totalSteps: 0 });
  const [pendingApproval, setPendingApproval] = useState<OpenCodeToolCall | null>(null);
  const abortRef = useRef(false);
  const approvalRef = useRef<((ok: boolean) => void) | null>(null);

  useEffect(() => { saveConfig(config); }, [config]);
  useEffect(() => { saveMessages(messages); }, [messages]);
  useEffect(() => { document.documentElement.setAttribute('data-theme', config.theme); }, [config.theme]);
  useEffect(() => { document.documentElement.style.setProperty('--ui-font-size', `${config.fontSize}px`); document.body.style.fontSize = `${config.fontSize}px`; }, [config.fontSize]);

  const updateConfig = useCallback((upd: Partial<AppConfig>) => setConfig(p => ({ ...p, ...upd })), []);
  const updateProvider = useCallback((id: string, p: Partial<Provider>) => {
    setConfig(prev => ({ ...prev, providers: prev.providers.map(x => x.id === id ? { ...x, ...p } : x) }));
  }, []);

  const activeProvider = config.providers.find(p => p.id === config.activeProvider);
  const hasApiKey = !!activeProvider?.apiKey;

  const handleApprove = (id: string, ok: boolean) => {
    setPendingApproval(null);
    approvalRef.current?.(ok);
    approvalRef.current = null;
  };

  const send = useCallback(async (content: string) => {
    if (!content.trim() || isGenerating) return;
    if (!hasApiKey && activeProvider?.id !== 'opencode') {
      alert(`Configura tu API key de ${activeProvider?.name} en Ajustes (⚙️).`);
      setView('settings');
      return;
    }

    abortRef.current = false;

    // Handle slash commands locally
    const trimmed = content.trim();
    if (trimmed === '/clear') { setMessages([]); return; }
    if (trimmed === '/help') {
      setMessages(prev => [...prev, makeUser(content), makeAssistant(
        `**Comandos:**\n- /clear — limpia el chat\n- /help — ayuda\n- /model — cambia modelo (abre ajustes)\n\n**Herramientas:**\nshell, file_read/write/edit/append, list_dir, glob, grep, web_fetch, web_search, mkdir, rm, mv, cp, todo_*, memory_*, clipboard_*, notify, device_info`,
        config,
      )]);
      return;
    }
    if (trimmed === '/model') { setView('settings'); return; }

    const userMsg = makeUser(content);
    const asstMsg = makeAssistant('', config);
    asstMsg.isStreaming = true;

    const next = [...messages, userMsg, asstMsg];
    setMessages(next);
    setIsGenerating(true);

    const history = chatMessagesToApiMessages(next.slice(0, -2));
    let fullText = '';
    let fullThinking = '';
    const toolMap = new Map<string, OpenCodeToolCall>();

    try {
      await runAgentLoop(config, history, trimmed, {
        onStateChange: setAgentState,
        onContent: (t) => {
          fullText += t;
          setMessages(prev => updateLast(prev, m => ({ ...m, content: fullText })));
        },
        onThinking: (t) => {
          fullThinking += t;
          setMessages(prev => updateLast(prev, m => ({ ...m, thinking: fullThinking })));
        },
        onToolCall: (tc) => {
          toolMap.set(tc.id, tc);
          setMessages(prev => updateLast(prev, m => ({ ...m, toolCalls: [...(m.toolCalls || []), tc] })));
        },
        onToolStart: (id) => {
          const tc = toolMap.get(id);
          if (tc) { tc.status = 'running'; setMessages(prev => [...prev]); }
        },
        onToolResult: (id, output, error) => {
          const tc = toolMap.get(id);
          if (tc) {
            tc.output = output;
            tc.status = error === 'denied' ? 'denied' : (error ? 'error' : 'completed');
            setMessages(prev => [...prev]);
          }
        },
        onToolApproval: (tc) => {
          setPendingApproval(tc);
          return new Promise<boolean>((resolve) => { approvalRef.current = resolve; });
        },
        onUsage: (u) => {
          setMessages(prev => updateLast(prev, m => ({ ...m, usage: u })));
        },
        onDone: () => {
          setMessages(prev => updateLast(prev, m => ({ ...m, isStreaming: false })));
          if (config.hapticFeedback) vibrate(20);
        },
        onError: (err) => {
          setMessages(prev => updateLast(prev, m => ({ ...m, isStreaming: false, error: err })));
          if (config.hapticFeedback) vibrate(80);
        },
        shouldAbort: () => abortRef.current,
      });
    } catch (err: any) {
      setMessages(prev => updateLast(prev, m => ({ ...m, isStreaming: false, error: err?.message || String(err) })));
    } finally {
      setIsGenerating(false);
      setAgentState({ status: 'idle', currentStep: 0, totalSteps: 0 });
    }
  }, [messages, config, isGenerating, hasApiKey, activeProvider]);

  const stop = useCallback(() => {
    abortRef.current = true;
    setIsGenerating(false);
    setAgentState({ status: 'idle', currentStep: 0, totalSteps: 0 });
    setMessages(prev => updateLast(prev, m => ({ ...m, isStreaming: false })));
  }, []);

  const clearChat = useCallback(() => {
    if (messages.length && !confirm('¿Limpiar todo el chat?')) return;
    setMessages([]);
  }, [messages.length]);

  const resetConfig = useCallback(() => {
    setConfig(DEFAULT_CONFIG);
    localStorage.removeItem('oc_config');
    localStorage.setItem('oc_config_version', String(CONFIG_VERSION));
  }, []);

  const modelChipText = activeProvider
    ? `${activeProvider.emoji || ''} ${activeProvider.models.find(m => m.id === config.activeModel)?.name || config.activeModel}`
    : 'Sin modelo';

  return (
    <div className="app" data-theme={config.theme}>
      <div className="topbar">
        <div className="brand">
          <div className="brand-icon">◆</div>
          <span>OpenCode</span>
        </div>
        <div className="spacer" />
        <button className="model-chip" onClick={() => setView('settings')} title="Cambiar modelo">
          <span className="dot" /> {modelChipText}
        </button>
      </div>

      <div className="main">
        {view === 'chat' && (
          <ChatView
            messages={messages}
            config={config}
            agentState={agentState}
            isGenerating={isGenerating}
            onSend={send}
            onStop={stop}
            onClear={clearChat}
            onApprove={handleApprove}
            pendingApproval={pendingApproval}
          />
        )}
        {view === 'terminal' && <TerminalView config={config} onConfigChange={setConfig} />}
        {view === 'files' && <FileExplorer initialPath={config.workingDir} />}
        {view === 'settings' && (
          <SettingsView config={config} onChange={updateConfig} onChangeProvider={updateProvider} onReset={resetConfig} />
        )}
        {view === 'about' && <AboutView />}
      </div>

      <nav className="bottom-nav">
        <button className={view === 'chat' ? 'active' : ''} onClick={() => setView('chat')}>
          <span className="ico">💬</span>Chat
        </button>
        <button className={view === 'terminal' ? 'active' : ''} onClick={() => setView('terminal')}>
          <span className="ico">⌨️</span>Terminal
        </button>
        <button className={view === 'files' ? 'active' : ''} onClick={() => setView('files')}>
          <span className="ico">📁</span>Archivos
        </button>
        <button className={view === 'settings' || view === 'about' ? 'active' : ''} onClick={() => setView(view === 'settings' ? 'about' : 'settings')}>
          <span className="ico">{view === 'settings' ? 'ℹ️' : '⚙️'}</span>{view === 'settings' ? 'Acerca' : 'Ajustes'}
        </button>
      </nav>
    </div>
  );
}

function makeUser(text: string): OpenCodeMessage {
  return { id: `m_${Date.now()}_u`, role: 'user', content: text, timestamp: Date.now() };
}

function makeAssistant(text: string, config: AppConfig): OpenCodeMessage {
  return {
    id: `m_${Date.now()}_a`,
    role: 'assistant',
    content: text,
    timestamp: Date.now(),
    toolCalls: [],
    thinking: '',
    model: config.activeModel,
    provider: config.activeProvider,
  };
}

function updateLast(arr: OpenCodeMessage[], fn: (m: OpenCodeMessage) => OpenCodeMessage): OpenCodeMessage[] {
  if (!arr.length) return arr;
  const copy = arr.slice();
  copy[copy.length - 1] = fn(copy[copy.length - 1]);
  return copy;
}
