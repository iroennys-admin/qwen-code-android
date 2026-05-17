// ==========================================
// OpenCode Android - Terminal View
// ==========================================

import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { AppConfig } from '../types';
import { executeShell, isNative } from '../services/bridge';

interface TerminalViewProps {
  config: AppConfig;
}

interface TerminalLine {
  type: 'input' | 'output' | 'error' | 'info';
  text: string;
}

export default function TerminalView({ config }: TerminalViewProps) {
  const [lines, setLines] = useState<TerminalLine[]>([
    { type: 'info', text: 'OpenCode Terminal v1.0' },
    { type: 'info', text: 'Escribe comandos y presiona Enter para ejecutar.' },
    { type: 'info', text: '' },
  ]);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isRunning, setIsRunning] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  const executeCommand = useCallback(async (cmd: string) => {
    if (!cmd.trim()) return;

    setLines(prev => [...prev, { type: 'input', text: `$ ${cmd}` }]);
    setHistory(prev => [...prev, cmd]);
    setHistoryIndex(-1);
    setIsRunning(true);

    try {
      const result = await executeShell(cmd, 60);

      if (result.stdout) {
        setLines(prev => [...prev, { type: 'output', text: result.stdout }]);
      }
      if (result.stderr) {
        setLines(prev => [...prev, { type: 'error', text: result.stderr }]);
      }
      if (result.exitCode !== 0 && !result.stderr) {
        setLines(prev => [...prev, { type: 'error', text: `[Exit code: ${result.exitCode}]` }]);
      }
    } catch (err: any) {
      setLines(prev => [...prev, { type: 'error', text: err.message }]);
    } finally {
      setIsRunning(false);
    }
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const cmd = input.trim();
      setInput('');
      executeCommand(cmd);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0) {
        const newIndex = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIndex);
        setInput(history[newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex >= 0) {
        const newIndex = historyIndex + 1;
        if (newIndex >= history.length) {
          setHistoryIndex(-1);
          setInput('');
        } else {
          setHistoryIndex(newIndex);
          setInput(history[newIndex]);
        }
      }
    }
  }, [input, history, historyIndex, executeCommand]);

  const lineColor = (type: TerminalLine['type']) => {
    switch (type) {
      case 'input': return 'var(--accent-green)';
      case 'output': return 'var(--text-primary)';
      case 'error': return 'var(--error)';
      case 'info': return 'var(--text-tertiary)';
    }
  };

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: '#0d1117',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-sm)',
        padding: '6px var(--space-md)',
        background: 'rgba(13, 17, 23, 0.95)',
        borderBottom: '1px solid var(--border-primary)',
      }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f57', display: 'inline-block' }} />
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#febc2e', display: 'inline-block' }} />
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#28c840', display: 'inline-block' }} />
        </div>
        <span style={{
          fontSize: 12,
          color: 'var(--accent-green)',
          fontWeight: 600,
          flex: 1,
          textAlign: 'center',
          fontFamily: 'var(--font-mono)',
        }}>
          Terminal — OpenCode
        </span>
        <button
          onClick={() => setLines([{ type: 'info', text: 'Terminal cleared.' }])}
          style={{
            background: 'none',
            border: '1px solid var(--border-primary)',
            color: 'var(--text-tertiary)',
            borderRadius: 'var(--radius-sm)',
            padding: '2px 8px',
            fontSize: 11,
            cursor: 'pointer',
            fontFamily: 'var(--font-mono)',
          }}
        >
          Clear
        </button>
      </div>

      {/* Terminal Output */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: 'var(--space-sm) var(--space-md)',
        fontFamily: 'var(--font-mono)',
        fontSize: 13,
        lineHeight: 1.5,
      }}>
        {lines.map((line, i) => (
          <div key={i} style={{
            color: lineColor(line.type),
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}>
            {line.text}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: 'var(--space-sm) var(--space-md)',
        borderTop: '1px solid var(--border-primary)',
        fontFamily: 'var(--font-mono)',
      }}>
        <span style={{ color: 'var(--accent-green)', fontWeight: 700, marginRight: 8 }}>$</span>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isRunning}
          placeholder={isRunning ? 'Ejecutando...' : 'Comando...'}
          style={{
            flex: 1,
            background: 'none',
            border: 'none',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            outline: 'none',
          }}
        />
      </div>
    </div>
  );
}
