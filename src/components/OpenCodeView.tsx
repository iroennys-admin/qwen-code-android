import React, { useState, useEffect, useRef, useCallback } from 'react';
import { OpenCodeBridge, isOpenCodeAvailable } from '../services/opencode-bridge';
import type { OpenCodeSetupStatus, OpenCodeSetupProgress } from '../types';
import '@xterm/xterm/css/xterm.css';

interface OpenCodeViewProps {
  config: any;
}

export default function OpenCodeView({ config }: OpenCodeViewProps) {
  const [setupStatus, setSetupStatus] = useState<OpenCodeSetupStatus>('not_installed');
  const [progress, setProgress] = useState<OpenCodeSetupProgress | null>(null);
  const [isTerminalActive, setIsTerminalActive] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [prootInstalled, setProotInstalled] = useState(false);
  const [ubuntuInstalled, setUbuntuInstalled] = useState(false);
  const [opencodeInstalled, setOpenCodeInstalled] = useState(false);
  const [isStartingSession, setIsStartingSession] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<any>(null);
  const fitAddonRef = useRef<any>(null);
  const listenerRef = useRef<any>(null);

  // Check setup status on mount
  const checkSetup = useCallback(async () => {
    if (!isOpenCodeAvailable()) return;
    try {
      const result = await OpenCodeBridge.checkSetup();
      setProotInstalled(result.prootInstalled);
      setUbuntuInstalled(result.ubuntuInstalled);
      setOpenCodeInstalled(result.opencodeInstalled);
      
      if (result.opencodeInstalled && result.ubuntuInstalled && result.prootInstalled) {
        setSetupStatus('installed');
      } else if (result.setupStatus === 'installing') {
        setSetupStatus('installing');
      } else if (result.setupStatus === 'error') {
        setSetupStatus('error');
      } else {
        setSetupStatus('not_installed');
      }
    } catch (err: any) {
      console.error('Failed to check OpenCode setup:', err);
      setSetupStatus('not_installed');
    }
  }, []);

  useEffect(() => {
    checkSetup();
    return () => {
      // Cleanup session on unmount
      if (sessionId) {
        OpenCodeBridge.killSession({ sessionId }).catch(() => {});
      }
      if (listenerRef.current) {
        listenerRef.current.remove();
      }
    };
  }, []);

  // Setup progress listener
  useEffect(() => {
    if (isSettingUp) {
      // Simulate progress steps during setup
      const steps: OpenCodeSetupProgress[] = [
        { step: 'proot', progress: 10, message: 'Instalando proot-distro...' },
        { step: 'proot', progress: 30, message: 'Configurando proot-distro...' },
        { step: 'ubuntu', progress: 40, message: 'Descargando Ubuntu rootfs...' },
        { step: 'ubuntu', progress: 60, message: 'Instalando Ubuntu...' },
        { step: 'ubuntu', progress: 75, message: 'Configurando Ubuntu...' },
        { step: 'opencode', progress: 80, message: 'Descargando OpenCode...' },
        { step: 'opencode', progress: 90, message: 'Instalando OpenCode...' },
        { step: 'opencode', progress: 95, message: 'Configurando entorno...' },
        { step: 'done', progress: 100, message: 'Instalación completa!' },
      ];
      
      let i = 0;
      const interval = setInterval(() => {
        if (i < steps.length) {
          setProgress(steps[i]);
          i++;
        } else {
          clearInterval(interval);
        }
      }, 2000);
      
      return () => clearInterval(interval);
    }
  }, [isSettingUp]);

  // Full setup
  const handleFullSetup = useCallback(async () => {
    setIsSettingUp(true);
    setSetupError(null);
    setSetupStatus('installing');
    setProgress({ step: 'proot', progress: 5, message: 'Iniciando instalación...' });
    
    try {
      const result = await OpenCodeBridge.fullSetup();
      if (result.value) {
        setSetupStatus('installed');
        setProotInstalled(true);
        setUbuntuInstalled(true);
        setOpenCodeInstalled(true);
        setProgress({ step: 'done', progress: 100, message: 'Instalación completa!' });
      } else {
        setSetupStatus('error');
        setSetupError(result.error || 'Error desconocido durante la instalación');
      }
    } catch (err: any) {
      setSetupStatus('error');
      setSetupError(err.message || 'Error durante la instalación');
    } finally {
      setIsSettingUp(false);
    }
  }, []);

  // Start terminal session
  const startTerminalSession = useCallback(async () => {
    setIsStartingSession(true);
    try {
      const result = await OpenCodeBridge.startOpenCodeSession({ 
        workingDir: config?.workingDir || '/sdcard' 
      });
      setSessionId(result.sessionId);
      setIsTerminalActive(true);
      initTerminal(result.sessionId);
    } catch (err: any) {
      console.error('Failed to start OpenCode session:', err);
      setSetupError(err.message || 'Error al iniciar sesión de OpenCode');
    } finally {
      setIsStartingSession(false);
    }
  }, [config]);

  // Initialize xterm.js terminal
  const initTerminal = useCallback(async (sid: string) => {
    if (!terminalRef.current) return;
    
    try {
      // Dynamic imports for xterm
      const xtermModule = await import('@xterm/xterm');
      const Terminal = xtermModule.Terminal;
      const { FitAddon } = await import('@xterm/addon-fit');
      
      // Clean up existing terminal
      if (xtermRef.current) {
        xtermRef.current.dispose();
      }
      
      const term = new Terminal({
        cursorBlink: true,
        cursorStyle: 'bar',
        fontSize: 14,
        fontFamily: 'var(--font-mono), "Cascadia Code", "Fira Code", monospace',
        theme: {
          background: '#0d0d1a',
          foreground: '#e0e0ff',
          cursor: '#a855f7',
          cursorAccent: '#0d0d1a',
          selectionBackground: 'rgba(168, 85, 247, 0.3)',
          black: '#1a1a2e',
          red: '#ff6b6b',
          green: '#51cf66',
          yellow: '#ffd43b',
          blue: '#748ffc',
          magenta: '#a855f7',
          cyan: '#22d3ee',
          white: '#e0e0ff',
          brightBlack: '#4a4a6a',
          brightRed: '#ff8787',
          brightGreen: '#69db7c',
          brightYellow: '#ffe066',
          brightBlue: '#91a7ff',
          brightMagenta: '#c084fc',
          brightCyan: '#67e8f9',
          brightWhite: '#ffffff',
        },
        allowTransparency: true,
        scrollback: 5000,
      });
      
      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      
      term.open(terminalRef.current!);
      fitAddon.fit();
      
      xtermRef.current = term;
      fitAddonRef.current = fitAddon;
      
      // Handle terminal input
      term.onData((data: string) => {
        if (sid) {
          OpenCodeBridge.writeInput({ sessionId: sid, data }).catch(console.error);
        }
      });
      
      // Handle resize
      term.onResize(({ cols, rows }: { cols: number; rows: number }) => {
        if (sid) {
          OpenCodeBridge.resizeTerminal({ sessionId: sid, cols, rows }).catch(console.error);
        }
      });
      
      // Listen for output from native bridge
      try {
        // Use window custom events as a fallback for Capacitor events
        const handler = (event: Event) => {
          const customEvent = event as CustomEvent;
          if (term && customEvent.detail?.data) {
            term.write(customEvent.detail.data);
          }
        };
        window.addEventListener('opencode-output', handler);
        // Store cleanup reference
        (listenerRef as any).current = { remove: () => window.removeEventListener('opencode-output', handler) };
      } catch (e) {
        // Fallback: event listener not available in web environment
        console.warn('Capacitor event listener not available');
      }
      
      // Handle window resize
      const handleResize = () => {
        if (fitAddonRef.current) {
          try {
            fitAddonRef.current.fit();
          } catch (e) {
            // Ignore resize errors
          }
        }
      };
      window.addEventListener('resize', handleResize);
      
      // Write welcome message
      term.writeln('\x1b[1;35m  ╔══════════════════════════════════════╗\x1b[0m');
      term.writeln('\x1b[1;35m  ║       OpenCode AI - proot Ubuntu     ║\x1b[0m');
      term.writeln('\x1b[1;35m  ╚══════════════════════════════════════╝\x1b[0m');
      term.writeln('');
      term.writeln('\x1b[90m  Starting OpenCode session...\x1b[0m');
      term.writeln('');
      
      // Resize to fit
      setTimeout(() => {
        if (fitAddonRef.current) {
          try { fitAddonRef.current.fit(); } catch (e) {}
        }
        if (sid) {
          const cols = term.cols;
          const rows = term.rows;
          OpenCodeBridge.resizeTerminal({ sessionId: sid, cols, rows }).catch(() => {});
        }
      }, 100);
    } catch (err) {
      console.error('Failed to initialize xterm:', err);
    }
  }, []);

  // Kill session
  const killSession = useCallback(async () => {
    if (sessionId) {
      try {
        await OpenCodeBridge.killSession({ sessionId });
      } catch (e) {
        // Ignore errors
      }
    }
    if (xtermRef.current) {
      xtermRef.current.dispose();
      xtermRef.current = null;
    }
    if (listenerRef.current) {
      try { listenerRef.current.remove(); } catch (e) {}
      listenerRef.current = null;
    }
    setSessionId(null);
    setIsTerminalActive(false);
  }, [sessionId]);

  // Restart session
  const restartSession = useCallback(async () => {
    await killSession();
    setTimeout(() => startTerminalSession(), 500);
  }, [killSession, startTerminalSession]);

  // Back to setup
  const backToSetup = useCallback(async () => {
    await killSession();
    checkSetup();
  }, [killSession, checkSetup]);

  // ==========================================
  // Not Available View (web/development)
  // ==========================================
  
  if (!isOpenCodeAvailable()) {
    return (
      <div style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-xl)',
        background: 'rgba(0, 0, 0, 0.3)',
        gap: 'var(--space-lg)',
      }}>
        <div style={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 36,
          boxShadow: '0 0 40px rgba(168, 85, 247, 0.3)',
        }}>
          🤖
        </div>
        <div style={{
          fontSize: 22,
          fontWeight: 700,
          color: 'var(--text-primary)',
          textAlign: 'center',
        }}>
          OpenCode AI
        </div>
        <div style={{
          fontSize: 14,
          color: 'var(--text-secondary)',
          textAlign: 'center',
          maxWidth: 320,
          lineHeight: 1.6,
        }}>
          OpenCode con proot-distro solo está disponible en la app Android nativa.
          Instala la APK para ejecutar OpenCode dentro de un entorno Ubuntu en tu dispositivo.
        </div>
        <div style={{
          padding: '12px 20px',
          background: 'rgba(168, 85, 247, 0.1)',
          border: '1px solid rgba(168, 85, 247, 0.3)',
          borderRadius: 'var(--radius-md)',
          color: '#c084fc',
          fontSize: 13,
          textAlign: 'center',
        }}>
          💡 OpenCode corre dentro de un contenedor Ubuntu via proot-distro, proporcionando un entorno Linux completo en Android.
        </div>
      </div>
    );
  }

  // ==========================================
  // Terminal View (Active Session)
  // ==========================================
  
  if (isTerminalActive) {
    return (
      <div style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: '#0d0d1a',
      }}>
        {/* Terminal Toolbar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-sm)',
          padding: '6px var(--space-md)',
          background: 'rgba(15, 15, 30, 0.95)',
          borderBottom: '1px solid rgba(168, 85, 247, 0.2)',
        }}>
          <button
            onClick={backToSetup}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: 'var(--radius-sm)',
              fontSize: 16,
              display: 'flex',
              alignItems: 'center',
            }}
            title="Volver al setup"
          >
            ←
          </button>
          <div style={{ display: 'flex', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f57', display: 'inline-block' }} />
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#febc2e', display: 'inline-block' }} />
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#28c840', display: 'inline-block' }} />
          </div>
          <span style={{
            fontSize: 12,
            color: '#a855f7',
            fontWeight: 600,
            flex: 1,
            textAlign: 'center',
          }}>
            OpenCode AI — proot Ubuntu
          </span>
          <button
            onClick={restartSession}
            style={{
              background: 'rgba(168, 85, 247, 0.15)',
              border: '1px solid rgba(168, 85, 247, 0.3)',
              color: '#c084fc',
              borderRadius: 'var(--radius-sm)',
              padding: '4px 10px',
              fontSize: 11,
              cursor: 'pointer',
              fontWeight: 500,
            }}
            title="Reiniciar sesión"
          >
            ↻ Restart
          </button>
          <button
            onClick={killSession}
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
              borderRadius: 'var(--radius-sm)',
              padding: '4px 10px',
              fontSize: 11,
              cursor: 'pointer',
              fontWeight: 500,
            }}
            title="Terminar sesión"
          >
            ✕ Kill
          </button>
        </div>
        
        {/* Terminal Container */}
        <div 
          ref={terminalRef}
          style={{
            flex: 1,
            padding: '4px',
            overflow: 'hidden',
          }}
        />
      </div>
    );
  }

  // ==========================================
  // Setup View
  // ==========================================
  
  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'rgba(0, 0, 0, 0.3)',
      overflow: 'auto',
    }}>
      {/* Header */}
      <div style={{
        padding: 'var(--space-xl) var(--space-lg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--space-md)',
        background: 'linear-gradient(180deg, rgba(124, 58, 237, 0.15) 0%, transparent 100%)',
      }}>
        <div style={{
          width: 72,
          height: 72,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 32,
          boxShadow: '0 0 40px rgba(168, 85, 247, 0.3)',
        }}>
          🤖
        </div>
        <div style={{
          fontSize: 24,
          fontWeight: 700,
          color: 'var(--text-primary)',
        }}>
          OpenCode AI
        </div>
        <div style={{
          fontSize: 13,
          color: 'var(--text-secondary)',
          textAlign: 'center',
          maxWidth: 300,
          lineHeight: 1.5,
        }}>
          Ejecuta OpenCode AI dentro de un entorno Ubuntu completo en tu dispositivo Android usando proot-distro.
        </div>
      </div>
      
      {/* Status Cards */}
      <div style={{
        padding: '0 var(--space-lg) var(--space-md)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-sm)',
      }}>
        {/* Proot Status */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-md)',
          padding: '12px 16px',
          background: prootInstalled ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255, 255, 255, 0.05)',
          border: `1px solid ${prootInstalled ? 'rgba(34, 197, 94, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
          borderRadius: 'var(--radius-md)',
        }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: 'var(--radius-sm)',
            background: prootInstalled ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
          }}>
            {prootInstalled ? '✅' : '⬜'}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
              proot-distro
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              {prootInstalled ? 'Instalado' : 'No instalado'}
            </div>
          </div>
          {prootInstalled && (
            <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 500 }}>OK</span>
          )}
        </div>
        
        {/* Ubuntu Status */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-md)',
          padding: '12px 16px',
          background: ubuntuInstalled ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255, 255, 255, 0.05)',
          border: `1px solid ${ubuntuInstalled ? 'rgba(34, 197, 94, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
          borderRadius: 'var(--radius-md)',
        }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: 'var(--radius-sm)',
            background: ubuntuInstalled ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
          }}>
            {ubuntuInstalled ? '✅' : '⬜'}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
              Ubuntu Rootfs
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              {ubuntuInstalled ? 'Instalado' : 'No instalado'}
            </div>
          </div>
          {ubuntuInstalled && (
            <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 500 }}>OK</span>
          )}
        </div>
        
        {/* OpenCode Status */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-md)',
          padding: '12px 16px',
          background: opencodeInstalled ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255, 255, 255, 0.05)',
          border: `1px solid ${opencodeInstalled ? 'rgba(34, 197, 94, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
          borderRadius: 'var(--radius-md)',
        }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: 'var(--radius-sm)',
            background: opencodeInstalled ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
          }}>
            {opencodeInstalled ? '✅' : '⬜'}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
              OpenCode Binary
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              {opencodeInstalled ? 'Instalado' : 'No instalado'}
            </div>
          </div>
          {opencodeInstalled && (
            <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 500 }}>OK</span>
          )}
        </div>
      </div>
      
      {/* Progress Bar */}
      {isSettingUp && progress && (
        <div style={{
          padding: '0 var(--space-lg) var(--space-md)',
        }}>
          <div style={{
            marginBottom: 'var(--space-xs)',
            fontSize: 13,
            color: '#c084fc',
            fontWeight: 500,
          }}>
            {progress.message}
          </div>
          <div style={{
            height: 6,
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: 'var(--radius-full)',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${progress.progress}%`,
              background: 'linear-gradient(90deg, #7c3aed, #a855f7)',
              borderRadius: 'var(--radius-full)',
              transition: 'width 0.5s ease',
            }} />
          </div>
          <div style={{
            marginTop: 'var(--space-xs)',
            fontSize: 11,
            color: 'var(--text-tertiary)',
            textAlign: 'right',
          }}>
            {progress.progress}%
          </div>
        </div>
      )}
      
      {/* Error Display */}
      {setupError && (
        <div style={{
          margin: '0 var(--space-lg) var(--space-md)',
          padding: '12px 16px',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: 'var(--radius-md)',
          color: '#f87171',
          fontSize: 13,
          lineHeight: 1.5,
        }}>
          ⚠️ {setupError}
        </div>
      )}
      
      {/* Action Buttons */}
      <div style={{
        padding: '0 var(--space-lg) var(--space-lg)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-sm)',
      }}>
        {setupStatus === 'installed' ? (
          <>
            <button
              onClick={startTerminalSession}
              disabled={isStartingSession}
              style={{
                width: '100%',
                padding: '14px',
                background: isStartingSession 
                  ? 'rgba(168, 85, 247, 0.3)' 
                  : 'linear-gradient(135deg, #7c3aed, #a855f7)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                color: 'white',
                fontSize: 16,
                fontWeight: 600,
                cursor: isStartingSession ? 'not-allowed' : 'pointer',
                transition: 'all var(--transition-fast)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--space-sm)',
                boxShadow: isStartingSession ? 'none' : '0 4px 20px rgba(168, 85, 247, 0.3)',
              }}
            >
              {isStartingSession ? (
                <>
                  <span style={{ animation: 'pulse 1s infinite' }}>●</span>
                  Iniciando OpenCode...
                </>
              ) : (
                <>
                  🚀 Iniciar OpenCode
                </>
              )}
            </button>
            <button
              onClick={handleFullSetup}
              disabled={isSettingUp}
              style={{
                width: '100%',
                padding: '10px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-secondary)',
                fontSize: 13,
                cursor: isSettingUp ? 'not-allowed' : 'pointer',
              }}
            >
              🔄 Reinstalar OpenCode
            </button>
          </>
        ) : (
          <button
            onClick={handleFullSetup}
            disabled={isSettingUp}
            style={{
              width: '100%',
              padding: '16px',
              background: isSettingUp 
                ? 'rgba(168, 85, 247, 0.3)' 
                : 'linear-gradient(135deg, #7c3aed, #a855f7)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              color: 'white',
              fontSize: 17,
              fontWeight: 600,
              cursor: isSettingUp ? 'not-allowed' : 'pointer',
              transition: 'all var(--transition-fast)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--space-sm)',
              boxShadow: isSettingUp ? 'none' : '0 4px 24px rgba(168, 85, 247, 0.4)',
            }}
          >
            {isSettingUp ? (
              <>
                <span style={{ animation: 'pulse 1s infinite' }}>●</span>
                Instalando...
              </>
            ) : (
              <>
                ⬇️ Instalar OpenCode
              </>
            )}
          </button>
        )}
      </div>
      
      {/* Info Footer */}
      <div style={{
        padding: 'var(--space-md) var(--space-lg)',
        borderTop: '1px solid var(--border-primary)',
        marginTop: 'auto',
      }}>
        <div style={{
          fontSize: 12,
          color: 'var(--text-tertiary)',
          lineHeight: 1.6,
        }}>
          <div style={{ marginBottom: 'var(--space-xs)', color: '#a855f7', fontWeight: 500 }}>
            ¿Qué es OpenCode con proot?
          </div>
          <div>
            • <strong>proot-distro</strong> crea un entorno Linux completo sin root
          </div>
          <div>
            • <strong>Ubuntu</strong> proporciona las herramientas del sistema
          </div>
          <div>
            • <strong>OpenCode</strong> es un agente de IA para programación
          </div>
          <div style={{ marginTop: 'var(--space-xs)', fontSize: 11, color: 'var(--text-tertiary)' }}>
            La instalación inicial puede tardar varios minutos según tu conexión.
          </div>
        </div>
      </div>
    </div>
  );
}
