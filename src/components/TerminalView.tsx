import React, { useState, useRef, useEffect } from 'react';
import type { AppConfig } from '../types';
import { executeShell } from '../services/bridge';

interface TerminalViewProps {
  config: AppConfig;
}

interface TerminalLine {
  type: 'input' | 'output' | 'error' | 'info';
  content: string;
}

export default function TerminalView({ config }: TerminalViewProps) {
  const [lines, setLines] = useState<TerminalLine[]>([
    { type: 'info', content: 'Qwen Code Terminal v1.0' },
    { type: 'info', content: 'Escribe comandos y presiona Enter para ejecutar.' },
    { type: 'info', content: '─'.repeat(40) },
  ]);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [isRunning, setIsRunning] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);
  
  const execute = async (command: string) => {
    if (!command.trim()) return;
    
    setLines(prev => [...prev, { type: 'input', content: `$ ${command}` }]);
    setHistory(prev => [command, ...prev].slice(0, 100));
    setHistoryIdx(-1);
    setIsRunning(true);
    
    try {
      const result = await executeShell(command);
      
      if (result.stdout) {
        setLines(prev => [...prev, { type: 'output', content: result.stdout }]);
      }
      if (result.stderr) {
        setLines(prev => [...prev, { type: 'error', content: result.stderr }]);
      }
      if (result.exitCode !== 0 && !result.stderr) {
        setLines(prev => [...prev, { type: 'error', content: `Exit code: ${result.exitCode}` }]);
      }
    } catch (err: any) {
      setLines(prev => [...prev, { type: 'error', content: err.message }]);
    } finally {
      setIsRunning(false);
    }
  };
  
  const handleSubmit = () => {
    if (input.trim() && !isRunning) {
      execute(input);
      setInput('');
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIdx < history.length - 1) {
        const newIdx = historyIdx + 1;
        setHistoryIdx(newIdx);
        setInput(history[newIdx]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIdx > 0) {
        const newIdx = historyIdx - 1;
        setHistoryIdx(newIdx);
        setInput(history[newIdx]);
      } else {
        setHistoryIdx(-1);
        setInput('');
      }
    }
  };
  
  const lineColors: Record<string, string> = {
    input: 'var(--accent-secondary)',
    output: 'var(--text-primary)',
    error: 'var(--error)',
    info: 'var(--text-tertiary)',
  };
  
  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'rgba(0, 0, 0, 0.3)',
    }}>
      {/* Terminal Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-sm)',
        padding: '8px var(--space-md)',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-primary)',
      }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff5f57', display: 'inline-block' }} />
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#febc2e', display: 'inline-block' }} />
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#28c840', display: 'inline-block' }} />
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)', flex: 1, textAlign: 'center' }}>
          Terminal — Qwen Code
        </span>
        <button
          onClick={() => setLines([{ type: 'info', content: 'Terminal cleared.' }])}
          style={{
            background: 'none',
            border: '1px solid var(--border-primary)',
            color: 'var(--text-tertiary)',
            borderRadius: 'var(--radius-sm)',
            padding: '2px 8px',
            fontSize: 11,
            cursor: 'pointer',
          }}
        >
          Clear
        </button>
      </div>
      
      {/* Terminal Output */}
      <div
        ref={scrollRef}
        onClick={() => inputRef.current?.focus()}
        style={{
          flex: 1,
          overflow: 'auto',
          padding: 'var(--space-md)',
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          lineHeight: 1.6,
        }}
      >
        {lines.map((line, i) => (
          <div key={i} style={{ color: lineColors[line.type], whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {line.content}
          </div>
        ))}
        
        {/* Input Line */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
          <span style={{ color: 'var(--success)', fontWeight: 600 }}>$</span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isRunning}
            autoFocus
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              outline: 'none',
              caretColor: 'var(--accent-primary)',
            }}
          />
          {isRunning && (
            <span style={{ animation: 'pulse 1s infinite', color: 'var(--accent-primary)' }}>●</span>
          )}
        </div>
      </div>
    </div>
  );
}
