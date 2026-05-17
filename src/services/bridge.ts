// ==========================================
// OpenCode Android - Native Bridge
// ==========================================

import type { ShellResult, ToolType } from '../types';
import { registerPlugin, Capacitor } from '@capacitor/core';

const OpenCodeBridge = registerPlugin<any>('OpenCodeBridge');

export function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

// ---- Shell ----
export async function executeShell(command: string, timeout: number = 30): Promise<ShellResult> {
  if (!isNative()) {
    return {
      stdout: `[Simulated] ${command}`,
      stderr: '',
      exitCode: 0,
    };
  }
  try {
    const result = await OpenCodeBridge.executeShell({ command, timeout });
    return {
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      exitCode: result.exitCode ?? 0,
    };
  } catch (err: any) {
    return { stdout: '', stderr: err.message, exitCode: 1 };
  }
}

// ---- File Operations ----
export async function readFile(path: string): Promise<string> {
  if (!isNative()) return `[File content of ${path}]`;
  try {
    const result = await OpenCodeBridge.readFile({ path });
    return result.content || '';
  } catch (err: any) {
    throw new Error(`Cannot read file: ${err.message}`);
  }
}

export async function writeFile(path: string, content: string): Promise<void> {
  if (!isNative()) return;
  try {
    await OpenCodeBridge.writeFile({ path, content });
  } catch (err: any) {
    throw new Error(`Cannot write file: ${err.message}`);
  }
}

export async function editFile(path: string, oldText: string, newText: string): Promise<void> {
  if (!isNative()) return;
  try {
    await OpenCodeBridge.fileEdit({ path, oldText, newText });
  } catch (err: any) {
    throw new Error(`Cannot edit file: ${err.message}`);
  }
}

export async function listDir(path: string, showHidden: boolean = false): Promise<any[]> {
  if (!isNative()) return [];
  try {
    const result = await OpenCodeBridge.listDir({ path, showHidden });
    return result.entries || [];
  } catch (err: any) {
    throw new Error(`Cannot list directory: ${err.message}`);
  }
}

export async function makeDir(path: string): Promise<void> {
  if (!isNative()) return;
  try {
    await OpenCodeBridge.mkdir({ path });
  } catch (err: any) {
    throw new Error(`Cannot create directory: ${err.message}`);
  }
}

export async function deletePath(path: string, recursive: boolean = false): Promise<void> {
  if (!isNative()) return;
  try {
    await OpenCodeBridge.delete({ path, recursive });
  } catch (err: any) {
    throw new Error(`Cannot delete: ${err.message}`);
  }
}

export async function movePath(source: string, destination: string): Promise<void> {
  if (!isNative()) return;
  try {
    await OpenCodeBridge.move({ source, destination });
  } catch (err: any) {
    throw new Error(`Cannot move: ${err.message}`);
  }
}

export async function copyPath(source: string, destination: string): Promise<void> {
  if (!isNative()) return;
  try {
    await OpenCodeBridge.copy({ source, destination });
  } catch (err: any) {
    throw new Error(`Cannot copy: ${err.message}`);
  }
}

export async function fileExists(path: string): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const result = await OpenCodeBridge.exists({ path });
    return result.exists || false;
  } catch {
    return false;
  }
}

export async function httpRequest(url: string, method: string = 'GET', body?: string, headers?: Record<string, string>, timeout: number = 60): Promise<{ status: number; body: string }> {
  if (!isNative()) {
    try {
      const resp = await fetch(url, { method, body, headers });
      return { status: resp.status, body: await resp.text() };
    } catch (err: any) {
      return { status: 0, body: err.message };
    }
  }
  try {
    const result = await OpenCodeBridge.httpRequest({
      url, method, body, headers: JSON.stringify(headers || {}), timeout,
    });
    return { status: result.status || 0, body: result.body || '' };
  } catch (err: any) {
    return { status: 0, body: err.message };
  }
}

// ---- Tool Execution Dispatcher ----
export async function executeToolCall(name: string, params: Record<string, unknown>, config: any): Promise<{ output: string; stdout?: string }> {
  switch (name) {
    case 'shell': {
      const result = await executeShell(String(params.command || ''), Number(params.timeout) || 30);
      let output = '';
      if (result.stdout) output += result.stdout;
      if (result.stderr) output += (output ? '\n' : '') + result.stderr;
      if (result.exitCode !== 0) output += `\n[Exit code: ${result.exitCode}]`;
      return { output, stdout: result.stdout };
    }

    case 'file_read': {
      const content = await readFile(String(params.path));
      return { output: content };
    }

    case 'file_write': {
      await writeFile(String(params.path), String(params.content || ''));
      return { output: `File written: ${params.path}` };
    }

    case 'file_edit': {
      await editFile(String(params.path), String(params.old_text || ''), String(params.new_text || ''));
      return { output: `File edited: ${params.path}` };
    }

    case 'list_dir': {
      const entries = await listDir(String(params.path || '/sdcard'), Boolean(params.show_hidden));
      const lines = entries.map((e: any) =>
        `${e.isDir ? '📁' : '📄'} ${e.name}${e.isDir ? '/' : ''}${e.size ? ` (${formatSize(e.size)})` : ''}`
      );
      return { output: lines.join('\n') || 'Empty directory' };
    }

    case 'glob': {
      const pattern = String(params.pattern || '**/*');
      const path = String(params.path || '/sdcard');
      const result = await executeShell(`find "${path}" -name "${pattern}" 2>/dev/null | head -50`, 10);
      return { output: result.stdout || 'No files found' };
    }

    case 'grep': {
      const pattern = String(params.pattern || '');
      const path = String(params.path || '/sdcard');
      const filePattern = params.file_pattern ? ` --include="${params.file_pattern}"` : '';
      const result = await executeShell(`grep -rn${filePattern} "${pattern}" "${path}" 2>/dev/null | head -30`, 10);
      return { output: result.stdout || 'No matches found' };
    }

    case 'web_fetch': {
      const result = await httpRequest(String(params.url || ''), 'GET', undefined, {
        'User-Agent': 'Mozilla/5.0 (Android) AppleWebKit/537.36',
      }, 30);
      // Truncate large responses
      const body = result.body?.substring(0, 10000) || 'No content';
      return { output: body };
    }

    case 'web_search': {
      // Use a simple search approach
      const query = String(params.query || params.pattern || '');
      const result = await httpRequest(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json`, 'GET');
      return { output: result.body?.substring(0, 5000) || 'No results' };
    }

    case 'mkdir': {
      await makeDir(String(params.path));
      return { output: `Directory created: ${params.path}` };
    }

    case 'rm': {
      await deletePath(String(params.path), Boolean(params.recursive));
      return { output: `Deleted: ${params.path}` };
    }

    case 'mv': {
      await movePath(String(params.source), String(params.destination));
      return { output: `Moved: ${params.source} → ${params.destination}` };
    }

    case 'cp': {
      await copyPath(String(params.source), String(params.destination));
      return { output: `Copied: ${params.source} → ${params.destination}` };
    }

    case 'code_execute': {
      const result = await executeShell(String(params.command || params.code || ''), 60);
      let output = '';
      if (result.stdout) output += result.stdout;
      if (result.stderr) output += (output ? '\n' : '') + result.stderr;
      return { output, stdout: result.stdout };
    }

    default:
      return { output: `Unknown tool: ${name}` };
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
