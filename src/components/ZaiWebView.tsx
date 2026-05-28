// ==========================================
// OpenCode v2 - Z.AI Web View
// On Android: opens a full-screen native WebView (ZaiWebActivity) with
//   persistent cookies, so login on chat.z.ai sticks across sessions.
// On the web preview: falls back to iframe (will only render if Z.AI
//   ever drops X-Frame-Options; otherwise shows a friendly link).
// ==========================================

import React, { useEffect, useRef, useState } from 'react';
import { registerPlugin, Capacitor } from '@capacitor/core';

const OpenCodeBridge = registerPlugin<any>('OpenCodeBridge');

const ZAI_URL = 'https://chat.z.ai';

function isNative() {
  try { return Capacitor.isNativePlatform(); } catch { return false; }
}

export default function ZaiWebView() {
  const [opened, setOpened] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const openNative = async (url: string = ZAI_URL) => {
    setError(null);
    try {
      await OpenCodeBridge.openWebView({ url, title: 'Z.AI' });
      setOpened(true);
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  };

  // Auto-open the native webview the first time the tab is shown
  useEffect(() => {
    if (isNative()) {
      openNative();
    }
  }, []);

  if (isNative()) {
    return (
      <div className="zai-landing">
        <div className="zai-logo">🇿</div>
        <h2>Z.AI Web</h2>
        <p className="muted small">
          chat.z.ai se abrió en una vista nativa de pantalla completa.
          La sesión queda guardada — solo te logueas una vez.
        </p>

        <div className="zai-actions">
          <button className="btn btn-primary" onClick={() => openNative(ZAI_URL)}>
            🚀 Abrir chat.z.ai
          </button>
          <button className="btn" onClick={() => openNative('https://chat.z.ai/auth')}>
            🔑 Login / Registro
          </button>
          <button className="btn btn-ghost" onClick={() => openNative('https://z.ai/manage-apikey/apikey-list')}>
            🔧 Conseguir API key (para el agente)
          </button>
        </div>

        {error && (
          <div className="tool-call error" style={{ marginTop: 12, maxWidth: 360 }}>
            <div className="tc-body">{error}</div>
          </div>
        )}

        <div className="zai-tips">
          <h3>💡 Cómo usar Z.AI con el agente</h3>
          <ol>
            <li>Pulsa <b>🚀 Abrir chat.z.ai</b> y haz login con Google/email.</li>
            <li>Si quieres que el <b>agente</b> (pestaña Chat) use GLM, ve a
              <b> 🔧 Conseguir API key</b>, copia tu key.</li>
            <li>Pégala en <b>⚙️ Ajustes → Z.AI (GLM) → API Key</b>.</li>
            <li>Listo. Ahora chateas con GLM en la web Y desde el agente, en el mismo APK.</li>
          </ol>
        </div>

        <style>{styles}</style>
      </div>
    );
  }

  // Web preview fallback — try iframe (will fail on chat.z.ai due to X-Frame-Options)
  return (
    <div className="zai-landing">
      <div className="zai-logo">🇿</div>
      <h2>Z.AI Web</h2>
      <p className="muted small">
        En la vista previa web, chat.z.ai bloquea iframes. Instala el APK para
        ver la pantalla embebida nativa.
      </p>
      <div className="zai-actions">
        <a className="btn btn-primary" href={ZAI_URL} target="_blank" rel="noreferrer">
          🌐 Abrir chat.z.ai en nueva pestaña
        </a>
      </div>
      <iframe
        ref={iframeRef}
        src={ZAI_URL}
        style={{ width: '100%', height: 280, marginTop: 14, border: '1px solid var(--border)', borderRadius: 12, background: '#fff' }}
        title="Z.AI preview"
      />
      <style>{styles}</style>
    </div>
  );
}

const styles = `
.zai-landing {
  flex: 1; min-height: 0; overflow-y: auto;
  display: flex; flex-direction: column; align-items: center;
  padding: 32px 18px; text-align: center; gap: 14px;
  background:
    radial-gradient(600px 300px at 50% 0%, rgba(124, 140, 255, 0.18), transparent 70%),
    var(--bg-0);
}
.zai-logo {
  width: 96px; height: 96px; border-radius: 28px;
  display: grid; place-items: center;
  background: linear-gradient(135deg, #ff5757 0%, #ffb347 100%);
  color: #fff; font-weight: 800; font-size: 50px;
  box-shadow: 0 16px 50px rgba(255, 87, 87, 0.35);
}
.zai-landing h2 {
  margin: 4px 0;
  font-size: 22px;
  background: linear-gradient(135deg, #ff5757, #ffb347);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.zai-landing p { margin: 0; max-width: 360px; }
.zai-actions {
  display: flex; flex-direction: column; gap: 8px;
  width: 100%; max-width: 320px; margin-top: 14px;
}
.zai-actions .btn { width: 100%; }
.zai-tips {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 14px 16px;
  margin-top: 22px;
  max-width: 380px;
  text-align: left;
}
.zai-tips h3 { margin: 0 0 8px; font-size: 13px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
.zai-tips ol { margin: 0; padding-left: 18px; font-size: 13px; color: var(--text-muted); }
.zai-tips li { margin-bottom: 4px; }
.zai-tips b { color: var(--text); }
`;
