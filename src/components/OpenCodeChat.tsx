// ==========================================
// OpenCode Android - Chat View (TUI-style)
// ==========================================

import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { AppConfig, OpenCodeMessage, OpenCodeToolCall, AgentState } from '../types';

interface OpenCodeChatProps {
  messages: OpenCodeMessage[];
  onSend: (content: string) => void;
  isGenerating: boolean;
  onApprove: (msgId: string, toolCallId: string) => void;
  onDeny: (msgId: string, toolCallId: string) => void;
  config: AppConfig;
  agentState: AgentState;
}

export default function OpenCodeChat({ messages, onSend, isGenerating, onApprove, onDeny, config, agentState }: OpenCodeChatProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = useCallback(() => {
    if (!input.trim() || isGenerating) return;
    onSend(input.trim());
    setInput('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
  }, [input, isGenerating, onSend]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    // Auto-resize
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }, []);

  const activeProvider = config.providers.find(p => p.id === config.activeProvider);
  const modelName = config.activeModel.split('/').pop() || config.activeModel;

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg-primary)',
    }}>
      {/* Messages Area */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: 'var(--space-md)',
        paddingBottom: 0,
      }}>
        {messages.length === 0 && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            gap: 'var(--space-lg)',
            opacity: 0.7,
          }}>
            <div style={{
              fontSize: 48,
              fontFamily: 'var(--font-mono)',
              color: 'var(--accent-green)',
            }}>
              {'>'}_
            </div>
            <div style={{
              fontSize: 20,
              fontWeight: 700,
              color: 'var(--text-primary)',
            }}>
              OpenCode AI
            </div>
            <div style={{
              fontSize: 13,
              color: 'var(--text-secondary)',
              textAlign: 'center',
              maxWidth: 320,
              lineHeight: 1.6,
            }}>
              Agente de IA para programación. Escribe tu consulta o usa comandos:
              <br />
              <code style={{ color: 'var(--accent-green)' }}>/help</code> para ver comandos
              <br />
              <code style={{ color: 'var(--accent-purple)' }}>!command</code> para ejecutar shell
            </div>
            <div style={{
              padding: '8px 16px',
              background: 'rgba(126, 231, 135, 0.1)',
              border: '1px solid rgba(126, 231, 135, 0.2)',
              borderRadius: 'var(--radius-md)',
              fontSize: 12,
              color: 'var(--accent-green)',
            }}>
              Modelo activo: {modelName} {activeProvider?.isFree ? '(GRATUITO)' : ''}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} style={{ marginBottom: 'var(--space-md)' }}>
            {msg.role === 'user' ? (
              <UserMessage content={msg.content} />
            ) : (
              <AssistantMessage
                message={msg}
                onApprove={onApprove}
                onDeny={onDeny}
              />
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div style={{
        padding: 'var(--space-sm) var(--space-md) var(--space-md)',
        borderTop: '1px solid var(--border-primary)',
        background: 'var(--bg-secondary)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 'var(--space-sm)',
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid var(--border-primary)',
          borderRadius: 'var(--radius-md)',
          padding: '8px 12px',
        }}>
          <span style={{
            color: 'var(--accent-green)',
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            fontWeight: 700,
            flexShrink: 0,
            paddingBottom: 2,
          }}>
            {'>'}_
          </span>
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={isGenerating ? 'Generando...' : 'Escribe un mensaje, /help para comandos...'}
            disabled={isGenerating}
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              lineHeight: 1.5,
              resize: 'none',
              outline: 'none',
              minHeight: 20,
              maxHeight: 120,
            }}
            rows={1}
          />
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || isGenerating}
            style={{
              background: input.trim() && !isGenerating ? 'var(--accent-green)' : 'rgba(255,255,255,0.05)',
              border: 'none',
              color: input.trim() && !isGenerating ? '#0d1117' : 'var(--text-tertiary)',
              borderRadius: 'var(--radius-sm)',
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 700,
              cursor: input.trim() && !isGenerating ? 'pointer' : 'not-allowed',
              fontFamily: 'var(--font-mono)',
            }}
          >
            SEND
          </button>
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 4,
          fontSize: 10,
          color: 'var(--text-tertiary)',
          fontFamily: 'var(--font-mono)',
        }}>
          <span>{modelName}</span>
          <span>Enter = send, Shift+Enter = newline</span>
        </div>
      </div>
    </div>
  );
}

// ---- User Message ----
function UserMessage({ content }: { content: string }) {
  return (
    <div style={{
      display: 'flex',
      gap: 'var(--space-sm)',
      fontFamily: 'var(--font-mono)',
    }}>
      <span style={{
        color: 'var(--accent-green)',
        fontWeight: 700,
        flexShrink: 0,
        fontSize: 12,
      }}>
        ▶ YOU
      </span>
      <div style={{
        color: 'var(--text-primary)',
        fontSize: 13,
        lineHeight: 1.6,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        {content}
      </div>
    </div>
  );
}

// ---- Assistant Message ----
function AssistantMessage({
  message,
  onApprove,
  onDeny,
}: {
  message: OpenCodeMessage;
  onApprove: (msgId: string, toolCallId: string) => void;
  onDeny: (msgId: string, toolCallId: string) => void;
}) {
  const [showThinking, setShowThinking] = useState(false);

  return (
    <div style={{
      fontFamily: 'var(--font-mono)',
    }}>
      <span style={{
        color: 'var(--accent-purple)',
        fontWeight: 700,
        fontSize: 12,
      }}>
        ◆ OPENCODE
      </span>

      {/* Thinking */}
      {message.thinking && (
        <div style={{ marginTop: 4 }}>
          <button
            onClick={() => setShowThinking(!showThinking)}
            style={{
              background: 'rgba(188, 140, 255, 0.1)',
              border: '1px solid rgba(188, 140, 255, 0.2)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--accent-purple)',
              padding: '2px 8px',
              fontSize: 11,
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {showThinking ? '▼' : '▶'} Razonamiento
          </button>
          {showThinking && (
            <div style={{
              marginTop: 4,
              padding: '8px 12px',
              background: 'rgba(188, 140, 255, 0.05)',
              border: '1px solid rgba(188, 140, 255, 0.1)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-secondary)',
              fontSize: 12,
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              maxHeight: 200,
              overflow: 'auto',
            }}>
              {message.thinking}
            </div>
          )}
        </div>
      )}

      {/* Content */}
      {message.content && (
        <div style={{
          marginTop: 4,
          color: 'var(--text-primary)',
          fontSize: 13,
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}>
          {renderContent(message.content)}
        </div>
      )}

      {/* Streaming indicator */}
      {message.isStreaming && !message.content && !message.toolCalls?.length && (
        <span style={{ animation: 'pulse 1s infinite', color: 'var(--accent-purple)' }}>●</span>
      )}

      {/* Tool Calls */}
      {message.toolCalls?.map((tc) => (
        <ToolCallCard
          key={tc.id}
          toolCall={tc}
          msgId={message.id}
          onApprove={onApprove}
          onDeny={onDeny}
        />
      ))}
    </div>
  );
}

// ---- Tool Call Card ----
function ToolCallCard({
  toolCall,
  msgId,
  onApprove,
  onDeny,
}: {
  toolCall: OpenCodeToolCall;
  msgId: string;
  onApprove: (msgId: string, toolCallId: string) => void;
  onDeny: (msgId: string, toolCallId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const statusIcon = {
    pending: '⏳',
    running: '⚙️',
    completed: '✅',
    error: '❌',
    waiting_approval: '🔒',
  }[toolCall.status] || '•';

  const toolIcon: Record<string, string> = {
    shell: '💻',
    file_read: '📖',
    file_write: '✏️',
    file_edit: '🔧',
    list_dir: '📁',
    glob: '🔍',
    grep: '🔎',
    web_fetch: '🌐',
    mkdir: '📂',
    rm: '🗑️',
    mv: '📦',
    cp: '📋',
  };

  return (
    <div style={{
      marginTop: 6,
      border: '1px solid var(--border-primary)',
      borderRadius: 'var(--radius-sm)',
      overflow: 'hidden',
      background: 'rgba(255, 255, 255, 0.02)',
    }}>
      {/* Header */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 10px',
          cursor: 'pointer',
          background: toolCall.status === 'running' ? 'rgba(126, 231, 135, 0.05)' :
            toolCall.status === 'error' ? 'rgba(255, 107, 107, 0.05)' : 'transparent',
        }}
      >
        <span style={{ fontSize: 12 }}>{statusIcon}</span>
        <span style={{ fontSize: 12 }}>{toolIcon[toolCall.name] || '🔧'}</span>
        <span style={{
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--accent-green)',
          fontFamily: 'var(--font-mono)',
        }}>
          {toolCall.name}
        </span>
        <span style={{
          fontSize: 11,
          color: 'var(--text-tertiary)',
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {toolCall.name === 'shell' ? (toolCall.params.command as string || '') :
           toolCall.name === 'file_read' || toolCall.name === 'file_write' ? (toolCall.params.path as string || '') :
           toolCall.name === 'file_edit' ? (toolCall.params.path as string || '') :
           JSON.stringify(toolCall.params).substring(0, 80)}
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
          {expanded ? '▼' : '▶'}
        </span>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div style={{
          padding: '8px 10px',
          borderTop: '1px solid var(--border-primary)',
          fontSize: 11,
          lineHeight: 1.5,
        }}>
          <div style={{ color: 'var(--text-tertiary)', marginBottom: 4 }}>Parameters:</div>
          <pre style={{
            color: 'var(--text-secondary)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            margin: 0,
            fontFamily: 'var(--font-mono)',
          }}>
            {JSON.stringify(toolCall.params, null, 2)}
          </pre>

          {toolCall.output && (
            <>
              <div style={{ color: 'var(--text-tertiary)', marginTop: 8, marginBottom: 4 }}>Output:</div>
              <pre style={{
                color: toolCall.status === 'error' ? 'var(--error)' : 'var(--accent-green)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                margin: 0,
                maxHeight: 200,
                overflow: 'auto',
                fontFamily: 'var(--font-mono)',
              }}>
                {toolCall.output.substring(0, 2000)}
              </pre>
            </>
          )}
        </div>
      )}

      {/* Approval Buttons */}
      {toolCall.status === 'waiting_approval' && (
        <div style={{
          display: 'flex',
          gap: 'var(--space-sm)',
          padding: '6px 10px',
          borderTop: '1px solid var(--border-primary)',
        }}>
          <button
            onClick={() => onApprove(msgId, toolCall.id)}
            style={{
              flex: 1,
              padding: '6px',
              background: 'rgba(126, 231, 135, 0.15)',
              border: '1px solid rgba(126, 231, 135, 0.3)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--accent-green)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
            }}
          >
            ✓ Aprobar
          </button>
          <button
            onClick={() => onDeny(msgId, toolCall.id)}
            style={{
              flex: 1,
              padding: '6px',
              background: 'rgba(255, 107, 107, 0.15)',
              border: '1px solid rgba(255, 107, 107, 0.3)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--error)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
            }}
          >
            ✗ Denegar
          </button>
        </div>
      )}
    </div>
  );
}

// ---- Render content with basic code block support ----
function renderContent(content: string) {
  const parts = content.split(/(```[\s\S]*?```)/g);
  return parts.map((part, i) => {
    if (part.startsWith('```') && part.endsWith('```')) {
      const lines = part.slice(3, -3).split('\n');
      const lang = lines[0]?.trim() || '';
      const code = lang ? lines.slice(1).join('\n') : lines.join('\n');
      return (
        <pre key={i} style={{
          background: 'rgba(0, 0, 0, 0.3)',
          border: '1px solid var(--border-primary)',
          borderRadius: 'var(--radius-sm)',
          padding: '8px 12px',
          overflow: 'auto',
          margin: '8px 0',
          fontSize: 12,
          lineHeight: 1.5,
          fontFamily: 'var(--font-mono)',
          color: 'var(--accent-green)',
        }}>
          {lang && <div style={{ color: 'var(--text-tertiary)', fontSize: 10, marginBottom: 4 }}>{lang}</div>}
          {code}
        </pre>
      );
    }
    // Inline code
    const inlineParts = part.split(/(`[^`]+`)/g);
    return inlineParts.map((ip, j) => {
      if (ip.startsWith('`') && ip.endsWith('`')) {
        return <code key={`${i}-${j}`} style={{
          background: 'rgba(0, 0, 0, 0.3)',
          padding: '1px 4px',
          borderRadius: 2,
          fontSize: 12,
          color: 'var(--accent-green)',
        }}>{ip.slice(1, -1)}</code>;
      }
      return <span key={`${i}-${j}`}>{ip}</span>;
    });
  });
}
