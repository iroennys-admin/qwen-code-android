// ==========================================
// OpenCode Android - Main App
// ==========================================

import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { AppConfig, OpenCodeMessage, ViewMode, OpenCodeToolCall, AgentState, ApiMessage } from './types';
import { DEFAULT_CONFIG } from './utils/config';
import { runAgentLoop, chatMessagesToApiMessages } from './services/agent';
import { isNative } from './services/bridge';
import Sidebar from './components/Sidebar';
import OpenCodeChat from './components/OpenCodeChat';
import TerminalView from './components/TerminalView';
import FileExplorer from './components/FileExplorer';
import SettingsView from './components/SettingsView';

const CONFIG_VERSION = 8;

function loadConfig(): AppConfig {
  try {
    const savedVersion = localStorage.getItem('opencode_config_version');
    if (savedVersion && parseInt(savedVersion) >= CONFIG_VERSION) {
      const saved = localStorage.getItem('opencode_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        const merged = {
          ...DEFAULT_CONFIG,
          ...parsed,
          providers: parsed.providers?.map((p: any) => ({
            ...DEFAULT_CONFIG.providers.find(dp => dp.id === p.id),
            ...p,
            models: DEFAULT_CONFIG.providers.find(dp => dp.id === p.id)?.models || p.models || []
          })) || DEFAULT_CONFIG.providers
        };
        return merged;
      }
    }
    localStorage.setItem('opencode_config_version', String(CONFIG_VERSION));
  } catch {}
  return DEFAULT_CONFIG;
}

function saveConfig(config: AppConfig) {
  try {
    localStorage.setItem('opencode_config', JSON.stringify(config));
  } catch {}
}

function loadMessages(): OpenCodeMessage[] {
  try {
    const saved = localStorage.getItem('opencode_messages');
    if (saved) return JSON.parse(saved);
  } catch {}
  return [];
}

function saveMessages(messages: OpenCodeMessage[]) {
  try {
    localStorage.setItem('opencode_messages', JSON.stringify(messages.slice(-200)));
  } catch {}
}

export default function App() {
  const [config, setConfig] = useState<AppConfig>(loadConfig);
  const [messages, setMessages] = useState<OpenCodeMessage[]>(loadMessages);
  const [view, setView] = useState<ViewMode>('chat');
  const [isGenerating, setIsGenerating] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [agentState, setAgentState] = useState<AgentState>({ status: 'idle', currentStep: 0, totalSteps: 0 });
  const abortRef = useRef(false);

  useEffect(() => { saveConfig(config); }, [config]);
  useEffect(() => { saveMessages(messages); }, [messages]);

  const activeProvider = config.providers.find(p => p.id === config.activeProvider);
  const hasApiKey = activeProvider?.id === 'opencode' || !!activeProvider?.apiKey;

  const updateConfig = useCallback((updates: Partial<AppConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isGenerating) return;

    // Handle slash commands
    const trimmed = content.trim();
    if (trimmed.startsWith('/')) {
      handleSlashCommand(trimmed);
      return;
    }

    abortRef.current = false;

    const userMsg: OpenCodeMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: Date.now(),
    };

    const assistantMsg: OpenCodeMessage = {
      id: `msg_${Date.now() + 1}`,
      role: 'assistant',
      content: '',
      timestamp: Date.now() + 1,
      isStreaming: true,
      toolCalls: [],
      thinking: '',
      model: config.activeModel,
      provider: config.activeProvider,
    };

    const newMessages = [...messages, userMsg, assistantMsg];
    setMessages(newMessages);
    setIsGenerating(true);

    const previousMessages = newMessages.slice(0, -1);
    const apiHistory = chatMessagesToApiMessages(previousMessages.filter(m =>
      m.role === 'user' || m.role === 'assistant'
    ));

    let fullContent = '';
    let fullThinking = '';
    const toolCalls: OpenCodeToolCall[] = [];
    const toolCallMap = new Map<string, OpenCodeToolCall>();

    try {
      await runAgentLoop(config, apiHistory, trimmed, {
        onStateChange: (state) => {
          setAgentState(state);
        },

        onContent: (text) => {
          fullContent += text;
          setMessages(prev => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last.role === 'assistant') {
              updated[updated.length - 1] = { ...last, content: fullContent };
            }
            return updated;
          });
        },

        onThinking: (text) => {
          fullThinking += text;
          setMessages(prev => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last.role === 'assistant') {
              updated[updated.length - 1] = { ...last, thinking: fullThinking };
            }
            return updated;
          });
        },

        onToolCall: (tc) => {
          toolCalls.push(tc);
          toolCallMap.set(tc.id, tc);
          setMessages(prev => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last.role === 'assistant') {
              updated[updated.length - 1] = { ...last, toolCalls: [...toolCalls] };
            }
            return updated;
          });
        },

        onToolStart: (toolCallId) => {
          const tc = toolCallMap.get(toolCallId);
          if (tc) {
            tc.status = 'running';
            setMessages(prev => [...prev]);
          }
        },

        onToolResult: (toolCallId, output, error) => {
          const tc = toolCallMap.get(toolCallId);
          if (tc) {
            tc.output = output;
            tc.status = error ? 'error' : 'completed';
            setMessages(prev => [...prev]);
          }
        },

        onToolApproval: async (tc) => {
          const existing = toolCallMap.get(tc.id);
          if (existing) {
            existing.status = 'waiting_approval';
            existing.requiresApproval = true;
          }
          setMessages(prev => [...prev]);

          return new Promise<boolean>((resolve) => {
            (window as any).__openCodeApprovalResolvers = (window as any).__openCodeApprovalResolvers || {};
            (window as any).__openCodeApprovalResolvers[tc.id] = resolve;
          });
        },

        onDone: () => {
          setMessages(prev => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last.role === 'assistant') {
              updated[updated.length - 1] = {
                ...last,
                isStreaming: false,
                content: fullContent,
                toolCalls: [...toolCalls],
                thinking: fullThinking || undefined,
              };
            }
            return updated;
          });
        },

        onError: (error) => {
          fullContent += `\n\n**Error:** ${error}`;
          setMessages(prev => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last.role === 'assistant') {
              updated[updated.length - 1] = { ...last, content: fullContent, isStreaming: false };
            }
            return updated;
          });
        },

        shouldAbort: () => abortRef.current,
      });

    } catch (err: any) {
      setMessages(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last.role === 'assistant') {
          updated[updated.length - 1] = {
            ...last,
            content: fullContent || `Error: ${err.message}`,
            isStreaming: false,
            toolCalls: [...toolCalls],
          };
        }
        return updated;
      });
    } finally {
      setIsGenerating(false);
      setAgentState({ status: 'idle', currentStep: 0, totalSteps: 0 });
    }
  }, [config, messages, isGenerating]);

  const handleSlashCommand = (command: string) => {
    const cmd = command.toLowerCase().split(' ')[0];
    switch (cmd) {
      case '/compact': {
        // Summarize conversation
        const lastMsg = messages[messages.length - 1];
        const summaryMsg: OpenCodeMessage = {
          id: `msg_${Date.now()}`,
          role: 'assistant',
          content: `*Conversation compacted. ${messages.length} messages summarized.*`,
          timestamp: Date.now(),
        };
        setMessages([summaryMsg]);
        break;
      }
      case '/models': {
        const provider = config.providers.find(p => p.id === config.activeProvider);
        const modelList = provider?.models.map(m => `  ${m.id} - ${m.name}`).join('\n') || 'No models available';
        const msg: OpenCodeMessage = {
          id: `msg_${Date.now()}`,
          role: 'assistant',
          content: `**Available Models** (${provider?.name || 'Unknown'}):\n\`\`\`\n${modelList}\n\`\`\`\nCurrent: \`${config.activeModel}\``,
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, {
          id: `msg_${Date.now() - 1}`,
          role: 'user',
          content: command,
          timestamp: Date.now() - 1,
        }, msg]);
        break;
      }
      case '/help': {
        const helpMsg: OpenCodeMessage = {
          id: `msg_${Date.now()}`,
          role: 'assistant',
          content: `**OpenCode Commands:**\n\n` +
            `• \`/compact\` — Compact conversation to reduce context\n` +
            `• \`/models\` — Show available models\n` +
            `• \`/help\` — Show this help\n\n` +
            `**Special Input:**\n` +
            `• \`!command\` — Execute a shell command directly\n` +
            `• \`@filename\` — Reference a file\n\n` +
            `**Current Model:** \`${config.activeModel}\`\n` +
            `**Provider:** ${activeProvider?.name || 'None'}`,
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, {
          id: `msg_${Date.now() - 1}`,
          role: 'user',
          content: command,
          timestamp: Date.now() - 1,
        }, helpMsg]);
        break;
      }
      default: {
        // Treat unknown commands as regular messages (pass to AI)
        sendMessage(command);
      }
    }
  };

  const approveToolCall = useCallback(async (msgId: string, toolCallId: string) => {
    const resolvers = (window as any).__openCodeApprovalResolvers;
    if (resolvers && resolvers[toolCallId]) {
      resolvers[toolCallId](true);
      delete resolvers[toolCallId];
    }

    setMessages(prev => {
      const updated = prev.map(m => {
        if (m.id === msgId && m.toolCalls) {
          return {
            ...m,
            toolCalls: m.toolCalls.map(tc =>
              tc.id === toolCallId ? { ...tc, status: 'running' as const } : tc
            ),
          };
        }
        return m;
      });
      return updated;
    });
  }, []);

  const denyToolCall = useCallback((msgId: string, toolCallId: string) => {
    const resolvers = (window as any).__openCodeApprovalResolvers;
    if (resolvers && resolvers[toolCallId]) {
      resolvers[toolCallId](false);
      delete resolvers[toolCallId];
    }

    setMessages(prev => {
      const updated = prev.map(m => {
        if (m.id === msgId && m.toolCalls) {
          return {
            ...m,
            toolCalls: m.toolCalls.map(tc =>
              tc.id === toolCallId ? { ...tc, status: 'error' as const, output: 'Denied by user' } : tc
            ),
          };
        }
        return m;
      });
      return updated;
    });
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    localStorage.removeItem('opencode_messages');
  }, []);

  const stopGeneration = useCallback(() => {
    abortRef.current = true;
    setIsGenerating(false);
    setAgentState({ status: 'idle', currentStep: 0, totalSteps: 0 });
  }, []);

  return (
    <div style={{
      height: '100vh',
      width: '100vw',
      display: 'flex',
      background: 'var(--bg-primary)',
      overflow: 'hidden',
      position: 'relative',
    }}>
      <Sidebar
        config={config}
        updateConfig={updateConfig}
        view={view}
        setView={setView}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onClear={clearMessages}
        messageCount={messages.length}
      />

      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}>
        {/* Top Bar */}
        <div className="acrylic" style={{
          height: 48,
          display: 'flex',
          alignItems: 'center',
          padding: '0 var(--space-md)',
          gap: 'var(--space-sm)',
          borderBottom: '1px solid var(--border-primary)',
          zIndex: 100,
        }}>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: 'var(--space-sm)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 20,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            ☰
          </button>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-sm)',
            flex: 1,
          }}>
            <span style={{
              color: 'var(--accent-green)',
              fontFamily: 'var(--font-mono)',
              fontSize: 14,
              fontWeight: 700,
            }}>
              {'>'}_
            </span>
            <span style={{
              fontSize: 13,
              color: 'var(--text-primary)',
              fontWeight: 600,
            }}>
              OpenCode
            </span>
            <span style={{
              fontSize: 11,
              color: 'var(--text-tertiary)',
            }}>
              {config.activeModel.split('/').pop()}
            </span>
            <div style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: hasApiKey ? 'var(--accent-green)' : 'var(--error)',
            }} />
            {agentState.status !== 'idle' && isGenerating && (
              <span style={{
                fontSize: 11,
                color: 'var(--accent-purple)',
                background: 'rgba(188, 140, 255, 0.1)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}>
                <span style={{ animation: 'pulse 1s infinite' }}>●</span>
                Step {agentState.currentStep}
                {agentState.currentTool ? ` — ${agentState.currentTool}` : ''}
              </span>
            )}
          </div>

          {isGenerating && (
            <button
              onClick={stopGeneration}
              style={{
                background: 'var(--error)',
                border: 'none',
                color: 'white',
                padding: '4px 12px',
                borderRadius: 'var(--radius-sm)',
                fontSize: 12,
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Stop
            </button>
          )}

          <button
            onClick={() => setView('settings')}
            style={{
              background: 'none',
              border: 'none',
              color: view === 'settings' ? 'var(--accent-green)' : 'var(--text-tertiary)',
              cursor: 'pointer',
              fontSize: 18,
              padding: 'var(--space-sm)',
            }}
          >
            ⚙
          </button>
        </div>

        {/* View Content */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {(view === 'chat') && (
            <OpenCodeChat
              messages={messages}
              onSend={sendMessage}
              isGenerating={isGenerating}
              onApprove={approveToolCall}
              onDeny={denyToolCall}
              config={config}
              agentState={agentState}
            />
          )}
          {view === 'terminal' && (
            <TerminalView config={config} />
          )}
          {view === 'files' && (
            <FileExplorer config={config} />
          )}
          {view === 'settings' && (
            <SettingsView config={config} updateConfig={updateConfig} />
          )}
          {view === 'opencode-setup' && (
            <SettingsView config={config} updateConfig={updateConfig} initialTab="opencode" />
          )}
        </div>
      </div>
    </div>
  );
}

declare global {
  interface Window {
    __openCodeApprovalResolvers?: Record<string, (approved: boolean) => void>;
  }
}
