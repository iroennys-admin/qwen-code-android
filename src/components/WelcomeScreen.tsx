import React from 'react';
import type { AppConfig } from '../types';

interface WelcomeProps {
  config: AppConfig;
  onSend: (msg: string) => void;
}

const QUICK_PROMPTS = [
  { icon: '🔧', text: 'Help me debug this code', prompt: 'Help me debug my code. Show me common debugging strategies and tools.' },
  { icon: '📝', text: 'Write a Python script', prompt: 'Write a Python script that ' },
  { icon: '🌐', text: 'Fetch a webpage', prompt: 'Fetch the contents of ' },
  { icon: '💻', text: 'Run a command', prompt: 'Run the command: ' },
  { icon: '📁', text: 'Explore files', prompt: 'List the files in the current directory and help me understand the project structure.' },
  { icon: '🤖', text: 'Explain code', prompt: 'Explain how this code works: ' },
];

export default function WelcomeScreen({ config, onSend }: WelcomeProps) {
  const hasKey = !!config.providers.find(p => p.id === config.activeProvider)?.apiKey;
  
  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--space-xl)',
      overflow: 'auto',
    }}>
      {/* Logo */}
      <div style={{
        width: 80,
        height: 80,
        borderRadius: 'var(--radius-xl)',
        background: 'linear-gradient(135deg, var(--accent-primary), #8b5cf6, var(--accent-tertiary))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 36,
        fontWeight: 700,
        marginBottom: 'var(--space-lg)',
        boxShadow: '0 0 40px rgba(107, 107, 255, 0.3)',
      }}>
        Q
      </div>
      
      <h1 style={{
        fontSize: 28,
        fontWeight: 700,
        background: 'linear-gradient(135deg, var(--text-primary), var(--accent-secondary))',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        marginBottom: 'var(--space-sm)',
      }}>
        Qwen Code
      </h1>
      
      <p style={{
        color: 'var(--text-tertiary)',
        fontSize: 14,
        textAlign: 'center',
        maxWidth: 400,
        lineHeight: 1.6,
        marginBottom: 'var(--space-xl)',
      }}>
        Tu asistente de IA con acceso completo al sistema. Ejecuta comandos, lee y escribe archivos, y más.
      </p>
      
      {!hasKey && (
        <div style={{
          background: 'rgba(248, 113, 113, 0.1)',
          border: '1px solid rgba(248, 113, 113, 0.2)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-md)',
          marginBottom: 'var(--space-lg)',
          maxWidth: 400,
          width: '100%',
        }}>
          <div style={{ color: 'var(--error)', fontWeight: 600, fontSize: 13, marginBottom: 'var(--space-xs)' }}>
            ⚠️ API Key no configurada
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
            Ve a Configuración para agregar tu API key y comenzar a usar Qwen Code.
          </div>
        </div>
      )}
      
      {/* Quick Prompts */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 'var(--space-sm)',
        maxWidth: 500,
        width: '100%',
      }}>
        {QUICK_PROMPTS.map((item, i) => (
          <button
            key={i}
            onClick={() => onSend(item.prompt)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-sm)',
              padding: 'var(--space-md)',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-primary)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: 13,
              textAlign: 'left',
              transition: 'all var(--transition-fast)',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'var(--bg-hover)';
              e.currentTarget.style.borderColor = 'var(--border-active)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'var(--bg-card)';
              e.currentTarget.style.borderColor = 'var(--border-primary)';
            }}
          >
            <span style={{ fontSize: 18 }}>{item.icon}</span>
            <span>{item.text}</span>
          </button>
        ))}
      </div>
      
      {/* Input Bar */}
      <InputBar onSend={onSend} disabled={!hasKey} />
    </div>
  );
}

function InputBar({ onSend, disabled }: { onSend: (msg: string) => void; disabled: boolean }) {
  const [input, setInput] = React.useState('');
  
  const handleSubmit = () => {
    if (input.trim() && !disabled) {
      onSend(input.trim());
      setInput('');
    }
  };
  
  return (
    <div style={{
      width: '100%',
      maxWidth: 600,
      marginTop: 'var(--space-xl)',
      display: 'flex',
      gap: 'var(--space-sm)',
    }}>
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        placeholder={disabled ? 'Configura tu API key primero...' : 'Escribe un mensaje...'}
        disabled={disabled}
        style={{
          flex: 1,
          padding: '12px var(--space-md)',
          background: 'var(--bg-card)',
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
        disabled={disabled || !input.trim()}
        style={{
          padding: '12px var(--space-lg)',
          background: disabled || !input.trim() ? 'var(--bg-tertiary)' : 'var(--accent-primary)',
          border: 'none',
          borderRadius: 'var(--radius-lg)',
          color: disabled || !input.trim() ? 'var(--text-tertiary)' : 'white',
          cursor: disabled || !input.trim() ? 'not-allowed' : 'pointer',
          fontSize: 14,
          fontWeight: 600,
          transition: 'all var(--transition-fast)',
        }}
      >
        ➤
      </button>
    </div>
  );
}
