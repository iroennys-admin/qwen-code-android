// ==========================================
// OpenCode Android v2 - Native Bridge
// ==========================================

import type { ShellResult, AppConfig } from '../types';
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
export async function executeShell(command: string, timeout: number = 60, cwd?: string): Promise<ShellResult> {
  if (!isNative()) {
    return { stdout: `[Web preview] ${command}`, stderr: '', exitCode: 0 };
  }
  try {
    const result = await OpenCodeBridge.executeShell({ command, timeout, cwd: cwd || '' });
    return {
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      exitCode: result.exitCode ?? 0,
    };
  } catch (err: any) {
    return { stdout: '', stderr: err?.message || String(err), exitCode: 1 };
  }
}

// ---- File Operations ----
export async function readFile(path: string, startLine?: number, endLine?: number): Promise<string> {
  if (!isNative()) return `[Web preview file ${path}]`;
  try {
    const result = await OpenCodeBridge.readFile({ path });
    let content = result.content || '';
    if (startLine || endLine) {
      const lines = content.split('\n');
      const s = Math.max(0, (startLine || 1) - 1);
      const e = Math.min(lines.length, endLine || lines.length);
      content = lines.slice(s, e).map((l: string, i: number) => `${s + i + 1}: ${l}`).join('\n');
    }
    return content;
  } catch (err: any) {
    throw new Error(`Cannot read file: ${err?.message || err}`);
  }
}

export async function writeFile(path: string, content: string): Promise<void> {
  if (!isNative()) return;
  try {
    await OpenCodeBridge.writeFile({ path, content });
  } catch (err: any) {
    throw new Error(`Cannot write file: ${err?.message || err}`);
  }
}

export async function appendFile(path: string, content: string): Promise<void> {
  if (!isNative()) return;
  try {
    await OpenCodeBridge.appendFile({ path, content });
  } catch (err: any) {
    throw new Error(`Cannot append file: ${err?.message || err}`);
  }
}

export async function editFile(path: string, oldText: string, newText: string): Promise<string> {
  if (!isNative()) return '[web preview]';
  try {
    const result = await OpenCodeBridge.fileEdit({ path, oldText, newText });
    if (result?.error) throw new Error(result.error);
    return result?.message || 'OK';
  } catch (err: any) {
    throw new Error(`Cannot edit file: ${err?.message || err}`);
  }
}

export async function listDir(path: string, showHidden = false): Promise<any[]> {
  if (!isNative()) return [];
  try {
    const result = await OpenCodeBridge.listDir({ path, showHidden });
    return result.entries || [];
  } catch (err: any) {
    throw new Error(`Cannot list directory: ${err?.message || err}`);
  }
}

export async function makeDir(path: string): Promise<void> {
  if (!isNative()) return;
  await OpenCodeBridge.mkdir({ path });
}

export async function deletePath(path: string, recursive = false): Promise<void> {
  if (!isNative()) return;
  await OpenCodeBridge.delete({ path, recursive });
}

export async function movePath(source: string, destination: string): Promise<void> {
  if (!isNative()) return;
  await OpenCodeBridge.move({ source, destination });
}

export async function copyPath(source: string, destination: string): Promise<void> {
  if (!isNative()) return;
  await OpenCodeBridge.copy({ source, destination });
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

export async function httpRequest(
  url: string,
  method = 'GET',
  body?: string,
  headers?: Record<string, string>,
  timeout = 60,
): Promise<{ status: number; body: string }> {
  if (!isNative()) {
    try {
      const resp = await fetch(url, { method, body, headers });
      return { status: resp.status, body: await resp.text() };
    } catch (err: any) {
      return { status: 0, body: err?.message || String(err) };
    }
  }
  try {
    const result = await OpenCodeBridge.httpRequest({
      url, method, body, headers: headers || {}, timeout,
    });
    return { status: result.status || 0, body: result.body || '' };
  } catch (err: any) {
    return { status: 0, body: err?.message || String(err) };
  }
}

export async function readClipboard(): Promise<string> {
  if (!isNative()) {
    try { return await navigator.clipboard.readText(); } catch { return ''; }
  }
  try {
    const r = await OpenCodeBridge.readClipboard({});
    return r?.value || '';
  } catch { return ''; }
}

export async function writeClipboard(text: string): Promise<void> {
  if (!isNative()) {
    try { await navigator.clipboard.writeText(text); } catch {}
    return;
  }
  try { await OpenCodeBridge.writeClipboard({ text }); } catch {}
}

export async function showToast(message: string): Promise<void> {
  if (!isNative()) return;
  try { await OpenCodeBridge.showToast({ message }); } catch {}
}

export async function vibrate(ms = 30): Promise<void> {
  if (!isNative()) {
    try { (navigator as any).vibrate?.(ms); } catch {}
    return;
  }
  try { await OpenCodeBridge.vibrate({ ms }); } catch {}
}

export async function getDeviceInfo(): Promise<any> {
  if (!isNative()) return { manufacturer: 'Web', model: navigator.userAgent };
  try { return await OpenCodeBridge.getDeviceInfo(); } catch { return {}; }
}

// ---- Web search helpers (no key) ----
async function ddgInstant(query: string): Promise<string> {
  const r = await httpRequest(
    `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`,
    'GET', undefined, { 'Accept': 'application/json' }, 20,
  );
  try {
    const j = JSON.parse(r.body);
    const out: string[] = [];
    if (j.AbstractText) out.push(`📌 ${j.AbstractText}\n${j.AbstractURL || ''}`);
    if (j.RelatedTopics?.length) {
      for (const t of j.RelatedTopics.slice(0, 8)) {
        if (t.Text && t.FirstURL) out.push(`• ${t.Text}\n  ${t.FirstURL}`);
      }
    }
    return out.join('\n\n') || 'No instant answer.';
  } catch {
    return r.body.slice(0, 4000);
  }
}

async function ddgHtmlSearch(query: string, n = 5): Promise<string> {
  // DuckDuckGo HTML endpoint (no API key required)
  const r = await httpRequest(
    `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
    'GET', undefined,
    { 'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36' },
    25,
  );
  const html = r.body || '';
  const results: string[] = [];
  // Lightweight regex extraction
  const re = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && results.length < n) {
    const url = decodeURIComponent(m[1].replace(/^.*?uddg=/, '').replace(/&.*$/, '')) || m[1];
    const title = stripHtml(m[2]);
    const snippet = stripHtml(m[3]);
    results.push(`🔎 ${title}\n${url}\n${snippet}`);
  }
  if (!results.length) {
    return (await ddgInstant(query));
  }
  return results.join('\n\n');
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}

async function webFetchClean(url: string, maxChars: number): Promise<string> {
  const r = await httpRequest(url, 'GET', undefined, {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,*/*',
  }, 30);
  let body = r.body || '';
  // Try Jina Reader as a free clean-text fallback for big pages
  if (body.length > 50000 && !url.startsWith('https://r.jina.ai')) {
    try {
      const j = await httpRequest(`https://r.jina.ai/${url}`, 'GET', undefined, {
        'Accept': 'text/plain',
      }, 30);
      if (j.status >= 200 && j.status < 400 && j.body) {
        return j.body.substring(0, maxChars);
      }
    } catch {}
  }
  // Strip HTML to text
  body = body
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return body.substring(0, maxChars) || 'Empty page';
}

// ---- Persistent app state for tools (todos / memory) ----
const STORAGE_TODOS = 'oc_todos_v2';
const STORAGE_MEMORY = 'oc_memory_v2';

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {}
  return fallback;
}
function saveJson(key: string, val: unknown) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

// ---- Tool Execution Dispatcher ----
export async function executeToolCall(
  name: string,
  params: Record<string, any>,
  config: AppConfig,
): Promise<{ output: string }> {
  switch (name) {
    case 'shell':
    case 'code_execute': {
      const result = await executeShell(
        String(params.command || params.code || ''),
        Number(params.timeout) || 60,
        params.cwd ? String(params.cwd) : undefined,
      );
      let output = '';
      if (result.stdout) output += result.stdout;
      if (result.stderr) output += (output ? '\n--- stderr ---\n' : '') + result.stderr;
      if (result.exitCode !== 0) output += `\n[exit code: ${result.exitCode}]`;
      return { output: output || '[no output]' };
    }

    case 'file_read': {
      const content = await readFile(String(params.path), params.start_line, params.end_line);
      return { output: content };
    }

    case 'file_write': {
      await writeFile(String(params.path), String(params.content || ''));
      return { output: `✔ Wrote ${params.path} (${(params.content || '').length} bytes)` };
    }

    case 'file_edit': {
      const msg = await editFile(String(params.path), String(params.old_text || ''), String(params.new_text || ''));
      return { output: `✔ Edited ${params.path}: ${msg}` };
    }

    case 'file_append': {
      await appendFile(String(params.path), String(params.content || ''));
      return { output: `✔ Appended to ${params.path}` };
    }

    case 'list_dir': {
      const entries = await listDir(String(params.path || config.workingDir), Boolean(params.show_hidden));
      const lines = entries.map((e: any) =>
        `${e.isDir ? '📁' : '📄'} ${e.name}${e.isDir ? '/' : ''}${e.size ? ` (${formatSize(e.size)})` : ''}`
      );
      return { output: lines.join('\n') || '(empty)' };
    }

    case 'glob': {
      const pattern = String(params.pattern || '**/*');
      const path = String(params.path || config.workingDir);
      const r = await executeShell(`find "${path}" -path "${pattern.replace(/\*\*/g, '*')}" 2>/dev/null | head -100`, 15);
      return { output: r.stdout || 'No matches.' };
    }

    case 'grep': {
      const pattern = String(params.pattern || '');
      const path = String(params.path || config.workingDir);
      const fp = params.file_pattern ? ` --include="${params.file_pattern}"` : '';
      const r = await executeShell(`grep -rnI${fp} -- "${pattern.replace(/"/g, '\\"')}" "${path}" 2>/dev/null | head -50`, 15);
      return { output: r.stdout || 'No matches.' };
    }

    case 'web_fetch': {
      const max = Number(params.max_chars) || 20000;
      const text = await webFetchClean(String(params.url || ''), max);
      return { output: text };
    }

    case 'web_search': {
      const q = String(params.query || '');
      const n = Number(params.num_results) || 5;
      const out = await ddgHtmlSearch(q, n);
      return { output: out };
    }

    case 'mkdir': {
      await makeDir(String(params.path));
      return { output: `✔ Created ${params.path}` };
    }
    case 'rm': {
      await deletePath(String(params.path), Boolean(params.recursive));
      return { output: `✔ Deleted ${params.path}` };
    }
    case 'mv': {
      await movePath(String(params.source), String(params.destination));
      return { output: `✔ Moved ${params.source} → ${params.destination}` };
    }
    case 'cp': {
      await copyPath(String(params.source), String(params.destination));
      return { output: `✔ Copied ${params.source} → ${params.destination}` };
    }

    case 'todo_add': {
      const todos = loadJson<any[]>(STORAGE_TODOS, []);
      const t = { id: `t_${Date.now()}`, text: String(params.text || ''), done: false, createdAt: Date.now() };
      todos.push(t);
      saveJson(STORAGE_TODOS, todos);
      return { output: `✔ Added TODO ${t.id}: ${t.text}` };
    }
    case 'todo_list': {
      const todos = loadJson<any[]>(STORAGE_TODOS, []);
      if (!todos.length) return { output: '(no todos)' };
      return { output: todos.map(t => `${t.done ? '✅' : '⬜'} [${t.id}] ${t.text}`).join('\n') };
    }
    case 'todo_complete': {
      const todos = loadJson<any[]>(STORAGE_TODOS, []);
      const id = String(params.id);
      const t = todos.find((x: any) => x.id === id);
      if (!t) return { output: `❌ No such todo ${id}` };
      t.done = true;
      saveJson(STORAGE_TODOS, todos);
      return { output: `✔ Completed ${id}` };
    }

    case 'memory_save': {
      const mem = loadJson<Record<string, any>>(STORAGE_MEMORY, {});
      mem[String(params.key)] = { value: String(params.value), updatedAt: Date.now() };
      saveJson(STORAGE_MEMORY, mem);
      return { output: `🧠 Saved memory: ${params.key}` };
    }
    case 'memory_get': {
      const mem = loadJson<Record<string, any>>(STORAGE_MEMORY, {});
      const keys = Object.keys(mem);
      if (!keys.length) return { output: '(no memory)' };
      return { output: keys.map(k => `• ${k}: ${mem[k].value}`).join('\n') };
    }

    case 'clipboard_copy': {
      await writeClipboard(String(params.text || ''));
      return { output: '✔ Copied to clipboard' };
    }
    case 'clipboard_read': {
      const t = await readClipboard();
      return { output: t || '(clipboard empty)' };
    }

    case 'notify': {
      await showToast(String(params.message || ''));
      return { output: '✔ Notified' };
    }

    case 'device_info': {
      const info = await getDeviceInfo();
      return { output: JSON.stringify(info, null, 2) };
    }

    default:
      return { output: `❌ Unknown tool: ${name}` };
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
}

// Loaders exposed for UI
export function loadTodos() { return loadJson<any[]>(STORAGE_TODOS, []); }
export function saveTodos(t: any[]) { saveJson(STORAGE_TODOS, t); }
export function loadMemory() { return loadJson<Record<string, any>>(STORAGE_MEMORY, {}); }
export function saveMemory(m: Record<string, any>) { saveJson(STORAGE_MEMORY, m); }
