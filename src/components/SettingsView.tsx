// ==========================================
// OpenCode v2 - Settings View
// ==========================================

import React, { useState } from 'react';
import type { AppConfig, Provider } from '../types';
import { testProvider } from '../services/api';

interface Props {
  config: AppConfig;
  onChange: (c: Partial<AppConfig>) => void;
  onChangeProvider: (id: string, p: Partial<Provider>) => void;
  onReset: () => void;
}

const THEMES: Array<{ id: AppConfig['theme']; name: string }> = [
  { id: 'aurora', name: '🌌 Aurora' },
  { id: 'midnight', name: '🌑 Midnight' },
  { id: 'cyber', name: '🌸 Cyber' },
  { id: 'dark', name: '🟢 Classic Dark' },
];

export default function SettingsView({ config, onChange, onChangeProvider, onReset }: Props) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [expandedProvider, setExpandedProvider] = useState<string | null>(config.activeProvider);

  const activeProvider = config.providers.find(p => p.id === config.activeProvider);

  const doTest = async () => {
    setTesting(true);
    setTestResult(null);
    const r = await testProvider(config);
    setTestResult(r);
    setTesting(false);
  };

  return (
    <div className="settings scroll">
      {/* Active provider quick card */}
      <div className="section">
        <h3>⚙️ Modelo activo</h3>
        {activeProvider && (
          <>
            <div className="field">
              <label>Proveedor</label>
              <select
                value={config.activeProvider}
                onChange={e => {
                  const id = e.target.value;
                  const p = config.providers.find(p => p.id === id);
                  onChange({ activeProvider: id, activeModel: p?.models[0]?.id || '' });
                }}
              >
                {config.providers.map(p => (
                  <option key={p.id} value={p.id}>{p.emoji} {p.name}{p.isFree ? ' (FREE)' : ''}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Modelo</label>
              <select
                value={config.activeModel}
                onChange={e => onChange({ activeModel: e.target.value })}
              >
                {activeProvider.models.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.isFree ? '🆓 ' : ''}{m.name}{m.contextLength ? ` · ${Math.round(m.contextLength/1000)}k` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>API Key {activeProvider.signupUrl && <a href={activeProvider.signupUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', marginLeft: 8 }}>obtener →</a>}</label>
              <input
                type="password"
                value={activeProvider.apiKey}
                onChange={e => onChangeProvider(activeProvider.id, { apiKey: e.target.value })}
                placeholder="sk-..."
                autoCorrect="off" autoCapitalize="off" spellCheck={false}
              />
            </div>
            <div className="flex gap-2" style={{ marginTop: 8 }}>
              <button className="btn btn-primary" onClick={doTest} disabled={testing}>
                {testing ? '🔌 Probando…' : '🔌 Probar conexión'}
              </button>
            </div>
            {testResult && (
              <div className={`small`} style={{ marginTop: 8, color: testResult.ok ? 'var(--ok)' : 'var(--danger)' }}>
                {testResult.ok ? '✅' : '❌'} {testResult.message}
              </div>
            )}
            {activeProvider.notes && <div className="muted small" style={{ marginTop: 6 }}>{activeProvider.notes}</div>}
          </>
        )}
      </div>

      {/* All providers */}
      <div className="section">
        <h3>📡 Proveedores ({config.providers.filter(p => p.isFree).length} gratis disponibles)</h3>
        {config.providers.map(p => (
          <div key={p.id} className={`provider-card ${p.id === config.activeProvider ? 'active' : ''}`}>
            <div className="head">
              <span style={{ fontSize: 20 }}>{p.emoji}</span>
              <span className="name">{p.name}</span>
              {p.isFree && <span className="badge">FREE</span>}
              <span className="spacer" style={{ flex: 1 }} />
              <button className="btn btn-sm" onClick={() => setExpandedProvider(expandedProvider === p.id ? null : p.id)}>
                {expandedProvider === p.id ? '▴' : '▾'}
              </button>
            </div>
            {p.notes && <div className="note">{p.notes}</div>}
            {expandedProvider === p.id && (
              <div style={{ marginTop: 8 }}>
                <div className="field">
                  <label>API Key</label>
                  <input
                    type="password"
                    value={p.apiKey}
                    onChange={e => onChangeProvider(p.id, { apiKey: e.target.value })}
                    placeholder="sk-..."
                    autoCorrect="off" autoCapitalize="off" spellCheck={false}
                  />
                </div>
                <div className="field">
                  <label>Base URL</label>
                  <input value={p.baseUrl} onChange={e => onChangeProvider(p.id, { baseUrl: e.target.value })} />
                </div>
                <div className="field">
                  <label>Proxy URL (Cuba)</label>
                  <input value={p.proxyBaseUrl} onChange={e => onChangeProvider(p.id, { proxyBaseUrl: e.target.value })} />
                </div>
                {p.signupUrl && (
                  <a href={p.signupUrl} target="_blank" rel="noreferrer" className="btn btn-sm btn-ghost" style={{ marginTop: 6 }}>
                    🔗 Conseguir API key
                  </a>
                )}
                <div className="muted small" style={{ marginTop: 8 }}>
                  Modelos: {p.models.map(m => m.name).join(', ')}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Generation params */}
      <div className="section">
        <h3>🎛️ Parámetros</h3>
        <div className="field">
          <label>Temperature: {config.temperature.toFixed(2)}</label>
          <input type="range" min="0" max="2" step="0.05" value={config.temperature} onChange={e => onChange({ temperature: parseFloat(e.target.value) })} />
        </div>
        <div className="field">
          <label>Max tokens: {config.maxTokens}</label>
          <input type="range" min="512" max="32768" step="256" value={config.maxTokens} onChange={e => onChange({ maxTokens: parseInt(e.target.value) })} />
        </div>
        <div className="field">
          <label>Max agent steps: {config.maxAgentSteps}</label>
          <input type="range" min="5" max="60" step="1" value={config.maxAgentSteps} onChange={e => onChange({ maxAgentSteps: parseInt(e.target.value) })} />
        </div>
        <div className="field">
          <label>Working directory</label>
          <input value={config.workingDir} onChange={e => onChange({ workingDir: e.target.value })} />
        </div>
        <div className="row">
          <div className="label">Streaming
            <div className="sub">Recibe tokens en vivo</div>
          </div>
          <div className={`toggle ${config.streaming ? 'on' : ''}`} onClick={() => onChange({ streaming: !config.streaming })} />
        </div>
        <div className="row">
          <div className="label">Modo razonamiento extendido
            <div className="sub">Para GLM/Z.AI con thinking</div>
          </div>
          <div className={`toggle ${config.enableThinkingMode ? 'on' : ''}`} onClick={() => onChange({ enableThinkingMode: !config.enableThinkingMode })} />
        </div>
      </div>

      {/* Tools */}
      <div className="section">
        <h3>🛠️ Comportamiento</h3>
        <div className="field">
          <label>Modo de aprobación</label>
          <select value={config.approvalMode} onChange={e => onChange({ approvalMode: e.target.value as any })}>
            <option value="ask">Preguntar siempre (más seguro)</option>
            <option value="auto_edit">Auto-aprobar archivos seguros (recomendado)</option>
            <option value="yolo">YOLO — no preguntar nada</option>
          </select>
        </div>
        <div className="row">
          <div className="label">Recuerdos persistentes 🧠
            <div className="sub">El agente puede guardar facts</div>
          </div>
          <div className={`toggle ${config.enableMemory ? 'on' : ''}`} onClick={() => onChange({ enableMemory: !config.enableMemory })} />
        </div>
        <div className="row">
          <div className="label">TODOs
            <div className="sub">Lista de tareas del agente</div>
          </div>
          <div className={`toggle ${config.enableTodos ? 'on' : ''}`} onClick={() => onChange({ enableTodos: !config.enableTodos })} />
        </div>
        <div className="row">
          <div className="label">Vibración háptica</div>
          <div className={`toggle ${config.hapticFeedback ? 'on' : ''}`} onClick={() => onChange({ hapticFeedback: !config.hapticFeedback })} />
        </div>
        <div className="row">
          <div className="label">Mostrar pensamiento</div>
          <div className={`toggle ${config.showThinking ? 'on' : ''}`} onClick={() => onChange({ showThinking: !config.showThinking })} />
        </div>
      </div>

      {/* Connectivity / Cuba */}
      <div className="section">
        <h3>🇨🇺 Conectividad</h3>
        <div className="row">
          <div className="label">Usar proxy reverso
            <div className="sub">Útil si tu ISP bloquea APIs</div>
          </div>
          <div className={`toggle ${config.proxyEnabled ? 'on' : ''}`} onClick={() => onChange({ proxyEnabled: !config.proxyEnabled })} />
        </div>
        <div className="field">
          <label>Base del proxy</label>
          <input value={config.proxyBaseUrl} onChange={e => onChange({ proxyBaseUrl: e.target.value })} />
        </div>
      </div>

      {/* Appearance */}
      <div className="section">
        <h3>🎨 Apariencia</h3>
        <div className="field">
          <label>Tema</label>
          <select value={config.theme} onChange={e => onChange({ theme: e.target.value as any })}>
            {THEMES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Tamaño de fuente: {config.fontSize}px</label>
          <input type="range" min="11" max="20" step="1" value={config.fontSize} onChange={e => onChange({ fontSize: parseInt(e.target.value) })} />
        </div>
      </div>

      {/* System prompt */}
      <div className="section">
        <h3>📜 System prompt</h3>
        <div className="field">
          <textarea
            rows={8}
            value={config.systemPrompt}
            onChange={e => onChange({ systemPrompt: e.target.value })}
          />
        </div>
      </div>

      {/* Reset */}
      <div className="section">
        <h3>🧹 Resetear</h3>
        <button className="btn btn-danger" onClick={() => {
          if (confirm('¿Resetear configuración a valores por defecto?')) onReset();
        }}>Resetear configuración</button>
      </div>
    </div>
  );
}
