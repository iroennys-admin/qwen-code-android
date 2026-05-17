import { registerPlugin, Capacitor } from '@capacitor/core';

// ==========================================
// OpenCode Bridge Plugin Interface & Registration
// ==========================================

interface OpenCodeBridgePlugin {
  // Setup methods
  checkSetup(): Promise<{ 
    setupStatus: string;
    prootInstalled: boolean;
    ubuntuInstalled: boolean;
    opencodeInstalled: boolean;
    prootPath: string;
    ubuntuRootPath: string;
  }>;
  setupProot(): Promise<{ value: boolean; error?: string }>;
  setupUbuntu(): Promise<{ value: boolean; error?: string }>;
  installOpenCode(): Promise<{ value: boolean; error?: string }>;
  fullSetup(): Promise<{ value: boolean; error?: string }>;
  
  // Terminal PTY methods
  startOpenCodeSession(options: { workingDir?: string }): Promise<{ sessionId: string }>;
  writeInput(options: { sessionId: string; data: string }): Promise<{ value: boolean }>;
  resizeTerminal(options: { sessionId: string; cols: number; rows: number }): Promise<{ value: boolean }>;
  killSession(options: { sessionId: string }): Promise<{ value: boolean }>;
  
  // Direct proot shell
  executeProotCommand(options: { command: string; timeout?: number }): Promise<{ stdout: string; stderr: string; exitCode: number }>;
}

const OpenCodeBridge = registerPlugin<OpenCodeBridgePlugin>('OpenCodeBridge');

export { OpenCodeBridge };
export type { OpenCodeBridgePlugin };

/**
 * Check if OpenCode is available (running on native platform).
 */
export function isOpenCodeAvailable(): boolean {
  return Capacitor.isNativePlatform();
}
