import type { ShellResult } from '../types';

// Bridge to native Android shell execution via Capacitor
declare global {
  interface Window {
    QwenCodeBridge?: {
      executeShell: (command: string, timeout: number) => Promise<ShellResult>;
      readFile: (path: string) => Promise<string>;
      writeFile: (path: string, content: string) => Promise<boolean>;
      listDir: (path: string) => Promise<string[]>;
      exists: (path: string) => Promise<boolean>;
      delete: (path: string) => Promise<boolean>;
      getHomeDir: () => Promise<string>;
      getWorkingDir: () => Promise<string>;
      setWorkingDir: (dir: string) => Promise<boolean>;
      isCapacitor: () => boolean;
    };
    AndroidBridge?: {
      executeShell: (command: string, timeout: number) => string;
      readFile: (path: string) => string;
      writeFile: (path: string, content: string) => boolean;
    };
  }
}

const isNative = (): boolean => {
  return !!(window.QwenCodeBridge?.isCapacitor?.() || window.AndroidBridge);
};

// Shell command execution
export async function executeShell(command: string, timeout: number = 30): Promise<ShellResult> {
  if (window.QwenCodeBridge) {
    try {
      return await window.QwenCodeBridge.executeShell(command, timeout);
    } catch (err: any) {
      return { stdout: '', stderr: err.message, exitCode: -1 };
    }
  }
  
  // Fallback: simulated shell for web/development
  return simulateShell(command);
}

function simulateShell(command: string): ShellResult {
  const cmd = command.trim().toLowerCase();
  
  if (cmd === 'pwd') {
    return { stdout: '/home/user', stderr: '', exitCode: 0 };
  }
  if (cmd.startsWith('echo ')) {
    return { stdout: command.slice(5).replace(/^["']|["']$/g, ''), stderr: '', exitCode: 0 };
  }
  if (cmd === 'whoami') {
    return { stdout: 'user', stderr: '', exitCode: 0 };
  }
  if (cmd === 'uname -a' || cmd === 'uname') {
    return { stdout: 'Linux localhost 5.15.0-android #1 SMP aarch64 Android', stderr: '', exitCode: 0 };
  }
  if (cmd.startsWith('ls')) {
    return { stdout: 'Documents\nDownloads\nPictures\nMusic\nVideos\nprojects', stderr: '', exitCode: 0 };
  }
  if (cmd === 'date') {
    return { stdout: new Date().toString(), stderr: '', exitCode: 0 };
  }
  if (cmd === 'hostname') {
    return { stdout: 'android', stderr: '', exitCode: 0 };
  }
  if (cmd.startsWith('cat ')) {
    return { stdout: `[Contents of ${command.slice(4)}]`, stderr: '', exitCode: 0 };
  }
  
  return { 
    stdout: '', 
    stderr: `Shell execution is only available in the Android app. Command: ${command}`, 
    exitCode: 127 
  };
}

// File operations
export async function readFile(path: string): Promise<string> {
  if (window.QwenCodeBridge) {
    return await window.QwenCodeBridge.readFile(path);
  }
  return `[File content of ${path} - available in Android app]`;
}

export async function writeFile(path: string, content: string): Promise<boolean> {
  if (window.QwenCodeBridge) {
    return await window.QwenCodeBridge.writeFile(path, content);
  }
  console.log(`[Would write to ${path}]: ${content.substring(0, 100)}...`);
  return true;
}

export async function listDir(path: string): Promise<string[]> {
  if (window.QwenCodeBridge) {
    return await window.QwenCodeBridge.listDir(path);
  }
  return ['Documents', 'Downloads', 'Pictures', 'Music', 'Videos', 'projects'];
}

export async function fileExists(path: string): Promise<boolean> {
  if (window.QwenCodeBridge) {
    return await window.QwenCodeBridge.exists(path);
  }
  return false;
}

export async function getHomeDir(): Promise<string> {
  if (window.QwenCodeBridge) {
    return await window.QwenCodeBridge.getHomeDir();
  }
  return '/home/user';
}

// Execute a tool call and return the result
export async function executeToolCall(
  toolName: string, 
  params: Record<string, any>
): Promise<{ output: string; error?: string }> {
  try {
    switch (toolName) {
      case 'shell': {
        const result = await executeShell(params.command, params.timeout || 30);
        let output = '';
        if (result.stdout) output += result.stdout;
        if (result.stderr) output += (output ? '\n' : '') + result.stderr;
        if (result.exitCode !== 0) {
          return { output, error: `Exit code: ${result.exitCode}` };
        }
        return { output: output || '(no output)' };
      }
      
      case 'file_read': {
        const content = await readFile(params.path);
        return { output: content };
      }
      
      case 'file_write': {
        const success = await writeFile(params.path, params.content);
        return { output: success ? `File written: ${params.path}` : 'Failed to write file', error: success ? undefined : 'Write failed' };
      }
      
      case 'file_edit': {
        const content = await readFile(params.path);
        if (!content.includes(params.old_text)) {
          return { output: '', error: `Text not found in ${params.path}` };
        }
        const newContent = content.replace(params.old_text, params.new_text);
        const success = await writeFile(params.path, newContent);
        return { output: success ? `File edited: ${params.path}` : 'Failed to edit file', error: success ? undefined : 'Edit failed' };
      }
      
      case 'web_fetch': {
        try {
          const response = await fetch(params.url);
          const text = await response.text();
          return { output: text.substring(0, 10000) };
        } catch (err: any) {
          return { output: '', error: `Fetch failed: ${err.message}` };
        }
      }
      
      case 'glob': {
        const dir = params.path || await getHomeDir();
        const result = await executeShell(`find "${dir}" -name "${params.pattern}" 2>/dev/null | head -50`);
        return { output: result.stdout || 'No matches found' };
      }
      
      case 'grep': {
        const dir = params.path || await getHomeDir();
        const includeFlag = params.include ? ` --include="${params.include}"` : '';
        const result = await executeShell(`grep -r${includeFlag} "${params.pattern}" "${dir}" 2>/dev/null | head -50`);
        return { output: result.stdout || 'No matches found' };
      }
      
      default:
        return { output: '', error: `Unknown tool: ${toolName}` };
    }
  } catch (err: any) {
    return { output: '', error: err.message };
  }
}

export { isNative };
