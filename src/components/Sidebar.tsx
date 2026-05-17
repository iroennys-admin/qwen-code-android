// ==========================================
// OpenCode Android - Sidebar
// ==========================================

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
  { id: 'terminal', icon: '💻', label: 'Terminal' },
  { id: 'files', icon: '📁', label: 'Archivos' },
  { id: 'settings', icon: '⚙️', label: 'Config' },
];

export default function Sidebar({ config, updateConfig, view, setView, open, onClose, onClear, messageCount }: SidebarProps) {
  const activeProvider = config.providers.find(p => p.id === config.activeProvider);
  const activeModel = config.activeModel.split('/').pop() || config.activeModel;
  const isFree = activeProvider?.isFree || config.activeModel.includes('free');

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
          background: 'var(--bg-secondary)',
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
              background: 'linear-gradient(135deg, var(--accent-green), var(--accent-purple))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              color: '#0d1117',
            }}>
              {'>'}_
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 16 }}>OpenCode</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>AI Agent v1.0</div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div style={{ flex: 1, padding: 'var(--space-sm)' }}>
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => { setView(item.id); onClose(); }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-md)',
                padding: '12px var(--space-md)',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                background: view === item.id ? 'var(--bg-active)' : 'transparent',
                color: view === item.id ? 'var(--accent-green)' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: view === item.id ? 600 : 400,
                transition: 'all var(--transition-fast)',
                textAlign: 'left',
                fontFamily: 'var(--font-mono)',
              }}
            >
              <span style={{ fontSize: 18 }}>{item.icon}</span>
              <span>{item.label}</span>
              {item.id === 'chat' && messageCount > 0 && (
                <span style={{
                  marginLeft: 'auto',
                  fontSize: 11,
                  background: 'var(--accent-green)',
                  color: '#0d1117',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)',
                  fontWeight: 600,
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

          {/* Clear Chat */}
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
              fontFamily: 'var(--font-mono)',
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
            fontFamily: 'var(--font-mono)',
          }}>
            Modelo Activo
          </div>
          <div style={{
            fontSize: 13,
            color: 'var(--accent-green)',
            fontWeight: 500,
            fontFamily: 'var(--font-mono)',
          }}>
            {activeModel}
          </div>
          <div style={{
            fontSize: 11,
            color: isFree ? 'var(--accent-green)' : 'var(--accent-purple)',
            marginTop: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-xs)',
          }}>
            <span style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: isFree ? 'var(--accent-green)' : 'var(--accent-purple)',
              display: 'inline-block',
            }} />
            {isFree ? 'GRATUITO' : activeProvider?.name || 'Proveedor'}
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
              background: config.proxyEnabled ? 'var(--accent-green)' : 'var(--warning)',
              display: 'inline-block',
            }} />
            Proxy: {config.proxyEnabled ? 'Activo' : 'Inactivo'}
          </div>
        </div>
      </div>
    </>
  );
}
