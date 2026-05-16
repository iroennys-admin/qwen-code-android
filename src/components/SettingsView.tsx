import React, { useState } from 'react';
import type { AppConfig, Provider } from '../types';
import { DEFAULT_PROVIDERS } from '../utils/config';
import { testApiKey, fetchModels } from '../services/api';

interface SettingsViewProps {
  config: AppConfig;
  updateConfig: (updates: Partial<AppConfig>) => void;
}

export default function SettingsView({ config, updateConfig }: SettingsViewProps) {
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, { success: boolean; msg: string }>>({});
  const [activeTab, setActiveTab] = useState<'providers' | 'general' | 'proxy' | 'about'>('providers');
  
  const testProvider = async (providerId: string) => {
    setTesting(providerId);
    const prevProvider = config.activeProvider;
    updateConfig({ activeProvider: providerId });
    
    const result = await testApiKey(config);
    setTestResult(prev => ({
      ...prev,
      [providerId]: {
        success: result.success,
        msg: result.success ? `${result.modelCount} modelos disponibles` : result.error || 'Error',
      },
    }));
    
    updateConfig({ activeProvider: prevProvider });
    setTesting(null);
  };
  
  const updateProvider = (id: string, updates: Partial<Provider>) => {
    const providers = config.providers.map(p => 
      p.id === id ? { ...p, ...updates } : p
    );
    updateConfig({ providers });
  };
  
  const tabs = [
    { id: 'providers' as const, label: '🔑 Proveedores', },
    { id: 'general' as const, label: '⚙️ General', },
    { id: 'proxy' as const, label: '🌐 Proxy', },
    { id: 'about' as const, label: 'ℹ️ Acerca de', },
  ];
  
  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Tab Bar */}
      <div style={{
        display: 'flex',
        gap: 'var(--space-xs)',
        padding: 'var(--space-sm) var(--space-md)',
        borderBottom: '1px solid var(--border-primary)',
        background: 'var(--bg-secondary)',
        overflow: 'auto',
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '8px var(--space-md)',
              background: activeTab === tab.id ? 'var(--bg-active)' : 'transparent',
              border: activeTab === tab.id ? '1px solid var(--border-active)' : '1px solid transparent',
              borderRadius: 'var(--radius-sm)',
              color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: activeTab === tab.id ? 600 : 400,
              whiteSpace: 'nowrap',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      
      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 'var(--space-md)' }}>
        {activeTab === 'providers' && (
          <ProvidersTab
            config={config}
            updateProvider={updateProvider}
            updateConfig={updateConfig}
            testing={testing}
            testResult={testResult}
            onTest={testProvider}
          />
        )}
        {activeTab === 'general' && <GeneralTab config={config} updateConfig={updateConfig} />}
        {activeTab === 'proxy' && <ProxyTab config={config} updateConfig={updateConfig} />}
        {activeTab === 'about' && <AboutTab />}
      </div>
    </div>
  );
}

function ProvidersTab({ config, updateProvider, updateConfig, testing, testResult, onTest }: any) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
      <h3 style={{ color: 'var(--text-primary)', fontSize: 16 }}>Proveedores de API</h3>
      <p style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>
        Configura tus API keys para cada proveedor. El proxy para Cuba está habilitado por defecto.
      </p>
      
      {config.providers.map((provider: Provider) => (
        <div key={provider.id} style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-primary)',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
        }}>
          {/* Provider Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-sm)',
            padding: 'var(--space-md)',
            borderBottom: '1px solid var(--border-secondary)',
          }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-tertiary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              fontWeight: 700,
              color: 'var(--accent-secondary)',
            }}>
              {provider.name[0]}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{provider.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                {provider.models.length} modelos
              </div>
            </div>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-xs)',
              fontSize: 12,
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}>
              <input
                type="radio"
                name="activeProvider"
                checked={config.activeProvider === provider.id}
                onChange={() => updateConfig({ activeProvider: provider.id })}
                style={{ accentColor: 'var(--accent-primary)' }}
              />
              Activo
            </label>
          </div>
          
          {/* API Key */}
          <div style={{ padding: 'var(--space-md)' }}>
            <label style={{
              display: 'block',
              fontSize: 12,
              color: 'var(--text-tertiary)',
              marginBottom: 'var(--space-xs)',
            }}>
              API Key
            </label>
            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
              <input
                type="password"
                value={provider.apiKey}
                onChange={(e) => updateProvider(provider.id, { apiKey: e.target.value })}
                placeholder={`Ingresa tu ${provider.name} API key`}
                style={{
                  flex: 1,
                  padding: '8px var(--space-md)',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-primary)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  fontSize: 13,
                  fontFamily: 'var(--font-mono)',
                  outline: 'none',
                }}
              />
              <button
                onClick={() => onTest(provider.id)}
                disabled={testing === provider.id || !provider.apiKey}
                style={{
                  padding: '8px var(--space-md)',
                  background: provider.apiKey ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  color: provider.apiKey ? 'white' : 'var(--text-tertiary)',
                  cursor: provider.apiKey ? 'pointer' : 'not-allowed',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {testing === provider.id ? '...' : 'Test'}
              </button>
            </div>
            
            {testResult[provider.id] && (
              <div style={{
                marginTop: 'var(--space-sm)',
                fontSize: 12,
                color: testResult[provider.id].success ? 'var(--success)' : 'var(--error)',
                padding: '6px var(--space-sm)',
                background: testResult[provider.id].success ? 'rgba(74, 222, 128, 0.1)' : 'rgba(248, 113, 113, 0.1)',
                borderRadius: 'var(--radius-sm)',
              }}>
                {testResult[provider.id].success ? '✓' : '✗'} {testResult[provider.id].msg}
              </div>
            )}
          </div>
          
          {/* Model Selection */}
          {config.activeProvider === provider.id && (
            <div style={{ padding: '0 var(--space-md) var(--space-md)' }}>
              <label style={{
                display: 'block',
                fontSize: 12,
                color: 'var(--text-tertiary)',
                marginBottom: 'var(--space-xs)',
              }}>
                Modelo
              </label>
              <select
                value={config.activeModel}
                onChange={(e) => updateConfig({ activeModel: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px var(--space-md)',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-primary)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  fontSize: 13,
                  outline: 'none',
                }}
              >
                {provider.models.map((m: any) => (
                  <option key={m.id} value={m.id}>
                    {m.name} {m.contextLength ? `(${(m.contextLength / 1024).toFixed(0)}K)` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function GeneralTab({ config, updateConfig }: { config: AppConfig; updateConfig: (u: Partial<AppConfig>) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
      <h3 style={{ color: 'var(--text-primary)', fontSize: 16 }}>Configuración General</h3>
      
      {/* Temperature */}
      <SettingRow label="Temperatura" description="Controla la creatividad de las respuestas (0.0 - 2.0)">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={config.temperature}
            onChange={(e) => updateConfig({ temperature: parseFloat(e.target.value) })}
            style={{ flex: 1, accentColor: 'var(--accent-primary)' }}
          />
          <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', width: 40 }}>
            {config.temperature.toFixed(1)}
          </span>
        </div>
      </SettingRow>
      
      {/* Max Tokens */}
      <SettingRow label="Max Tokens" description="Longitud máxima de la respuesta">
        <select
          value={config.maxTokens}
          onChange={(e) => updateConfig({ maxTokens: parseInt(e.target.value) })}
          style={{
            padding: '8px var(--space-md)',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-primary)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-primary)',
            fontSize: 13,
            outline: 'none',
          }}
        >
          <option value={2048}>2K</option>
          <option value={4096}>4K</option>
          <option value={8192}>8K</option>
          <option value={16384}>16K</option>
          <option value={32768}>32K</option>
        </select>
      </SettingRow>
      
      {/* Streaming */}
      <SettingRow label="Streaming" description="Mostrar respuestas en tiempo real">
        <Toggle checked={config.streaming} onChange={(v) => updateConfig({ streaming: v })} />
      </SettingRow>
      
      {/* Approval Mode */}
      <SettingRow label="Modo de aprobacion" description="Como manejar la ejecucion de herramientas">
        <select
          value={config.approvalMode}
          onChange={(e) => updateConfig({ approvalMode: e.target.value as any })}
          style={{
            padding: '8px var(--space-md)',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-primary)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-primary)',
            fontSize: 13,
            outline: 'none',
          }}
        >
          <option value="ask">Preguntar siempre</option>
          <option value="auto_edit">Auto-editar (pedir para shell)</option>
          <option value="yolo">YOLO (auto-todo)</option>
        </select>
      </SettingRow>
      
      {/* Max Agent Steps */}
      <SettingRow label="Max pasos del agente" description="Limite de iteraciones del loop agentic (prevenir loops infinitos)">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
          <input
            type="range"
            min="5"
            max="50"
            step="5"
            value={config.maxAgentSteps || 25}
            onChange={(e) => updateConfig({ maxAgentSteps: parseInt(e.target.value) })}
            style={{ flex: 1, accentColor: 'var(--accent-primary)' }}
          />
          <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', width: 30 }}>
            {config.maxAgentSteps || 25}
          </span>
        </div>
      </SettingRow>
      
      {/* Font Size */}
      <SettingRow label="Tamaño de fuente" description="Tamaño del texto en el chat">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
          <input
            type="range"
            min="12"
            max="20"
            step="1"
            value={config.fontSize}
            onChange={(e) => updateConfig({ fontSize: parseInt(e.target.value) })}
            style={{ flex: 1, accentColor: 'var(--accent-primary)' }}
          />
          <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', width: 30 }}>
            {config.fontSize}
          </span>
        </div>
      </SettingRow>
      
      {/* Low RAM Mode */}
      <SettingRow label="Modo bajo RAM" description="Reduce el uso de memoria en dispositivos con poca RAM">
        <Toggle checked={config.lowRamMode} onChange={(v) => updateConfig({ lowRamMode: v })} />
      </SettingRow>
      
      {/* System Prompt */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-primary)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-md)',
      }}>
        <label style={{
          display: 'block',
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--text-primary)',
          marginBottom: 'var(--space-xs)',
        }}>
          System Prompt
        </label>
        <textarea
          value={config.systemPrompt}
          onChange={(e) => updateConfig({ systemPrompt: e.target.value })}
          rows={6}
          style={{
            width: '100%',
            padding: '8px var(--space-md)',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-primary)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-primary)',
            fontSize: 12,
            fontFamily: 'var(--font-mono)',
            outline: 'none',
            resize: 'vertical',
          }}
        />
      </div>
    </div>
  );
}

function ProxyTab({ config, updateConfig }: { config: AppConfig; updateConfig: (u: Partial<AppConfig>) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
      <h3 style={{ color: 'var(--text-primary)', fontSize: 16 }}>Configuración de Proxy</h3>
      <p style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>
        El proxy permite conectarte a las APIs desde Cuba, redirigiendo el tráfico a través de un servidor intermedio.
      </p>
      
      <SettingRow label="Proxy habilitado" description="Activar proxy para todas las conexiones API">
        <Toggle checked={config.proxyEnabled} onChange={(v) => updateConfig({ proxyEnabled: v })} />
      </SettingRow>
      
      <SettingRow label="URL del Proxy" description="Servidor proxy base URL">
        <input
          type="text"
          value={config.proxyBaseUrl}
          onChange={(e) => updateConfig({ proxyBaseUrl: e.target.value })}
          style={{
            width: '100%',
            padding: '8px var(--space-md)',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-primary)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--accent-secondary)',
            fontSize: 13,
            fontFamily: 'var(--font-mono)',
            outline: 'none',
          }}
        />
      </SettingRow>
      
      {/* Proxy URLs per provider */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-primary)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: 'var(--space-md)',
          borderBottom: '1px solid var(--border-secondary)',
          fontWeight: 600,
          fontSize: 13,
        }}>
          URLs de Proxy por Proveedor
        </div>
        {config.providers.map((p: Provider) => (
          <div key={p.id} style={{
            padding: 'var(--space-sm) var(--space-md)',
            borderBottom: '1px solid var(--border-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-sm)',
            fontSize: 12,
          }}>
            <span style={{ color: 'var(--text-secondary)', width: 80, flexShrink: 0 }}>{p.name}:</span>
            <span style={{ color: 'var(--accent-secondary)', fontFamily: 'var(--font-mono)' }}>
              {p.proxyBaseUrl}
            </span>
          </div>
        ))}
      </div>
      
      <div style={{
        background: 'rgba(107, 107, 255, 0.05)',
        border: '1px solid var(--border-primary)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-md)',
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-secondary)', marginBottom: 'var(--space-xs)' }}>
          🇨🇺 Información para Cuba
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          El proxy iql está configurado por defecto para permitir el acceso a las APIs desde Cuba.
          Esto redirige todas las peticiones a través de un servidor que no tiene restricciones geográficas.
          Si experimentas problemas, verifica que el proxy esté habilitado y que la URL sea correcta.
        </div>
      </div>
    </div>
  );
}

function AboutTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', alignItems: 'center', padding: 'var(--space-xl)' }}>
      <div style={{
        width: 80,
        height: 80,
        borderRadius: 'var(--radius-xl)',
        background: 'linear-gradient(135deg, var(--accent-primary), #8b5cf6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 36,
        fontWeight: 700,
        boxShadow: '0 0 40px rgba(107, 107, 255, 0.3)',
      }}>
        Q
      </div>
      
      <h2 style={{ color: 'var(--text-primary)', fontSize: 24, fontWeight: 700 }}>Qwen Code</h2>
      <p style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>v2.0.0 — Agentic Edition</p>
      
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-primary)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-lg)',
        maxWidth: 400,
        width: '100%',
        fontSize: 13,
        color: 'var(--text-secondary)',
        lineHeight: 1.8,
      }}>
        <div>🤖 Agente autonomo con loop agentic</div>
        <div>⚡ Ejecucion de codigo (Python, JS, Bash)</div>
        <div>💻 Comandos shell completos</div>
        <div>📁 Sistema de archivos completo</div>
        <div>🔧 13 herramientas disponibles</div>
        <div>🧠 Razonamiento visible paso a paso</div>
        <div>🌐 Soporte de proxy para Cuba</div>
        <div>📱 Compatible 32/64 bits</div>
      </div>
      
      <div style={{
        fontSize: 11,
        color: 'var(--text-tertiary)',
        textAlign: 'center',
        marginTop: 'var(--space-md)',
      }}>
        Inspirado en Qwen Code (QwenLM)
        <br />
        Hecho con ❤️ para Cuba
      </div>
    </div>
  );
}

function SettingRow({ label, description, children }: { label: string; description: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-primary)',
      borderRadius: 'var(--radius-md)',
      padding: 'var(--space-md)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-md)' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{label}</div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{description}</div>
        </div>
        {children}
      </div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      onClick={() => onChange(!checked)}
      style={{
        width: 44,
        height: 24,
        borderRadius: 12,
        background: checked ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
        cursor: 'pointer',
        position: 'relative',
        transition: 'background var(--transition-fast)',
        flexShrink: 0,
      }}
    >
      <div style={{
        width: 18,
        height: 18,
        borderRadius: '50%',
        background: 'white',
        position: 'absolute',
        top: 3,
        left: checked ? 23 : 3,
        transition: 'left var(--transition-fast)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
      }} />
    </div>
  );
}
