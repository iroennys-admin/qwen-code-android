import React, { useRef, useEffect, useState } from 'react';
import type { AppConfig, ChatMessage, ToolCall, ToolType, AgentState } from '../types';

interface ChatViewProps {
  messages: ChatMessage[];
  onSend: (msg: string) => void;
  isGenerating: boolean;
  onApprove: (msgId: string, toolCallId: string) => void;
  onDeny: (msgId: string, toolCallId: string) => void;
  config: AppConfig;
  agentState: AgentState;
}

export default function ChatView({ messages, onSend, isGenerating, onApprove, onDeny, config, agentState }: ChatViewProps) {
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
        
        {isGenerating && messages[messages.length - 1]?.isStreaming && !messages[messages.length - 1]?.content && (
          <div style={{ 
            display: 'flex', 
            gap: 4, 
            padding: '0 var(--space-md)',
            alignItems: 'center',
          }}>
            <span style={{ animation: 'typingDot 1.4s infinite', animationDelay: '0ms', color: 'var(--accent-primary)', fontSize: 10 }}>●</span>
            <span style={{ animation: 'typingDot 1.4s infinite', animationDelay: '200ms', color: 'var(--accent-primary)', fontSize: 10 }}>●</span>
            <span style={{ animation: 'typingDot 1.4s infinite', animationDelay: '400ms', color: 'var(--accent-primary)', fontSize: 10 }}>●</span>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)', marginLeft: 8 }}>
              {agentState.status === 'executing' ? `Ejecutando ${agentState.currentTool || ''}...` : 'Pensando...'}
            </span>
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
          placeholder="Dime qu\u00e9 hacer..."
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
  const [showThinking, setShowThinking] = useState(false);
  
  return (
    <div
      className="animate-fade-in"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start',
        maxWidth: '90%',
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
        {isUser ? 'Tu' : message.model?.split('/').pop() || 'Qwen Code'}
        {message.step && <span style={{ fontSize: 10, color: 'var(--accent-secondary)' }}>Paso {message.step}</span>}
      </div>
      
      {/* Thinking Section */}
      {message.thinking && !isUser && (
        <div style={{
          marginBottom: 'var(--space-xs)',
          width: '100%',
        }}>
          <button
            onClick={() => setShowThinking(!showThinking)}
            style={{
              background: 'rgba(107, 107, 255, 0.08)',
              border: '1px solid rgba(107, 107, 255, 0.15)',
              borderRadius: 'var(--radius-sm)',
              padding: '4px 10px',
              color: 'var(--accent-secondary)',
              fontSize: 11,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span style={{ fontSize: 12 }}>{showThinking ? '▼' : '▶'}</span>
            Razonamiento
          </button>
          {showThinking && (
            <div style={{
              marginTop: 'var(--space-xs)',
              padding: 'var(--space-sm)',
              background: 'rgba(107, 107, 255, 0.05)',
              border: '1px solid rgba(107, 107, 255, 0.1)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 12,
              color: 'var(--text-tertiary)',
              lineHeight: 1.5,
              fontFamily: 'var(--font-mono)',
              whiteSpace: 'pre-wrap',
              maxHeight: 200,
              overflow: 'auto',
            }}>
              {message.thinking}
            </div>
          )}
        </div>
      )}
      
      {/* Message Content */}
      {message.content && (
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
          <FormattedContent content={message.content} />
          {message.isStreaming && !message.content && (
            <span style={{ animation: 'pulse 1s infinite', color: 'var(--accent-secondary)' }}>|</span>
          )}
        </div>
      )}
      
      {/* Tool Calls */}
      {message.toolCalls && message.toolCalls.length > 0 && (
        <div style={{
          marginTop: 'var(--space-sm)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-sm)',
          width: '100%',
        }}>
          {message.toolCalls.map((tc, i) => (
            <ToolCallCard
              key={tc.id}
              toolCall={tc}
              msgId={message.id}
              stepNumber={i + 1}
              totalSteps={message.toolCalls!.length}
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

/** Render message content with basic markdown-like formatting */
function FormattedContent({ content }: { content: string }) {
  // Split into code blocks and text
  const parts = content.split(/(```[\s\S]*?```)/g);
  
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          // Code block
          const lines = part.slice(3, -3);
          const firstNewline = lines.indexOf('\n');
          const language = firstNewline > -1 ? lines.slice(0, firstNewline).trim() : '';
          const code = firstNewline > -1 ? lines.slice(firstNewline + 1) : lines;
          
          return (
            <pre key={i} style={{
              background: 'rgba(0, 0, 0, 0.4)',
              border: '1px solid var(--border-primary)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-sm) var(--space-md)',
              margin: 'var(--space-sm) 0',
              fontSize: 12,
              fontFamily: 'var(--font-mono)',
              lineHeight: 1.5,
              overflow: 'auto',
              color: 'var(--text-secondary)',
            }}>
              {language && (
                <div style={{ 
                  fontSize: 10, 
                  color: 'var(--accent-secondary)', 
                  marginBottom: 4,
                  fontFamily: 'var(--font-sans)',
                }}>
                  {language}
                </div>
              )}
              {code}
            </pre>
          );
        }
        
        // Regular text with basic formatting
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

const TOOL_ICONS: Record<string, string> = {
  shell: '\uD83D\uDCBB',
  file_read: '\uD83D\uDCD6',
  file_write: '\u270F\uFE0F',
  file_edit: '\uD83D\uDD27',
  web_fetch: '\uD83C\uDF10',
  glob: '\uD83D\uDD0D',
  grep: '\uD83D\uDD0E',
  code_execute: '\u26A1',
  mkdir: '\uD83D\uDCC1',
  rm: '\uD83D\uDDD1\uFE0F',
  mv: '\uD83D\uDCE6',
  cp: '\uD83D\uDCCB',
  list_dir: '\uD83D\uDCC2',
};

const TOOL_LABELS: Record<string, string> = {
  shell: 'Shell',
  file_read: 'Leer archivo',
  file_write: 'Escribir archivo',
  file_edit: 'Editar archivo',
  web_fetch: 'Obtener web',
  glob: 'Buscar archivos',
  grep: 'Buscar texto',
  code_execute: 'Ejecutar codigo',
  mkdir: 'Crear directorio',
  rm: 'Eliminar',
  mv: 'Mover',
  cp: 'Copiar',
  list_dir: 'Listar directorio',
};

function ToolCallCard({ toolCall, msgId, stepNumber, totalSteps, onApprove, onDeny }: {
  toolCall: ToolCall;
  msgId: string;
  stepNumber: number;
  totalSteps: number;
  onApprove: (msgId: string, toolCallId: string) => void;
  onDeny: (msgId: string, toolCallId: string) => void;
}) {
  const [expanded, setExpanded] = useState(toolCall.status === 'waiting_approval');
  
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
    waiting_approval: 'Requiere aprobacion',
  };
  
  const isCodeExecute = toolCall.name === 'code_execute';
  const isShell = toolCall.name === 'shell';
  
  // Get the main display content
  const getDisplayContent = () => {
    if (isCodeExecute && toolCall.params.code) {
      return toolCall.params.code as string;
    }
    if (isShell && toolCall.params.command) {
      return toolCall.params.command as string;
    }
    if (toolCall.name === 'file_read' && toolCall.params.path) {
      return toolCall.params.path as string;
    }
    if (toolCall.name === 'file_write' && toolCall.params.path) {
      return toolCall.params.path as string;
    }
    if (toolCall.name === 'file_edit' && toolCall.params.path) {
      return toolCall.params.path as string;
    }
    return JSON.stringify(toolCall.params, null, 2);
  };
  
  return (
    <div style={{
      background: 'var(--bg-secondary)',
      border: `1px solid ${toolCall.status === 'running' ? 'var(--info)' : toolCall.status === 'error' ? 'var(--error)' : 'var(--border-primary)'}`,
      borderRadius: 'var(--radius-md)',
      overflow: 'hidden',
      boxShadow: toolCall.status === 'running' ? '0 0 8px rgba(96, 165, 250, 0.2)' : 'none',
    }}>
      {/* Header */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-sm)',
          padding: '8px var(--space-md)',
          cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: 14 }}>{TOOL_ICONS[toolCall.type] || '\uD83D\uDD27'}</span>
        <span style={{ fontSize: 12, fontWeight: 600, flex: 1, color: 'var(--text-primary)' }}>
          {TOOL_LABELS[toolCall.name] || toolCall.name}
          {totalSteps > 1 && <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}> ({stepNumber}/{totalSteps})</span>}
        </span>
        <span style={{
          fontSize: 11,
          color: statusColors[toolCall.status],
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}>
          {toolCall.status === 'running' && (
            <span style={{ animation: 'pulse 1s infinite' }}>●</span>
          )}
          {toolCall.status !== 'running' && (
            <span style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: statusColors[toolCall.status],
              display: 'inline-block',
            }} />
          )}
          {statusLabels[toolCall.status]}
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
          {expanded ? '▼' : '▶'}
        </span>
      </div>
      
      {/* Command/Code Preview */}
      <div style={{
        padding: '0 var(--space-md) 8px',
        fontSize: 11,
        fontFamily: 'var(--font-mono)',
        color: 'var(--text-secondary)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        maxWidth: '100%',
      }}>
        {getDisplayContent().split('\n')[0].substring(0, 100)}
        {getDisplayContent().split('\n')[0].length > 100 ? '...' : ''}
      </div>
      
      {/* Expanded Content */}
      {expanded && (
        <div style={{
          padding: 'var(--space-sm) var(--space-md)',
          borderTop: '1px solid var(--border-primary)',
          fontSize: 12,
        }}>
          {/* Parameters */}
          {isCodeExecute && toolCall.params.code ? (
            <div>
              <div style={{ color: 'var(--text-tertiary)', marginBottom: 'var(--space-xs)', fontSize: 11 }}>
                Codigo {(toolCall.params.language as string || 'python').toUpperCase()}:
              </div>
              <pre style={{
                background: 'rgba(0,0,0,0.4)',
                padding: 'var(--space-sm)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                color: '#4ade80',
                overflow: 'auto',
                margin: 0,
                maxHeight: 200,
                whiteSpace: 'pre-wrap',
                border: '1px solid rgba(74, 222, 128, 0.15)',
              }}>
                {toolCall.params.code as string}
              </pre>
            </div>
          ) : isShell && toolCall.params.command ? (
            <div>
              <div style={{ color: 'var(--text-tertiary)', marginBottom: 'var(--space-xs)', fontSize: 11 }}>Comando:</div>
              <pre style={{
                background: 'rgba(0,0,0,0.4)',
                padding: 'var(--space-sm)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                color: '#60a5fa',
                overflow: 'auto',
                margin: 0,
                maxHeight: 100,
                whiteSpace: 'pre-wrap',
                border: '1px solid rgba(96, 165, 250, 0.15)',
              }}>
                $ {toolCall.params.command as string}
              </pre>
            </div>
          ) : (
            <div>
              <div style={{ color: 'var(--text-tertiary)', marginBottom: 'var(--space-xs)', fontSize: 11 }}>Parametros:</div>
              <pre style={{
                background: 'rgba(0,0,0,0.3)',
                padding: 'var(--space-sm)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-secondary)',
                overflow: 'auto',
                margin: 0,
                whiteSpace: 'pre-wrap',
              }}>
                {JSON.stringify(toolCall.params, null, 2)}
              </pre>
            </div>
          )}
          
          {/* Output */}
          {toolCall.output && (
            <>
              <div style={{ 
                color: toolCall.status === 'error' ? 'var(--error)' : 'var(--text-tertiary)', 
                marginTop: 'var(--space-sm)', 
                marginBottom: 'var(--space-xs)',
                fontSize: 11,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}>
                {toolCall.status === 'error' ? '✗ Error' : '✓ Salida'}:
              </div>
              <pre style={{
                background: 'rgba(0,0,0,0.4)',
                padding: 'var(--space-sm)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                color: toolCall.status === 'error' ? 'var(--error)' : 'var(--success)',
                overflow: 'auto',
                margin: 0,
                maxHeight: 250,
                whiteSpace: 'pre-wrap',
                border: toolCall.status === 'error' 
                  ? '1px solid rgba(248, 113, 113, 0.15)' 
                  : '1px solid rgba(74, 222, 128, 0.15)',
              }}>
                {toolCall.output.substring(0, 5000)}
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
          background: 'rgba(251, 191, 36, 0.05)',
        }}>
          <button
            onClick={() => onApprove(msgId, toolCall.id)}
            style={{
              flex: 1,
              padding: '10px',
              background: 'var(--success)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              color: 'white',
              fontSize: 13,
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
              padding: '10px',
              background: 'var(--error)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              color: 'white',
              fontSize: 13,
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
