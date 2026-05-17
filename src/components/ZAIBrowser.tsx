import React, { useState, useEffect, useRef, useCallback } from 'react';
import { isNative } from '../services/bridge';

// Capacitor plugin import
import { Capacitor } from '@capacitor/core';

interface ZAIBrowserProps {
  config: any;
  updateConfig: (updates: any) => void;
}

// Access the ZAIWebView Capacitor plugin
const ZAIWebView = (Capacitor as any).Plugins?.ZAIWebView || null;

// Z.ai URLs
const ZAI_CHAT_URL = 'https://chat.z.ai';
const ZAI_LOGIN_URL = 'https://chat.z.ai/login';
const ZAI_API_URL = 'https://open.bigmodel.cn';
const ZAI_API_KEYS_URL = 'https://open.bigmodel.cn/usercenter/apikeys';

export default function ZAIBrowser({ config, updateConfig }: ZAIBrowserProps) {
  const [browserUrl, setBrowserUrl] = useState(ZAI_CHAT_URL);
  const [urlInput, setUrlInput] = useState(ZAI_CHAT_URL);
  const [showWebView, setShowWebView] = useState(false);
  const [bookmarkOpen, setBookmarkOpen] = useState(false);
  const [opening, setOpening] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const bookmarks = [
    { name: 'Z.ai Chat (GLM-5.1)', url: ZAI_CHAT_URL, icon: '🤖', desc: 'Chat con GLM-5.1 gratis' },
    { name: 'Z.ai Login', url: ZAI_LOGIN_URL, icon: '🔑', desc: 'Iniciar sesion en Z.ai' },
    { name: 'BigModel API Keys', url: ZAI_API_KEYS_URL, icon: '🔐', desc: 'Gestionar API keys' },
    { name: 'BigModel Console', url: ZAI_API_URL, icon: '📊', desc: 'Consola de BigModel' },
  ];

  // Open URL using the best available method:
  // 1. Chrome Custom Tabs (default - uses real Chrome engine, most compatible)
  // 2. Native WebView fallback (if Custom Tabs unavailable)
  // 3. External browser (last resort)
  const navigateTo = useCallback((url: string, mode: string = 'auto') => {
    setBrowserUrl(url);
    setUrlInput(url);
    setBookmarkOpen(false);
    setOpening(true);

    if (isNative()) {
      try {
        if (ZAIWebView) {
          ZAIWebView.openWebView({ url, mode });
        } else if (window.QwenCodeBridge?.openWebView) {
          window.QwenCodeBridge.openWebView(url);
        }
      } catch (e) {
        console.error('Failed to open browser:', e);
      }
      // Don't show the internal view for native - the native overlay handles it
      setShowWebView(true);
      setTimeout(() => setOpening(false), 1000);
    } else {
      setShowWebView(true);
      setOpening(false);
    }
  }, []);

  // Handle URL submit
  const handleUrlSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    let url = urlInput.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    navigateTo(url);
  }, [urlInput, navigateTo]);

  // Extract API key from Z.ai and save to config
  const extractApiKey = useCallback(async () => {
    if (window.QwenCodeBridge?.clipboardRead) {
      try {
        const result = await window.QwenCodeBridge.clipboardRead();
        const clipboardText = result.value || '';
        const apiKeyMatch = clipboardText.match(/[a-f0-9]{32}\.[a-zA-Z0-9]+/);
        if (apiKeyMatch) {
          const extractedKey = apiKeyMatch[0];
          const providers = config.providers.map((p: any) =>
            p.id === 'zai' ? { ...p, apiKey: extractedKey } : p
          );
          updateConfig({ providers, activeProvider: 'zai' });
          alert(`API Key encontrada y guardada: ${extractedKey.substring(0, 10)}...`);
          return;
        }
      } catch (e) { }
    }
    alert('No se encontro API key en el portapapeles. Copia tu API key desde Z.ai y presiona este boton.');
  }, [config, updateConfig]);

  // Check if native on mount
  useEffect(() => {
    // Auto-open Z.ai chat on native
    if (isNative()) {
      // Don't auto-open, let user choose
    }
  }, []);

  const isNtv = isNative();

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg-primary)',
    }}>
      {/* Browser Toolbar */}
      <div className="acrylic" style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-sm)',
        padding: 'var(--space-xs) var(--space-sm)',
        borderBottom: '1px solid var(--border-primary)',
        zIndex: 10,
      }}>
        {/* URL Bar */}
        <form onSubmit={handleUrlSubmit} style={{ flex: 1, display: 'flex' }}>
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://chat.z.ai"
            style={{
              flex: 1,
              padding: '8px 12px',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-primary)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              fontSize: 13,
              fontFamily: 'var(--font-mono)',
              outline: 'none',
            }}
          />
        </form>

        {/* Bookmarks button */}
        <button
          onClick={() => setBookmarkOpen(!bookmarkOpen)}
          title="Marcadores"
          style={{
            background: bookmarkOpen ? 'var(--bg-active)' : 'none',
            border: 'none',
            color: bookmarkOpen ? 'var(--text-primary)' : 'var(--text-secondary)',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: 'var(--radius-sm)',
            fontSize: 14,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          *
        </button>

        {/* Extract API Key button */}
        <button
          onClick={extractApiKey}
          title="Extraer API Key del portapapeles"
          style={{
            background: 'var(--accent-primary)',
            border: 'none',
            color: 'white',
            cursor: 'pointer',
            padding: '6px 10px',
            borderRadius: 'var(--radius-sm)',
            fontSize: 11,
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}
        >
          Key
        </button>
      </div>

      {/* Bookmarks Dropdown */}
      {bookmarkOpen && (
        <div style={{
          position: 'absolute',
          top: 52,
          right: 60,
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-primary)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-sm)',
          zIndex: 20,
          minWidth: 280,
          boxShadow: 'var(--shadow-lg)',
        }}>
          <div style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--text-tertiary)',
            padding: '4px 8px',
            marginBottom: 4,
          }}>
            Marcadores Z.ai
          </div>
          {bookmarks.map((bm, i) => (
            <button
              key={i}
              onClick={() => navigateTo(bm.url)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-sm)',
                padding: '10px 8px',
                background: 'transparent',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: 13,
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{ fontSize: 20 }}>{bm.icon}</span>
              <div>
                <div style={{ fontWeight: 500 }}>{bm.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{bm.desc}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Content Area */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {/* Native mode - show welcome/controls */}
        {isNtv && (
          <div style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-xl)',
            gap: 'var(--space-lg)',
            overflowY: 'auto',
          }}>
            <div style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #4a90d9, #6b6bff)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 36,
              fontWeight: 700,
              color: 'white',
              boxShadow: '0 0 40px rgba(74, 144, 217, 0.3)',
            }}>
              Z
            </div>

            <div style={{ textAlign: 'center' }}>
              <h2 style={{ color: 'var(--text-primary)', fontSize: 20, fontWeight: 600, marginBottom: 4 }}>
                Z.ai Navegador
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, maxWidth: 320, lineHeight: 1.5 }}>
                Accede a Z.ai usando Chrome Custom Tabs o el navegador de tu dispositivo. Inicia sesion y usa GLM-5.1 directamente.
              </p>
            </div>

            {/* Opening indicator */}
            {opening && (
              <div style={{
                padding: '8px 16px',
                background: 'var(--accent-primary)',
                color: 'white',
                borderRadius: 'var(--radius-md)',
                fontSize: 13,
              }}>
                Abriendo navegador...
              </div>
            )}

            {/* Quick access cards */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 'var(--space-sm)',
              width: '100%',
              maxWidth: 400,
            }}>
              {bookmarks.map((bm, i) => (
                <button
                  key={i}
                  onClick={() => navigateTo(bm.url)}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-primary)',
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--space-md)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-active)';
                    e.currentTarget.style.background = 'var(--bg-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-primary)';
                    e.currentTarget.style.background = 'var(--bg-card)';
                  }}
                >
                  <div style={{ fontSize: 24, marginBottom: 4 }}>{bm.icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{bm.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{bm.desc}</div>
                </button>
              ))}
            </div>

            {/* Main CTA - Chrome Custom Tabs (most reliable) */}
            <button
              onClick={() => navigateTo(ZAI_CHAT_URL, 'customtabs')}
              style={{
                padding: '16px 40px',
                background: 'linear-gradient(135deg, #4a90d9, #6b6bff)',
                border: 'none',
                borderRadius: 'var(--radius-lg)',
                color: 'white',
                cursor: 'pointer',
                fontSize: 16,
                fontWeight: 700,
                boxShadow: '0 4px 20px rgba(74, 144, 217, 0.4)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-sm)',
                width: '100%',
                maxWidth: 400,
                justifyContent: 'center',
              }}
            >
              Abrir Z.ai Chat
            </button>

            {/* Alternative: WebView */}
            <button
              onClick={() => navigateTo(ZAI_CHAT_URL, 'webview')}
              style={{
                width: '100%',
                maxWidth: 400,
                padding: '14px',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-primary)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--space-sm)',
              }}
            >
              Abrir en WebView integrado
            </button>

            {/* Alternative: External browser */}
            <button
              onClick={() => navigateTo(ZAI_CHAT_URL, 'browser')}
              style={{
                width: '100%',
                maxWidth: 400,
                padding: '14px',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-primary)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 400,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--space-sm)',
              }}
            >
              Abrir en navegador externo
            </button>

            {/* API Key extraction */}
            <button
              onClick={extractApiKey}
              style={{
                width: '100%',
                maxWidth: 400,
                padding: '14px',
                background: 'rgba(74, 222, 128, 0.1)',
                border: '1px solid rgba(74, 222, 128, 0.3)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--success)',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--space-sm)',
              }}
            >
              Guardar API Key del Portapapeles
            </button>

            {/* Info box */}
            <div style={{
              background: 'rgba(107, 107, 255, 0.05)',
              border: '1px solid var(--border-primary)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-md)',
              maxWidth: 400,
              width: '100%',
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-secondary)', marginBottom: 6 }}>
                Como usar Z.ai:
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                1. Toca <b>Abrir Z.ai Chat</b> (usa Chrome Custom Tabs)<br/>
                2. Inicia sesion con tu cuenta Z.ai<br/>
                3. Chatea con GLM-5.1 directamente<br/>
                4. Para API Key: ve a API Keys, copiala y usa el boton verde<br/>
                <span style={{ color: 'var(--success)', fontWeight: 600 }}>20M tokens gratis para cuentas nuevas!</span>
              </div>
            </div>
          </div>
        )}

        {/* Web mode - iframe fallback */}
        {!isNtv && showWebView && (
          <iframe
            ref={iframeRef}
            src={browserUrl}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              background: 'white',
            }}
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-storage-access-by-user-activation"
            allow="clipboard-read; clipboard-write"
          />
        )}

        {/* Web mode - welcome screen */}
        {!isNtv && !showWebView && (
          <div style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-xl)',
            gap: 'var(--space-lg)',
          }}>
            <div style={{
              width: 100,
              height: 100,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #4a90d9, #6b6bff, #8b5cf6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 48,
              fontWeight: 700,
              color: 'white',
              boxShadow: '0 0 60px rgba(74, 144, 217, 0.3)',
            }}>
              Z
            </div>
            <div style={{ textAlign: 'center' }}>
              <h1 style={{ color: 'var(--text-primary)', fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
                Z.ai Browser
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
                Accede a Z.ai y usa GLM-5.1 desde tu cuenta
              </p>
            </div>
            <div style={{
              fontSize: 11,
              color: 'var(--warning)',
              background: 'rgba(251, 191, 36, 0.1)',
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid rgba(251, 191, 36, 0.2)',
            }}>
              En modo web, el navegador integrado puede tener limitaciones. En Android se abre con Chrome Custom Tabs.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
