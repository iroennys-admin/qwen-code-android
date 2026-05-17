// ==========================================
// OpenCode Android - Settings View
// ==========================================

import React, { useState } from 'react';
import type { AppConfig, Provider, ModelInfo } from '../types';

interface SettingsViewProps {
  config: AppConfig;
  updateConfig: (updates: Partial<AppConfig>) => void;
  initialTab?: string;
}

type SettingsTab = 'provider' | 'agent' | 'proxy' | 'about';

export default function SettingsView({ config, updateConfig, initialTab }: SettingsViewProps) {
  const [tab, setTab] = useState<SettingsTab>(initialTab === 'opencode' ? 'provider' : 'provider');
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ provider: string; success: boolean; message: string } | null>(null);

  const tabs: Array<{ id: SettingsTab; label: string; icon: string }> = [
    { id: 'provider', label: 'Proveedor', icon: '🔑' },
    { id: 'agent', label: 'Agente', icon: '🤖' },
    { id: 'proxy', label: 'Proxy', icon: '🌐' },
    { id: 'about', label: 'Acerca', icon: 'ℹ️' },
  ];

  const testProvider = async (provider: Provider) => {
    setTestingProvider(provider.id);
    setTestResult(null);
    try {
      const baseUrl = config.proxyEnabled && provider.proxyBaseUrl
        ? provider.proxyBaseUrl
        : provider.baseUrl;
      const apiKey = provider.apiKey || 'public';

      const resp = await fetch(`${baseUrl}/models`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });

      if (resp.ok) {
        setTestResult({ provider: provider.id, success: true, message: 'Conexión exitosa!' });
      } else {
        setTestResult({ provider: provider.id, success: false, message: `Error ${resp.status}` });
      }
    } catch (err: any) {
      setTestResult({ provider: provider.id, success: false, message: err.message });
    } finally {
      setTestingProvider(null);
    }
  };

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg-primary)',
    }}>
      {/* Tab Bar */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--border-primary)',
        overflow: 'auto',
      }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1,
              padding: '10px 8px',
              border: 'none',
              borderBottom: tab === t.id ? '2px solid var(--accent-green)' : '2px solid transparent',
              background: 'transparent',
              color: tab === t.id ? 'var(--accent-green)' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: tab === t.id ? 600 : 400,
              fontFamily: 'var(--font-mono)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
            }}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 'var(--space-md)' }}>
        {tab === 'provider' && <ProviderTab config={config} updateConfig={updateConfig} testingProvider={testingProvider} testResult={testResult} testProvider={testProvider} />}
        {tab === 'agent' && <AgentTab config={config} updateConfig={updateConfig} />}
        {tab === 'proxy' && <ProxyTab config={config} updateConfig={updateConfig} />}
        {tab === 'about' && <AboutTab />}
      </div>
    </div>
  );
}

// ---- Provider Tab ----
function ProviderTab({ config, updateConfig, testingProvider, testResult, testProvider }: any) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
      {config.providers.map((provider: Provider) => {
        const isActive = config.activeProvider === provider.id;
        const currentModel = isActive ? config.activeModel : provider.models[0]?.id;

        return (
          <div key={provider.id} style={{
            border: `1px solid ${isActive ? 'var(--accent-green)' : 'var(--border-primary)'}`,
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
            background: isActive ? 'rgba(126, 231, 135, 0.03)' : 'transparent',
          }}>
            {/* Provider Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-sm)',
              padding: '12px 16px',
              borderBottom: '1px solid var(--border-primary)',
            }}>
              <div style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: isActive ? 'var(--accent-green)' : 'var(--text-tertiary)',
              }} />
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 14,
                fontWeight: 600,
                color: isActive ? 'var(--accent-green)' : 'var(--text-primary)',
                flex: 1,
              }}>
                {provider.name}
              </span>
              {provider.isFree && (
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  background: 'rgba(126, 231, 135, 0.15)',
                  color: 'var(--accent-green)',
                  padding: '2px 6px',
                  borderRadius: 'var(--radius-sm)',
                  fontWeight: 600,
                }}>
                  GRATUITO
                </span>
              )}
              {!isActive && (
                <button
                  onClick={() => updateConfig({ activeProvider: provider.id, activeModel: provider.models[0]?.id || '' })}
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    background: 'rgba(126, 231, 135, 0.1)',
                    border: '1px solid rgba(126, 231, 135, 0.2)',
                    color: 'var(--accent-green)',
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                  }}
                >
                  Activar
                </button>
              )}
            </div>

            {/* Provider Body */}
            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* API Key (hidden for free providers) */}
              {!provider.isFree && (
                <div>
                  <label style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: 'var(--text-tertiary)',
                    display: 'block',
                    marginBottom: 4,
                  }}>
                    API Key
                  </label>
                  <input
                    type="password"
                    value={provider.apiKey}
                    onChange={e => {
                      const newProviders = config.providers.map((p: Provider) =>
                        p.id === provider.id ? { ...p, apiKey: e.target.value } : p
                      );
                      updateConfig({ providers: newProviders });
                    }}
                    placeholder="sk-..."
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid var(--border-primary)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 12,
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              )}

              {/* Model Selector */}
              {isActive && (
                <div>
                  <label style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: 'var(--text-tertiary)',
                    display: 'block',
                    marginBottom: 4,
                  }}>
                    Modelo
                  </label>
                  <select
                    value={config.activeModel}
                    onChange={e => updateConfig({ activeModel: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid var(--border-primary)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 12,
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  >
                    {provider.models.map((m: ModelInfo) => (
                      <option key={m.id} value={m.id} style={{ background: '#1a1a2e' }}>
                        {m.name} {m.isFree ? '(GRATUITO)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Test Button */}
              <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
                <button
                  onClick={() => testProvider(provider)}
                  disabled={testingProvider === provider.id}
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    background: 'rgba(188, 140, 255, 0.1)',
                    border: '1px solid rgba(188, 140, 255, 0.2)',
                    color: 'var(--accent-purple)',
                    padding: '4px 12px',
                    borderRadius: 'var(--radius-sm)',
                    cursor: testingProvider === provider.id ? 'not-allowed' : 'pointer',
                  }}
                >
                  {testingProvider === provider.id ? 'Probando...' : 'Test'}
                </button>
                {testResult?.provider === provider.id && (
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: testResult.success ? 'var(--accent-green)' : 'var(--error)',
                  }}>
                    {testResult.message}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---- Agent Tab ----
function AgentTab({ config, updateConfig }: any) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
      {/* Temperature */}
      <SettingRow label="Temperatura" value={String(config.temperature)}>
        <input
          type="range"
          min="0"
          max="2"
          step="0.1"
          value={config.temperature}
          onChange={e => updateConfig({ temperature: parseFloat(e.target.value) })}
          style={{ flex: 1 }}
        />
      </SettingRow>

      {/* Max Tokens */}
      <SettingRow label="Max Tokens" value={String(config.maxTokens)}>
        <input
          type="number"
          value={config.maxTokens}
          onChange={e => updateConfig({ maxTokens: parseInt(e.target.value) || 4096 })}
          min={256}
          max={128000}
          style={{
            width: '100%',
            padding: '6px 10px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--border-primary)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </SettingRow>

      {/* Max Agent Steps */}
      <SettingRow label="Max Pasos Agente" value={String(config.maxAgentSteps)}>
        <input
          type="number"
          value={config.maxAgentSteps}
          onChange={e => updateConfig({ maxAgentSteps: parseInt(e.target.value) || 30 })}
          min={5}
          max={100}
          style={{
            width: '100%',
            padding: '6px 10px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--border-primary)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </SettingRow>

      {/* Approval Mode */}
      <SettingRow label="Modo Aprobación" value={config.approvalMode}>
        <select
          value={config.approvalMode}
          onChange={e => updateConfig({ approvalMode: e.target.value })}
          style={{
            width: '100%',
            padding: '6px 10px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--border-primary)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            outline: 'none',
            boxSizing: 'border-box',
          }}
        >
          <option value="ask" style={{ background: '#1a1a2e' }}>Preguntar siempre</option>
          <option value="auto_edit" style={{ background: '#1a1a2e' }}>Auto (preguntar shell)</option>
          <option value="yolo" style={{ background: '#1a1a2e' }}>Auto todo (YOLO)</option>
        </select>
      </SettingRow>

      {/* Streaming */}
      <SettingRow label="Streaming" value={config.streaming ? 'Sí' : 'No'}>
        <button
          onClick={() => updateConfig({ streaming: !config.streaming })}
          style={{
            width: 48,
            height: 26,
            borderRadius: 13,
            border: 'none',
            background: config.streaming ? 'var(--accent-green)' : 'rgba(255,255,255,0.1)',
            cursor: 'pointer',
            position: 'relative',
            transition: 'background 0.2s',
          }}
        >
          <div style={{
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: 'white',
            position: 'absolute',
            top: 3,
            left: config.streaming ? 25 : 3,
            transition: 'left 0.2s',
          }} />
        </button>
      </SettingRow>
    </div>
  );
}

// ---- Proxy Tab ----
function ProxyTab({ config, updateConfig }: any) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
      <div style={{
        padding: '12px 16px',
        background: 'rgba(126, 231, 135, 0.05)',
        border: '1px solid rgba(126, 231, 135, 0.1)',
        borderRadius: 'var(--radius-md)',
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        color: 'var(--text-secondary)',
        lineHeight: 1.6,
      }}>
        El proxy permite acceder a las APIs de IA desde Cuba y otros países con restricciones. Activa el proxy si tienes problemas de conexión.
      </div>

      <SettingRow label="Proxy" value={config.proxyEnabled ? 'Activo' : 'Inactivo'}>
        <button
          onClick={() => updateConfig({ proxyEnabled: !config.proxyEnabled })}
          style={{
            width: 48,
            height: 26,
            borderRadius: 13,
            border: 'none',
            background: config.proxyEnabled ? 'var(--accent-green)' : 'rgba(255,255,255,0.1)',
            cursor: 'pointer',
            position: 'relative',
            transition: 'background 0.2s',
          }}
        >
          <div style={{
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: 'white',
            position: 'absolute',
            top: 3,
            left: config.proxyEnabled ? 25 : 3,
            transition: 'left 0.2s',
          }} />
        </button>
      </SettingRow>

      <SettingRow label="URL Base" value={config.proxyBaseUrl}>
        <input
          value={config.proxyBaseUrl}
          onChange={e => updateConfig({ proxyBaseUrl: e.target.value })}
          style={{
            width: '100%',
            padding: '6px 10px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--border-primary)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </SettingRow>
    </div>
  );
}

// ---- About Tab ----
function AboutTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
      <div style={{ textAlign: 'center', padding: 'var(--space-xl) 0' }}>
        <div style={{
          fontSize: 36,
          fontFamily: 'var(--font-mono)',
          color: 'var(--accent-green)',
          fontWeight: 700,
        }}>
          {'>'}_
        </div>
        <div style={{
          fontSize: 20,
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginTop: 'var(--space-sm)',
        }}>
          OpenCode
        </div>
        <div style={{
          fontSize: 12,
          color: 'var(--text-tertiary)',
          fontFamily: 'var(--font-mono)',
        }}>
          AI Coding Agent for Android v1.0
        </div>
      </div>

      <div style={{
        padding: '12px 16px',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid var(--border-primary)',
        borderRadius: 'var(--radius-md)',
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        lineHeight: 1.8,
        color: 'var(--text-secondary)',
      }}>
        <div style={{ color: 'var(--accent-green)', fontWeight: 600, marginBottom: 4 }}>Modelos Gratuitos:</div>
        <div>• DeepSeek V4 Flash Free — razonamiento + tool calling</div>
        <div>• Big Pickle — modelo personalizado OpenCode</div>
        <div>• MiniMax M2.5 Free — razonamiento</div>
        <div>• Nemotron 3 Super Free — NVIDIA razonamiento</div>
        <div style={{ marginTop: 8, color: 'var(--accent-purple)', fontWeight: 600 }}>Herramientas:</div>
        <div>• shell, file_read, file_write, file_edit</div>
        <div>• glob, grep, list_dir, web_fetch</div>
        <div>• mkdir, rm, mv, cp</div>
        <div style={{ marginTop: 8, color: 'var(--text-tertiary)' }}>
          Basado en OpenCode (opencode.ai) — 75+ proveedores de IA
        </div>
      </div>
    </div>
  );
}

// ---- Setting Row ----
function SettingRow({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
      }}>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          color: 'var(--text-secondary)',
          fontWeight: 500,
        }}>
          {label}
        </span>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--text-tertiary)',
        }}>
          {value}
        </span>
      </div>
      {children}
    </div>
  );
}
