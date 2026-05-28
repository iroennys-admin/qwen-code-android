// ==========================================
// OpenCode v2 - Chat View
// ==========================================

import React, { useEffect, useRef, useState } from 'react';
import type { OpenCodeMessage, OpenCodeToolCall, AgentState, AppConfig } from '../types';
import MessageBubble from './MessageBubble';
import { writeClipboard, vibrate } from '../services/bridge';

interface Props {
  messages: OpenCodeMessage[];
  config: AppConfig;
  agentState: AgentState;
  isGenerating: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
  onClear: () => void;
  onApprove: (tcId: string, approved: boolean) => void;
  pendingApproval?: OpenCodeToolCall | null;
}

const SUGGESTIONS = [
  { title: 'Crea una app web', body: 'Crea un sitio web HTML/JS responsive en /sdcard/site con login y dashboard.' },
  { title: 'Analiza un archivo', body: 'Lee y resume el contenido del archivo /sdcard/Download/notes.txt' },
  { title: 'Busca en la web', body: '¿Qué pasó hoy en tecnología? Resume las 3 noticias principales.' },
  { title: 'Refactoriza código', body: 'Busca todos los .py en /sdcard/Documents y lista funciones largas (>30 líneas).' },
];

export default function ChatView({ messages, config, agentState, isGenerating, onSend, onStop, onClear, onApprove, pendingApproval }: Props) {
  const [input, setInput] = useState('');
  const [showThinking, setShowThinking] = useState(config.showThinking);
  const messagesRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll
  useEffect(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isGenerating]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = inputRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
  }, [input]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || isGenerating) return;
    onSend(text);
    setInput('');
    if (config.hapticFeedback) vibrate(15);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="chat">
      <div className="chat-messages scroll" ref={messagesRef}>
        {messages.length === 0 ? (
          <div className="chat-empty">
            <div className="logo">◆</div>
            <h2>OpenCode AI</h2>
            <p>Agente de IA con herramientas reales: shell, archivos, web. Elige una idea o escribe la tuya.</p>
            <div className="suggestions">
              {SUGGESTIONS.map((s, i) => (
                <button key={i} className="suggestion" onClick={() => onSend(s.body)}>
                  <strong>{s.title}</strong>
                  {s.body}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <MessageBubble
              key={m.id}
              message={m}
              showThinking={showThinking}
              isLast={i === messages.length - 1}
              isGenerating={isGenerating}
              onCopy={(t) => writeClipboard(t)}
            />
          ))
        )}

        {isGenerating && agentState.status !== 'idle' && (
          <div className="agent-status">
            <div className="spinner" />
            <span>
              {agentState.status === 'thinking' && `Pensando (paso ${agentState.currentStep}/${agentState.totalSteps})...`}
              {agentState.status === 'executing' && `Ejecutando ${agentState.currentTool}...`}
              {agentState.status === 'waiting_approval' && 'Esperando aprobación...'}
            </span>
          </div>
        )}
      </div>

      <div className="composer">
        <div className="composer-tools">
          <button onClick={() => setShowThinking(v => !v)}>
            {showThinking ? '🧠 Pensar visible' : '🧠 Ocultar pensar'}
          </button>
          {messages.length > 0 && (
            <button onClick={onClear}>🗑️ Limpiar</button>
          )}
          <button onClick={() => setInput('/help')}>❓ /help</button>
          <button onClick={() => setInput('Lista los archivos de /sdcard ')}>📁 Listar</button>
          <button onClick={() => setInput('Busca en la web: ')}>🔎 Buscar</button>
        </div>

        <div className="composer-row">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={isGenerating ? 'Generando…' : 'Escribe un mensaje…'}
            rows={1}
            disabled={isGenerating}
          />
          {isGenerating ? (
            <button className="send-btn stop-btn" onClick={onStop} title="Detener">■</button>
          ) : (
            <button className="send-btn" onClick={handleSend} disabled={!input.trim()} title="Enviar">↑</button>
          )}
        </div>
      </div>

      {pendingApproval && (
        <div className="modal-bg" onClick={() => onApprove(pendingApproval.id, false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>⚠️ Aprobar acción</h3>
            <p className="muted small">El agente quiere ejecutar:</p>
            <div className="tool-call waiting_approval">
              <div className="tc-head">
                <span>🔧</span>
                <span className="tc-name">{pendingApproval.name}</span>
              </div>
              <div className="tc-body">{JSON.stringify(pendingApproval.params, null, 2)}</div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-danger" onClick={() => onApprove(pendingApproval.id, false)}>Denegar</button>
              <button className="btn btn-primary" onClick={() => onApprove(pendingApproval.id, true)}>Permitir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
