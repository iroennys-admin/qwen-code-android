import React, { useRef, useEffect, useState } from 'react';
import type { AppConfig, ChatMessage, ToolCall } from '../types';

interface ChatViewProps {
  messages: ChatMessage[];
  onSend: (msg: string) => void;
  isGenerating: boolean;
  onApprove: (msgId: string, toolCallId: string) => void;
  onDeny: (msgId: string, toolCallId: string) => void;
  config: AppConfig;
}

export default function ChatView({ messages, onSend, isGenerating, onApprove, onDeny, config }: ChatViewProps) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);
  
  const handleSubmit = () => {
    if (input.trim() && !isGenerating) {
      onSend(input.trim());
      setInput('');
    }
  };
  
  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Messages */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflow: 'auto',
          padding: 'var(--space-md)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-md)',
        }}
      >
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            onApprove={onApprove}
            onDeny={onDeny}
          />
        ))}
        
        {isGenerating && messages[messages.length - 1]?.isStreaming && (
          <div style={{ display: 'flex', gap: 4, padding: '0 var(--space-md)' }}>
            <span style={{ animation: 'typingDot 1.4s infinite', animationDelay: '0ms', color: 'var(--accent-primary)' }}>●</span>
            <span style={{ animation: 'typingDot 1.4s infinite', animationDelay: '200ms', color: 'var(--accent-primary)' }}>●</span>
            <span style={{ animation: 'typingDot 1.4s infinite', animationDelay: '400ms', color: 'var(--accent-primary)' }}>●</span>
          </div>
        )}
      </div>
      
      {/* Input Bar */}
      <div className="acrylic" style={{
        padding: 'var(--space-sm) var(--space-md)',
        borderTop: '1px solid var(--border-primary)',
        display: 'flex',
        gap: 'var(--space-sm)',
        alignItems: 'center',
      }}>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder="Escribe un mensaje o comando..."
          disabled={isGenerating}
          style={{
            flex: 1,
            padding: '12px var(--space-md)',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-primary)',
            borderRadius: 'var(--radius-lg)',
            color: 'var(--text-primary)',
            fontSize: 14,
            outline: 'none',
            fontFamily: 'var(--font-sans)',
          }}
        />
        <button
          onClick={handleSubmit}
          disabled={isGenerating || !input.trim()}
          style={{
            width: 44,
            height: 44,
            borderRadius: 'var(--radius-lg)',
            border: 'none',
            background: isGenerating || !input.trim() ? 'var(--bg-tertiary)' : 'var(--accent-primary)',
            color: isGenerating || !input.trim() ? 'var(--text-tertiary)' : 'white',
            cursor: isGenerating || !input.trim() ? 'not-allowed' : 'pointer',
            fontSize: 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all var(--transition-fast)',
          }}
        >
          ➤
        </button>
      </div>
    </div>
  );
}

function MessageBubble({ message, onApprove, onDeny }: { 
  message: ChatMessage; 
  onApprove: (msgId: string, toolCallId: string) => void;
  onDeny: (msgId: string, toolCallId: string) => void;
}) {
  const isUser = message.role === 'user';
  
  return (
    <div
      className="animate-fade-in"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start',
        maxWidth: '85%',
        alignSelf: isUser ? 'flex-end' : 'flex-start',
      }}
    >
      {/* Role Label */}
      <div style={{
        fontSize: 11,
        color: 'var(--text-tertiary)',
        marginBottom: 'var(--space-xs)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-xs)',
      }}>
        {isUser ? '👤 Tú' : `🤖 ${message.model?.split('/').pop() || 'Qwen Code'}`}
      </div>
      
      {/* Message Content */}
      <div style={{
        padding: 'var(--space-md)',
        background: isUser 
          ? 'linear-gradient(135deg, var(--accent-primary), var(--accent-tertiary))' 
          : 'var(--bg-card)',
        border: isUser ? 'none' : '1px solid var(--border-primary)',
        borderRadius: isUser 
          ? 'var(--radius-lg) var(--radius-lg) var(--radius-sm) var(--radius-lg)' 
          : 'var(--radius-lg) var(--radius-lg) var(--radius-lg) var(--radius-sm)',
        color: isUser ? 'white' : 'var(--text-primary)',
        fontSize: 14,
        lineHeight: 1.6,
        wordBreak: 'break-word',
        whiteSpace: 'pre-wrap',
      }}>
        {message.content || (message.isStreaming ? '' : '(vacío)')}
        {message.isStreaming && !message.content && (
          <span style={{ animation: 'pulse 1s infinite', color: 'var(--accent-secondary)' }}>▊</span>
        )}
      </div>
      
      {/* Tool Calls */}
      {message.toolCalls && message.toolCalls.length > 0 && (
        <div style={{
          marginTop: 'var(--space-sm)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-sm)',
          width: '100%',
        }}>
          {message.toolCalls.map((tc) => (
            <ToolCallCard
              key={tc.id}
              toolCall={tc}
              msgId={message.id}
              onApprove={onApprove}
              onDeny={onDeny}
            />
          ))}
        </div>
      )}
      
      {/* Timestamp */}
      <div style={{
        fontSize: 10,
        color: 'var(--text-tertiary)',
        marginTop: 'var(--space-xs)',
      }}>
        {new Date(message.timestamp).toLocaleTimeString()}
      </div>
    </div>
  );
}

function ToolCallCard({ toolCall, msgId, onApprove, onDeny }: {
  toolCall: ToolCall;
  msgId: string;
  onApprove: (msgId: string, toolCallId: string) => void;
  onDeny: (msgId: string, toolCallId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  
  const statusColors: Record<string, string> = {
    pending: 'var(--warning)',
    running: 'var(--info)',
    completed: 'var(--success)',
    error: 'var(--error)',
    waiting_approval: 'var(--warning)',
  };
  
  const statusLabels: Record<string, string> = {
    pending: 'Pendiente',
    running: 'Ejecutando...',
    completed: 'Completado',
    error: 'Error',
    waiting_approval: 'Requiere aprobación',
  };
  
  const toolIcons: Record<string, string> = {
    shell: '💻',
    file_read: '📖',
    file_write: '✏️',
    file_edit: '🔧',
    web_fetch: '🌐',
    glob: '🔍',
    grep: '🔎',
  };
  
  return (
    <div style={{
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border-primary)',
      borderRadius: 'var(--radius-md)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-sm)',
          padding: 'var(--space-sm) var(--space-md)',
          cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: 14 }}>{toolIcons[toolCall.type] || '🔧'}</span>
        <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>
          {toolCall.name}
        </span>
        <span style={{
          fontSize: 11,
          color: statusColors[toolCall.status],
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}>
          <span style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: statusColors[toolCall.status],
            display: 'inline-block',
          }} />
          {statusLabels[toolCall.status]}
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
          {expanded ? '▼' : '▶'}
        </span>
      </div>
      
      {/* Expanded Content */}
      {expanded && (
        <div style={{
          padding: 'var(--space-sm) var(--space-md)',
          borderTop: '1px solid var(--border-primary)',
          fontSize: 12,
        }}>
          <div style={{ color: 'var(--text-tertiary)', marginBottom: 'var(--space-xs)' }}>Parámetros:</div>
          <pre style={{
            background: 'rgba(0,0,0,0.3)',
            padding: 'var(--space-sm)',
            borderRadius: 'var(--radius-sm)',
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-secondary)',
            overflow: 'auto',
            margin: 0,
          }}>
            {JSON.stringify(toolCall.params, null, 2)}
          </pre>
          
          {toolCall.output && (
            <>
              <div style={{ color: 'var(--text-tertiary)', marginTop: 'var(--space-sm)', marginBottom: 'var(--space-xs)' }}>Salida:</div>
              <pre style={{
                background: 'rgba(0,0,0,0.3)',
                padding: 'var(--space-sm)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                color: toolCall.status === 'error' ? 'var(--error)' : 'var(--success)',
                overflow: 'auto',
                margin: 0,
                maxHeight: 200,
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
          padding: 'var(--space-sm) var(--space-md)',
          borderTop: '1px solid var(--border-primary)',
        }}>
          <button
            onClick={() => onApprove(msgId, toolCall.id)}
            style={{
              flex: 1,
              padding: '8px',
              background: 'var(--success)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              color: 'white',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            ✓ Aprobar
          </button>
          <button
            onClick={() => onDeny(msgId, toolCall.id)}
            style={{
              flex: 1,
              padding: '8px',
              background: 'var(--error)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              color: 'white',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            ✗ Denegar
          </button>
        </div>
      )}
    </div>
  );
}
