import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { AppConfig, ChatMessage, ViewMode, ToolCall, AgentState, ApiMessage } from './types';
import { DEFAULT_CONFIG } from './utils/config';
import { runAgentLoop, chatMessagesToApiMessages } from './services/agent';
import { isNative } from './services/bridge';
import Sidebar from './components/Sidebar';
import ChatView from './components/ChatView';
import TerminalView from './components/TerminalView';
import FileExplorer from './components/FileExplorer';
import SettingsView from './components/SettingsView';
import WelcomeScreen from './components/WelcomeScreen';

const CONFIG_VERSION = 4;

function loadConfig(): AppConfig {
  try {
    const savedVersion = localStorage.getItem('qwencode_config_version');
    if (savedVersion && parseInt(savedVersion) >= CONFIG_VERSION) {
      const saved = localStorage.getItem('qwencode_config');
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
    // Reset to new defaults
    localStorage.setItem('qwencode_config_version', String(CONFIG_VERSION));
  } catch {}
  return DEFAULT_CONFIG;
}

function saveConfig(config: AppConfig) {
  try {
    localStorage.setItem('qwencode_config', JSON.stringify(config));
  } catch {}
}

function loadMessages(): ChatMessage[] {
  try {
    const saved = localStorage.getItem('qwencode_messages');
    if (saved) return JSON.parse(saved);
  } catch {}
  return [];
}

function saveMessages(messages: ChatMessage[]) {
  try {
    localStorage.setItem('qwencode_messages', JSON.stringify(messages.slice(-200)));
  } catch {}
}

export default function App() {
  const [config, setConfig] = useState<AppConfig>(loadConfig);
  const [messages, setMessages] = useState<ChatMessage[]>(loadMessages);
  const [view, setView] = useState<ViewMode>('chat');
  const [isGenerating, setIsGenerating] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [agentState, setAgentState] = useState<AgentState>({ status: 'idle', currentStep: 0, totalSteps: 0 });
  const abortRef = useRef(false);

  // Save config and messages on change
  useEffect(() => { saveConfig(config); }, [config]);
  useEffect(() => { saveMessages(messages); }, [messages]);

  const activeProvider = config.providers.find(p => p.id === config.activeProvider);
  const hasApiKey = !!activeProvider?.apiKey;

  const updateConfig = useCallback((updates: Partial<AppConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isGenerating) return;
    
    abortRef.current = false;
    
    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: Date.now(),
    };
    
    const assistantMsg: ChatMessage = {
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
    
    // Build API message history from previous messages (excluding the new streaming one)
    const previousMessages = newMessages.slice(0, -1);
    const apiHistory = chatMessagesToApiMessages(previousMessages.filter(m => 
      m.role === 'user' || m.role === 'assistant'
    ));
    
    // Accumulators for the current response
    let fullContent = '';
    let fullThinking = '';
    const toolCalls: ToolCall[] = [];
    const toolCallMap = new Map<string, ToolCall>();
    
    try {
      await runAgentLoop(config, apiHistory, content.trim(), {
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
          // Set the tool call to waiting_approval
          const existing = toolCallMap.get(tc.id);
          if (existing) {
            existing.status = 'waiting_approval';
            existing.requiresApproval = true;
          }
          setMessages(prev => [...prev]);
          
          // Wait for user approval or denial
          return new Promise<boolean>((resolve) => {
            // Store the resolve function so the UI can call it
            window.__qwenApprovalResolvers = window.__qwenApprovalResolvers || {};
            window.__qwenApprovalResolvers[tc.id] = resolve;
          });
        },
        
        onDone: (apiMessages) => {
          // Finalize the assistant message
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

  const approveToolCall = useCallback(async (msgId: string, toolCallId: string) => {
    // Find and resolve the approval promise
    const resolvers = (window as any).__qwenApprovalResolvers;
    if (resolvers && resolvers[toolCallId]) {
      resolvers[toolCallId](true);
      delete resolvers[toolCallId];
    }
    
    // Update the tool call status in the UI
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
    // Find and resolve the approval promise with false
    const resolvers = (window as any).__qwenApprovalResolvers;
    if (resolvers && resolvers[toolCallId]) {
      resolvers[toolCallId](false);
      delete resolvers[toolCallId];
    }
    
    // Update the tool call status
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
    localStorage.removeItem('qwencode_messages');
  }, []);

  const stopGeneration = useCallback(() => {
    abortRef.current = true;
    setIsGenerating(false);
    setAgentState({ status: 'idle', currentStep: 0, totalSteps: 0 });
  }, []);

  // Get status text for the agent state
  const getAgentStatusText = () => {
    switch (agentState.status) {
      case 'thinking': return 'Pensando...';
      case 'calling_tool': return `Llamando herramienta: ${agentState.currentTool || ''}`;
      case 'executing': return `Ejecutando: ${agentState.currentTool || ''}`;
      case 'waiting_approval': return 'Esperando aprobación...';
      default: return '';
    }
  };

  return (
    <div style={{
      height: '100vh',
      width: '100vw',
      display: 'flex',
      background: 'var(--bg-primary)',
      overflow: 'hidden',
      position: 'relative',
    }}>
      {/* Sidebar */}
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
      
      {/* Main Content */}
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
            <div style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: hasApiKey ? 'var(--success)' : 'var(--error)',
            }} />
            <span style={{
              fontSize: 13,
              color: 'var(--text-secondary)',
              fontWeight: 500,
            }}>
              {activeProvider?.name || 'No Provider'} • {config.activeModel.split('/').pop()}
            </span>
            {config.proxyEnabled && (
              <span style={{
                fontSize: 11,
                color: 'var(--accent-secondary)',
                background: 'rgba(107, 107, 255, 0.1)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)',
              }}>
                Proxy
              </span>
            )}
            {agentState.status !== 'idle' && isGenerating && (
              <span style={{
                fontSize: 11,
                color: 'var(--warning)',
                background: 'rgba(251, 191, 36, 0.1)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}>
                <span style={{ animation: 'pulse 1s infinite' }}>●</span>
                Paso {agentState.currentStep} — {getAgentStatusText()}
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
              Detener
            </button>
          )}
        </div>
        
        {/* View Content */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {view === 'chat' && (
            messages.length === 0 ? (
              <WelcomeScreen config={config} onSend={sendMessage} />
            ) : (
              <ChatView
                messages={messages}
                onSend={sendMessage}
                isGenerating={isGenerating}
                onApprove={approveToolCall}
                onDeny={denyToolCall}
                config={config}
                agentState={agentState}
              />
            )
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
        </div>
      </div>
    </div>
  );
}

// Extend window type for approval resolvers
declare global {
  interface Window {
    __qwenApprovalResolvers?: Record<string, (approved: boolean) => void>;
  }
}
