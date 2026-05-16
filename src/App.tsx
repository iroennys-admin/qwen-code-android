import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { AppConfig, ChatMessage, ViewMode, ToolCall, StreamChunk } from './types';
import { DEFAULT_CONFIG } from './utils/config';
import { streamChat } from './services/api';
import { executeToolCall, isNative } from './services/bridge';
import Sidebar from './components/Sidebar';
import ChatView from './components/ChatView';
import TerminalView from './components/TerminalView';
import FileExplorer from './components/FileExplorer';
import SettingsView from './components/SettingsView';
import WelcomeScreen from './components/WelcomeScreen';

const CONFIG_VERSION = 2;

function loadConfig(): AppConfig {
  try {
    const savedVersion = localStorage.getItem('qwencode_config_version');
    if (savedVersion && parseInt(savedVersion) >= CONFIG_VERSION) {
      const saved = localStorage.getItem('qwencode_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        const merged = { ...DEFAULT_CONFIG, ...parsed, providers: parsed.providers?.map((p: any) => ({
          ...DEFAULT_CONFIG.providers.find(dp => dp.id === p.id),
          ...p,
          models: DEFAULT_CONFIG.providers.find(dp => dp.id === p.id)?.models || p.models || []
        })) || DEFAULT_CONFIG.providers };
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
    localStorage.setItem('qwencode_messages', JSON.stringify(messages.slice(-100)));
  } catch {}
}

export default function App() {
  const [config, setConfig] = useState<AppConfig>(loadConfig);
  const [messages, setMessages] = useState<ChatMessage[]>(loadMessages);
  const [view, setView] = useState<ViewMode>('chat');
  const [isGenerating, setIsGenerating] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

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
      model: config.activeModel,
      provider: config.activeProvider,
    };
    
    const newMessages = [...messages, userMsg, assistantMsg];
    setMessages(newMessages);
    setIsGenerating(true);
    
    try {
      const chatMessages = newMessages.filter(m => m.role === 'user' || (m.role === 'assistant' && !m.isStreaming));
      let fullContent = '';
      const toolCalls: ToolCall[] = [];
      
      for await (const chunk of streamChat(config, chatMessages.slice(0, -1))) {
        if (chunk.type === 'content' && chunk.content) {
          fullContent += chunk.content;
          setMessages(prev => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last.role === 'assistant') {
              updated[updated.length - 1] = { ...last, content: fullContent };
            }
            return updated;
          });
        }
        
        if (chunk.type === 'thinking' && chunk.thinking) {
          // Show thinking indicator
        }
        
        if (chunk.type === 'tool_call' && chunk.toolCall) {
          const tc = chunk.toolCall;
          toolCalls.push(tc);
          
          // Check if tool needs approval
          if (tc.requiresApproval && config.approvalMode === 'ask') {
            tc.status = 'waiting_approval';
          } else {
            // Auto-execute
            tc.status = 'running';
            setMessages(prev => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last.role === 'assistant') {
                updated[updated.length - 1] = { ...last, toolCalls: [...toolCalls] };
              }
              return updated;
            });
            
            const result = await executeToolCall(tc.name, tc.params);
            tc.output = result.output;
            tc.status = result.error ? 'error' : 'completed';
          }
          
          setMessages(prev => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last.role === 'assistant') {
              updated[updated.length - 1] = { ...last, toolCalls: [...toolCalls] };
            }
            return updated;
          });
        }
        
        if (chunk.type === 'error' && chunk.error) {
          fullContent += `\n\n❌ **Error:** ${chunk.error}`;
          setMessages(prev => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last.role === 'assistant') {
              updated[updated.length - 1] = { ...last, content: fullContent };
            }
            return updated;
          });
        }
        
        if (chunk.type === 'done') {
          break;
        }
      }
      
      // Finalize assistant message
      setMessages(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last.role === 'assistant') {
          updated[updated.length - 1] = { ...last, isStreaming: false, content: fullContent, toolCalls: [...toolCalls] };
        }
        return updated;
      });
    } catch (err: any) {
      setMessages(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last.role === 'assistant') {
          updated[updated.length - 1] = { ...last, content: `Error: ${err.message}`, isStreaming: false };
        }
        return updated;
      });
    } finally {
      setIsGenerating(false);
    }
  }, [config, messages, isGenerating]);

  const approveToolCall = useCallback(async (msgId: string, toolCallId: string) => {
    const msg = messages.find(m => m.id === msgId);
    if (!msg?.toolCalls) return;
    
    const tc = msg.toolCalls.find(t => t.id === toolCallId);
    if (!tc) return;
    
    tc.status = 'running';
    setMessages(prev => [...prev]);
    
    const result = await executeToolCall(tc.name, tc.params);
    tc.output = result.output;
    tc.status = result.error ? 'error' : 'completed';
    setMessages(prev => [...prev]);
  }, [messages]);

  const denyToolCall = useCallback((msgId: string, toolCallId: string) => {
    const msg = messages.find(m => m.id === msgId);
    if (!msg?.toolCalls) return;
    
    const tc = msg.toolCalls.find(t => t.id === toolCallId);
    if (!tc) return;
    
    tc.status = 'error';
    tc.output = 'Denied by user';
    setMessages(prev => [...prev]);
  }, [messages]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    localStorage.removeItem('qwencode_messages');
  }, []);

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
    setIsGenerating(false);
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
                🌐 Proxy
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
              ⏹ Stop
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
