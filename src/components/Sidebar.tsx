import React from 'react';
import type { AppConfig, ViewMode } from '../types';

interface SidebarProps {
  config: AppConfig;
  updateConfig: (updates: Partial<AppConfig>) => void;
  view: ViewMode;
  setView: (v: ViewMode) => void;
  open: boolean;
  onClose: () => void;
  onClear: () => void;
  messageCount: number;
}

const NAV_ITEMS: Array<{ id: ViewMode; icon: string; label: string }> = [
  { id: 'chat', icon: '💬', label: 'Chat' },
  { id: 'zai', icon: '🌐', label: 'Z.ai' },
  { id: 'terminal', icon: '💻', label: 'Terminal' },
  { id: 'opencode', icon: '🤖', label: 'OpenCode' },
  { id: 'files', icon: '📁', label: 'Archivos' },
  { id: 'settings', icon: '⚙️', label: 'Config' },
];

export default function Sidebar({ config, updateConfig, view, setView, open, onClose, onClear, messageCount }: SidebarProps) {
  return (
    <>
      {/* Overlay */}
      {open && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 200,
          }}
        />
      )}
      
      {/* Sidebar Panel */}
      <div
        className="acrylic"
        style={{
          position: 'fixed',
          left: open ? 0 : -280,
          top: 0,
          bottom: 0,
          width: 280,
          zIndex: 300,
          transition: 'left var(--transition-normal)',
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid var(--border-primary)',
        }}
      >
        {/* Header */}
        <div style={{
          padding: 'var(--space-lg) var(--space-md)',
          borderBottom: '1px solid var(--border-primary)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-tertiary))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              fontWeight: 700,
            }}>
              Q
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 16 }}>Qwen Code</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>AI Agent v4.0</div>
            </div>
          </div>
        </div>
        
        {/* Navigation */}
        <div style={{ flex: 1, padding: 'var(--space-sm)' }}>
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => { setView(item.id); onClose(); }}
              className={view === item.id ? 'glow' : ''}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-md)',
                padding: '12px var(--space-md)',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                background: view === item.id ? 'var(--bg-active)' : 'transparent',
                color: view === item.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: view === item.id ? 600 : 400,
                transition: 'all var(--transition-fast)',
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 18 }}>{item.icon}</span>
              <span>{item.label}</span>
              {item.id === 'chat' && messageCount > 0 && (
                <span style={{
                  marginLeft: 'auto',
                  fontSize: 11,
                  background: 'var(--accent-primary)',
                  color: 'white',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)',
                }}>
                  {messageCount}
                </span>
              )}
            </button>
          ))}
          
          {/* Divider */}
          <div style={{
            height: 1,
            background: 'var(--border-primary)',
            margin: 'var(--space-md) var(--space-sm)',
          }} />
          
          {/* Quick Actions */}
          <button
            onClick={() => { onClear(); onClose(); }}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-md)',
              padding: '12px var(--space-md)',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              background: 'transparent',
              color: 'var(--error)',
              cursor: 'pointer',
              fontSize: 14,
              textAlign: 'left',
            }}
          >
            <span style={{ fontSize: 18 }}>🗑️</span>
            <span>Limpiar Chat</span>
          </button>
        </div>
        
        {/* Provider Info */}
        <div style={{
          padding: 'var(--space-md)',
          borderTop: '1px solid var(--border-primary)',
        }}>
          <div style={{
            fontSize: 11,
            color: 'var(--text-tertiary)',
            marginBottom: 'var(--space-xs)',
          }}>
            Proveedor Activo
          </div>
          <div style={{
            fontSize: 13,
            color: 'var(--accent-secondary)',
            fontWeight: 500,
          }}>
            {config.providers.find(p => p.id === config.activeProvider)?.name || 'Ninguno'}
          </div>
          <div style={{
            fontSize: 11,
            color: 'var(--text-tertiary)',
            marginTop: 'var(--space-xs)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-xs)',
          }}>
            <span style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: config.proxyEnabled ? 'var(--success)' : 'var(--warning)',
              display: 'inline-block',
            }} />
            {config.proxyEnabled ? 'Proxy: Activo' : 'Proxy: Inactivo'}
          </div>
        </div>
      </div>
    </>
  );
}
