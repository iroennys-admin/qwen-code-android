// ==========================================
// OpenCode v2 - Message Bubble (renders markdown-ish content)
// ==========================================

import React, { useState } from 'react';
import type { OpenCodeMessage, OpenCodeToolCall } from '../types';

interface Props {
  message: OpenCodeMessage;
  showThinking: boolean;
  isLast: boolean;
  isGenerating: boolean;
  onCopy: (text: string) => void;
}

function renderContent(text: string): React.ReactNode[] {
  // Split on fenced code blocks
  const parts: React.ReactNode[] = [];
  const re = /```(\w+)?\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > lastIndex) {
      parts.push(<span key={i++}>{renderInline(text.slice(lastIndex, m.index))}</span>);
    }
    parts.push(
      <pre key={i++}>
        <code>{m[2]}</code>
      </pre>
    );
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(<span key={i++}>{renderInline(text.slice(lastIndex))}</span>);
  }
  return parts;
}

function renderInline(text: string): React.ReactNode[] {
  // Inline code with `...`
  const out: React.ReactNode[] = [];
  const re = /`([^`\n]+)`/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > lastIndex) out.push(text.slice(lastIndex, m.index));
    out.push(<code key={`c${i++}`}>{m[1]}</code>);
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < text.length) out.push(text.slice(lastIndex));
  return out;
}

function ToolCallView({ tc }: { tc: OpenCodeToolCall }) {
  const [open, setOpen] = useState(tc.status === 'waiting_approval' || tc.status === 'error');
  const icon =
    tc.status === 'running' ? '⏳' :
    tc.status === 'completed' ? '✅' :
    tc.status === 'error' ? '❌' :
    tc.status === 'waiting_approval' ? '⚠️' :
    tc.status === 'denied' ? '🚫' : '🔧';
  return (
    <div className={`tool-call ${tc.status}`}>
      <div className="tc-head" onClick={() => setOpen(o => !o)}>
        <span>{icon}</span>
        <span className="tc-name">{tc.name}</span>
        <span className="tc-status">
          {tc.status}{tc.duration ? ` · ${(tc.duration / 1000).toFixed(1)}s` : ''}
        </span>
      </div>
      {open && (
        <>
          <div className="tc-body">{summarizeParams(tc)}</div>
          {tc.output && (
            <div className="tc-body" style={{ marginTop: 6, borderLeft: '2px solid rgba(255,255,255,0.1)', paddingLeft: 8 }}>
              {tc.output.length > 4000 ? tc.output.slice(0, 4000) + `\n\n…(${tc.output.length - 4000} chars more)` : tc.output}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function summarizeParams(tc: OpenCodeToolCall): string {
  try {
    if (tc.name === 'shell') return `$ ${tc.params.command}`;
    if (tc.name === 'file_read') return `read ${tc.params.path}`;
    if (tc.name === 'file_write') return `write ${tc.params.path} (${String(tc.params.content || '').length}b)`;
    if (tc.name === 'file_edit') return `edit ${tc.params.path}\n- ${String(tc.params.old_text || '').slice(0,80)}\n+ ${String(tc.params.new_text || '').slice(0,80)}`;
    if (tc.name === 'web_fetch') return `GET ${tc.params.url}`;
    if (tc.name === 'web_search') return `search "${tc.params.query}"`;
    return JSON.stringify(tc.params, null, 2);
  } catch { return ''; }
}

export default function MessageBubble({ message, showThinking, isLast, isGenerating, onCopy }: Props) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const showTyping = isLast && isGenerating && isAssistant && !message.content && !message.toolCalls?.length;

  return (
    <div className={`msg ${isUser ? 'user' : 'assistant'}`}>
      <div className="avatar">{isUser ? '👤' : '◆'}</div>
      <div className="bubble">
        {isAssistant && (
          <div className="meta">
            <span className="role">OpenCode</span>
            {message.model && <span>· {message.model}</span>}
            {message.usage && <span>· {message.usage.totalTokens} tok</span>}
            <button
              className="btn btn-sm btn-ghost"
              style={{ marginLeft: 'auto', padding: '2px 8px', fontSize: 10 }}
              onClick={() => onCopy(message.content || '')}
              title="Copiar"
            >📋</button>
          </div>
        )}

        {showThinking && message.thinking && (
          <details className="thinking-block" open={false}>
            <summary>🧠 Razonamiento ({message.thinking.length} chars)</summary>
            {message.thinking}
          </details>
        )}

        {message.toolCalls?.map(tc => <ToolCallView key={tc.id} tc={tc} />)}

        {message.content && (
          <div className="content">{renderContent(message.content)}</div>
        )}

        {showTyping && (
          <div className="typing"><span /><span /><span /></div>
        )}

        {message.error && (
          <div className="tool-call error" style={{ marginTop: 6 }}>
            <div className="tc-head"><span>⚠️</span><span className="tc-name">Error</span></div>
            <div className="tc-body">{message.error}</div>
          </div>
        )}
      </div>
    </div>
  );
}
