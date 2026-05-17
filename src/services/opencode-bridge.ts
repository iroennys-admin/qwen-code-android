// ==========================================
// OpenCode Android - Proot Bridge
// ==========================================

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
 * Check if OpenCode proot mode is available (running on native platform).
 */
export function isOpenCodeAvailable(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Check if the device supports proot mode (arm64 only for OpenCode binary).
 * 32-bit devices (armeabi-v7a) can use the API mode but not proot mode.
 */
export function isProotModeSupported(): boolean {
  // Proot mode requires arm64 for the OpenCode binary
  // The OpenCode binary is only available for linux-arm64 and linux-x64
  // On Android, only arm64 devices can run it via proot
  if (!Capacitor.isNativePlatform()) return false;

  // We'd need to check the device ABI - for now, we'll check at runtime
  // through the bridge plugin. Return true to allow checking.
  return true;
}
