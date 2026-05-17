import type { ShellResult, ToolType } from '../types';
import { registerPlugin, Capacitor } from '@capacitor/core';
import { OpenCodeBridge, isOpenCodeAvailable } from './opencode-bridge';

// ==========================================
// Capacitor Plugin Interface & Registration
// ==========================================

interface QwenCodeBridgePlugin {
  isCapacitor(): Promise<{ value: boolean }>;
  checkPermissions(): Promise<{
    canReadStorage: boolean;
    canWriteStorage: boolean;
    hasAllFilesAccess: boolean;
    hasSmsPermission: boolean;
    hasCallPermission: boolean;
    hasContactsPermission: boolean;
    hasAccessibility: boolean;
    hasNotificationAccess: boolean;
  }>;
  requestStoragePermission(): Promise<{ value: boolean }>;
  // Shell
  executeShell(options: { command: string; timeout: number }): Promise<ShellResult>;
  // File
  readFile(options: { path: string }): Promise<{ value: string; error?: string }>;
  writeFile(options: { path: string; content: string }): Promise<{ value: boolean; error?: string }>;
  listDir(options: { path: string; showHidden?: boolean }): Promise<{ value: any[]; error?: string }>;
  exists(options: { path: string }): Promise<{ value: boolean; isFile: boolean; isDir: boolean }>;
  delete(options: { path: string; recursive?: boolean }): Promise<{ value: boolean }>;
  move(options: { source: string; destination: string }): Promise<{ value: boolean }>;
  copy(options: { source: string; destination: string }): Promise<{ value: boolean; error?: string }>;
  mkdir(options: { path: string }): Promise<{ value: boolean }>;
  getHomeDir(): Promise<{ value: string }>;
  getWorkingDir(): Promise<{ value: string }>;
  setWorkingDir(options: { dir: string }): Promise<{ value: boolean; error?: string }>;
  // HTTP
  httpRequest(options: {
    url: string;
    method?: string;
    body?: string;
    headers?: Record<string, string>;
    timeout?: number; // in SECONDS
    followRedirects?: boolean;
    retries?: number;
  }): Promise<{
    status: number;
    body: string;
    headers?: Record<string, string>;
    url?: string;
    error?: string;
  }>;
  // SMS
  sendSms(options: { phoneNumber: string; message: string }): Promise<{ value: boolean; error?: string }>;
  readSms(options: { limit: number; phoneNumber?: string }): Promise<{ value: any[]; error?: string }>;
  // Phone
  makeCall(options: { phoneNumber: string }): Promise<{ value: boolean; error?: string; note?: string }>;
  readCallLog(options: { limit: number }): Promise<{ value: any[]; error?: string }>;
  // Contacts
  readContacts(options: { limit: number; search?: string }): Promise<{ value: any[]; error?: string }>;
  // WhatsApp
  sendWhatsApp(options: { phoneNumber: string; message: string }): Promise<{ value: boolean; error?: string; note?: string }>;
  // Apps
  launchApp(options: { packageName: string; action?: string; data?: string }): Promise<{ value: boolean; error?: string }>;
  listInstalledApps(): Promise<{ value: any[]; error?: string }>;
  // Accessibility
  accessibilityReadScreen(): Promise<{ text: string; elements?: any[]; packageName?: string; error?: string }>;
  accessibilityClickText(options: { text: string; exactMatch: boolean }): Promise<{ value: boolean; error?: string }>;
  accessibilityClickAt(options: { x: number; y: number }): Promise<{ value: boolean; error?: string }>;
  accessibilityTypeText(options: { text: string }): Promise<{ value: boolean; error?: string }>;
  accessibilitySwipe(options: { startX: number; startY: number; endX: number; endY: number; duration: number }): Promise<{ value: boolean; error?: string }>;
  accessibilityPressBack(): Promise<{ value: boolean; error?: string }>;
  accessibilityPressHome(): Promise<{ value: boolean; error?: string }>;
  // Notifications
  readNotifications(options: { limit: number }): Promise<{ value: any[]; error?: string }>;
  dismissNotification(options: { key: string }): Promise<{ value: boolean }>;
  // Clipboard
  clipboardWrite(options: { text: string }): Promise<{ value: boolean }>;
  clipboardRead(): Promise<{ value: string }>;
  // Device
  getDeviceInfo(): Promise<any>;
  showToast(options: { message: string }): Promise<{ value: boolean }>;
  // WebView
  openWebView(options: { url: string }): Promise<{ value: boolean; error?: string }>;
  closeWebView(): Promise<{ value: boolean }>;
}

// Register the plugin properly with Capacitor
const QwenCodeBridge = registerPlugin<QwenCodeBridgePlugin>('QwenCodeBridge');

/**
 * Check if we're running in the native Android app.
 * Uses Capacitor's platform detection - reliable way.
 */
export const isNative = (): boolean => {
  return Capacitor.isNativePlatform();
};

/**
 * Get the native bridge plugin instance.
 * Returns null if not on native platform.
 */
function getBridge(): QwenCodeBridgePlugin | null {
  if (Capacitor.isNativePlatform()) {
    return QwenCodeBridge;
  }
  return null;
}

// ==========================================
// Shell Execution
// ==========================================

export async function executeShell(command: string, timeout: number = 60): Promise<ShellResult> {
  const bridge = getBridge();
  if (bridge) {
    try {
      return await bridge.executeShell({ command, timeout });
    } catch (err: any) {
      return { stdout: '', stderr: err.message, exitCode: -1 };
    }
  }
  return simulateShell(command);
}

function simulateShell(command: string): ShellResult {
  const cmd = command.trim().toLowerCase();
  if (cmd === 'pwd') return { stdout: '/sdcard', stderr: '', exitCode: 0 };
  if (cmd.startsWith('echo ')) return { stdout: command.slice(5).replace(/^["']|["']$/g, ''), stderr: '', exitCode: 0 };
  if (cmd === 'whoami') return { stdout: 'shell', stderr: '', exitCode: 0 };
  if (cmd === 'uname -a' || cmd === 'uname') return { stdout: 'Linux localhost 5.15.0-android #1 SMP aarch64 Android', stderr: '', exitCode: 0 };
  if (cmd.startsWith('ls')) return { stdout: 'Documents\nDownloads\nPictures\nMusic\nVideos\nprojects', stderr: '', exitCode: 0 };
  if (cmd === 'date') return { stdout: new Date().toString(), stderr: '', exitCode: 0 };
  if (cmd === 'hostname') return { stdout: 'android', stderr: '', exitCode: 0 };
  return { stdout: '', stderr: `Shell execution is only available in the Android app. Command: ${command}`, exitCode: 127 };
}

// ==========================================
// File Operations
// ==========================================

export async function readFile(path: string): Promise<string> {
  const bridge = getBridge();
  if (bridge) {
    try {
      const result = await bridge.readFile({ path });
      if (result.error) throw new Error(result.error);
      return result.value || '';
    } catch (err: any) {
      throw new Error(err.message || 'Failed to read file');
    }
  }
  return `[File content of ${path} - available in Android app]`;
}

export async function writeFile(path: string, content: string): Promise<boolean> {
  const bridge = getBridge();
  if (bridge) {
    try {
      const result = await bridge.writeFile({ path, content });
      if (result.error) throw new Error(result.error);
      return result.value;
    } catch (err: any) {
      throw new Error(err.message || 'Failed to write file');
    }
  }
  console.log(`[Would write to ${path}]: ${content.substring(0, 100)}...`);
  return true;
}

export async function listDir(path: string): Promise<string[]> {
  const bridge = getBridge();
  if (bridge) {
    try {
      const result = await bridge.listDir({ path });
      if (result.error) throw new Error(result.error);
      const entries = result.value || [];
      if (entries.length > 0 && typeof entries[0] === 'object') {
        return entries.map((e: any) => e.name);
      }
      return entries;
    } catch (err: any) {
      throw new Error(err.message || 'Failed to list directory');
    }
  }
  return ['Documents', 'Downloads', 'Pictures', 'Music', 'Videos', 'projects'];
}

export async function fileExists(path: string): Promise<boolean> {
  const bridge = getBridge();
  if (bridge) {
    try {
      const result = await bridge.exists({ path });
      return result.value;
    } catch { return false; }
  }
  return false;
}

export async function deleteFile(path: string, recursive: boolean = false): Promise<boolean> {
  const bridge = getBridge();
  if (bridge) {
    try {
      const result = await bridge.delete({ path, recursive });
      return result.value;
    } catch { return false; }
  }
  return true;
}

export async function moveFile(source: string, destination: string): Promise<boolean> {
  const bridge = getBridge();
  if (bridge) {
    try {
      const result = await bridge.move({ source, destination });
      return result.value;
    } catch { return false; }
  }
  return true;
}

export async function copyFile(source: string, destination: string): Promise<boolean> {
  const bridge = getBridge();
  if (bridge) {
    try {
      const result = await bridge.copy({ source, destination });
      return result.value;
    } catch { return false; }
  }
  return true;
}

export async function makeDir(path: string): Promise<boolean> {
  const bridge = getBridge();
  if (bridge) {
    try {
      const result = await bridge.mkdir({ path });
      return result.value;
    } catch { return false; }
  }
  return true;
}

export async function getHomeDir(): Promise<string> {
  const bridge = getBridge();
  if (bridge) {
    try {
      const result = await bridge.getHomeDir();
      return result.value;
    } catch { return '/sdcard'; }
  }
  return '/sdcard';
}

export async function getWorkingDir(): Promise<string> {
  const bridge = getBridge();
  if (bridge) {
    try {
      const result = await bridge.getWorkingDir();
      return result.value;
    } catch { return '/sdcard'; }
  }
  return '/sdcard';
}

export async function setWorkingDir(dir: string): Promise<boolean> {
  const bridge = getBridge();
  if (bridge) {
    try {
      const result = await bridge.setWorkingDir({ dir });
      return result.value;
    } catch { return false; }
  }
  return true;
}

// ==========================================
// HTTP Request (Native - Bypasses CORS)
// ==========================================

export async function nativeHttpRequest(options: {
  url: string;
  method?: string;
  body?: string;
  headers?: Record<string, string>;
  timeout?: number; // in SECONDS
  followRedirects?: boolean;
  retries?: number;
}): Promise<{ status: number; body: string; headers?: Record<string, string>; url?: string; error?: string }> {
  const bridge = getBridge();
  if (bridge) {
    try {
      return await bridge.httpRequest({
        ...options,
        timeout: options.timeout || 180, // Default 180s for slow connections (Cuba)
        retries: options.retries || 3,
      });
    } catch (err: any) {
      return { status: -1, body: '', error: err.message };
    }
  }
  
  // Fallback for web/development
  try {
    const response = await fetch(options.url, {
      method: options.method || 'GET',
      headers: options.headers || {},
      body: options.body,
    });
    const text = await response.text();
    return { status: response.status, body: text.substring(0, 512 * 1024) };
  } catch (err: any) {
    return { status: -1, body: '', error: err.message };
  }
}

// ==========================================
// Web Search & Scrape (Uses native HTTP)
// ==========================================

export async function webSearch(query: string, numResults: number = 10): Promise<Array<{ title: string; url: string; snippet: string }>> {
  // Try native HTTP first (bypasses CORS)
  try {
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const result = await nativeHttpRequest({
      url: searchUrl,
      method: 'GET',
      timeout: 25000,
      followRedirects: true,
    });
    
    if (result.status === 200 && result.body) {
      return parseDuckDuckGoHtml(result.body, numResults);
    }
  } catch (e) {
    // Native HTTP failed, try curl via shell
  }
  
  // Fallback: use shell curl
  if (isNative()) {
    try {
      const shellResult = await executeShell(
        `curl -s -L -A "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/125.0.0.0 Mobile Safari/537.36" "https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}" 2>/dev/null`,
        20
      );
      if (shellResult.exitCode === 0 && shellResult.stdout) {
        return parseDuckDuckGoHtml(shellResult.stdout, numResults);
      }
    } catch (e) {
      // Shell curl also failed
    }
  }
  
  // Final fallback: try Google via native HTTP
  try {
    const googleResult = await nativeHttpRequest({
      url: `https://www.google.com/search?q=${encodeURIComponent(query)}&num=${numResults}`,
      method: 'GET',
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36',
        'Accept-Language': 'es,en;q=0.9',
      },
    });
    
    if (googleResult.status === 200 && googleResult.body) {
      return parseGoogleHtml(googleResult.body, numResults);
    }
  } catch (e) {
    // Google also failed
  }
  
  throw new Error('No se pudo realizar la busqueda web. Verifica tu conexion a internet.');
}

function parseDuckDuckGoHtml(html: string, numResults: number): Array<{ title: string; url: string; snippet: string }> {
  const results: Array<{ title: string; url: string; snippet: string }> = [];
  
  const resultRegex = /<a[^>]+class="result__a"[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi;
  const snippetRegex = /<a[^>]+class="result__snippet"[^>]*>(.*?)<\/a>/gi;
  
  let match;
  while ((match = resultRegex.exec(html)) !== null && results.length < numResults) {
    let url = match[1];
    let title = match[2].replace(/<[^>]+>/g, '').trim();
    
    const uddgMatch = url.match(/uddg=([^&]+)/);
    if (uddgMatch) {
      try {
        url = decodeURIComponent(uddgMatch[1]);
      } catch { /* keep original URL */ }
    }
    
    results.push({ title, url, snippet: '' });
  }
  
  let i = 0;
  while ((match = snippetRegex.exec(html)) !== null && i < results.length) {
    results[i].snippet = match[1].replace(/<[^>]+>/g, '').trim();
    i++;
  }
  
  return results;
}

function parseGoogleHtml(html: string, numResults: number): Array<{ title: string; url: string; snippet: string }> {
  const results: Array<{ title: string; url: string; snippet: string }> = [];
  
  const divRegex = /<div[^>]*class="[^"]*g[^"]*"[^>]*>[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<span[^>]*class="[^"]*st[^"]*"[^>]*>([\s\S]*?)<\/span>/gi;
  let match;
  while ((match = divRegex.exec(html)) !== null && results.length < numResults) {
    const url = match[1];
    const title = match[2].replace(/<[^>]+>/g, '').trim();
    const snippet = match[3].replace(/<[^>]+>/g, '').trim();
    if (url.startsWith('http')) {
      results.push({ title, url, snippet });
    }
  }
  
  if (results.length === 0) {
    const linkRegex = /<a[^>]*href="\/url\?q=([^&"]+)&[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
    while ((match = linkRegex.exec(html)) !== null && results.length < numResults) {
      const url = decodeURIComponent(match[1]);
      const title = match[2].replace(/<[^>]+>/g, '').trim();
      if (url.startsWith('http') && !url.includes('google.com')) {
        results.push({ title, url, snippet: '' });
      }
    }
  }
  
  return results;
}

export async function webScrape(url: string): Promise<{ title: string; text: string; links: string[] }> {
  try {
    const result = await nativeHttpRequest({
      url,
      method: 'GET',
      timeout: 25000,
      followRedirects: true,
    });
    
    if (result.error || (result.status !== 200 && result.status !== 0)) {
      // Try curl via shell as fallback
      if (isNative()) {
        const shellResult = await executeShell(
          `curl -s -L -A "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/125.0.0.0 Mobile Safari/537.36" "${url}" 2>/dev/null`,
          20
        );
        if (shellResult.exitCode === 0 && shellResult.stdout) {
          return parseHtmlContent(shellResult.stdout);
        }
      }
      throw new Error(`Scrape failed: ${result.error || `HTTP ${result.status}`}`);
    }
    
    return parseHtmlContent(result.body);
  } catch (err: any) {
    throw new Error(`Scrape failed: ${err.message}`);
  }
}

function parseHtmlContent(html: string): { title: string; text: string; links: string[] } {
  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '';
  
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n\s*\n/g, '\n')
    .trim();
  
  if (text.length > 30000) {
    text = text.substring(0, 30000) + '\n... [Content truncated]';
  }
  
  const linkRegex = /href=["'](https?:\/\/[^"']+)["']/gi;
  const links: string[] = [];
  let linkMatch;
  while ((linkMatch = linkRegex.exec(html)) !== null && links.length < 50) {
    links.push(linkMatch[1]);
  }
  
  return { title, text, links };
}

// ==========================================
// Tool Call Dispatcher (All 28+ Tools)
// ==========================================

export async function executeToolCall(
  toolName: string, 
  params: Record<string, any>
): Promise<{ output: string; error?: string }> {
  try {
    const bridge = getBridge();
    
    switch (toolName as ToolType) {
      // === Shell & Code ===
      case 'shell': {
        const result = await executeShell(params.command, params.timeout || 60);
        let output = '';
        if (result.stdout) output += result.stdout;
        if (result.stderr) output += (output ? '\n' : '') + result.stderr;
        if (result.exitCode !== 0) {
          return { output: output || '(no output)', error: `Exit code: ${result.exitCode}` };
        }
        return { output: output || '(no output)' };
      }
      
      case 'code_execute': {
        const lang = params.language || 'python';
        const code = params.code;
        if (!code) return { output: '', error: 'No code provided' };
        const result = await executeCodeFile(lang, code, params.timeout || 30);
        let output = '';
        if (result.stdout) output += result.stdout;
        if (result.stderr) output += (output ? '\n[stderr]\n' : '[stderr]\n') + result.stderr;
        if (result.exitCode !== 0) {
          return { output: output || '(no output)', error: `Process exited with code ${result.exitCode}` };
        }
        return { output: output || '(no output)' };
      }
      
      // === File Operations ===
      case 'file_read': {
        try {
          const content = await readFile(params.path);
          if (!content) return { output: '', error: `Empty or unreadable file: ${params.path}` };
          if (params.start_line || params.end_line) {
            const lines = content.split('\n');
            const start = (params.start_line || 1) as number - 1;
            const end = (params.end_line || lines.length) as number;
            return { output: lines.slice(start, end).map((line, i) => `${start + i + 1}: ${line}`).join('\n') };
          }
          return { output: content };
        } catch (err: any) {
          return { output: '', error: err.message };
        }
      }
      
      case 'file_write': {
        try {
          const success = await writeFile(params.path, params.content);
          return { output: success ? `File written: ${params.path}` : 'Failed to write file', error: success ? undefined : 'Write failed' };
        } catch (err: any) {
          return { output: '', error: err.message };
        }
      }
      
      case 'file_edit': {
        try {
          const content = await readFile(params.path);
          if (!content) return { output: '', error: `Could not read file: ${params.path}` };
          const oldText = params.old_text as string;
          const newText = params.new_text as string;
          if (!content.includes(oldText)) {
            const firstLines = content.split('\n').slice(0, 5).join('\n');
            return { output: '', error: `Text not found in ${params.path}. File starts with:\n${firstLines}` };
          }
          const replaceAll = params.replace_all as boolean;
          const newContent = replaceAll ? content.split(oldText).join(newText) : content.replace(oldText, newText);
          const success = await writeFile(params.path, newContent);
          if (success) {
            return { output: `Edited ${params.path}: Replaced ${oldText.split('\n').length} line(s) with ${newText.split('\n').length} line(s)` };
          }
          return { output: '', error: 'Failed to write edited file' };
        } catch (err: any) {
          return { output: '', error: err.message };
        }
      }
      
      case 'mkdir': {
        const success = await makeDir(params.path);
        return { output: success ? `Directory created: ${params.path}` : 'Failed to create directory', error: success ? undefined : 'Mkdir failed' };
      }
      
      case 'rm': {
        const recursive = params.recursive as boolean;
        const success = await deleteFile(params.path, recursive);
        return { output: success ? `Deleted: ${params.path}` : 'Failed to delete', error: success ? undefined : 'Delete failed' };
      }
      
      case 'mv': {
        const success = await moveFile(params.source, params.destination);
        return { output: success ? `Moved: ${params.source} -> ${params.destination}` : 'Failed to move', error: success ? undefined : 'Move failed' };
      }
      
      case 'cp': {
        const success = await copyFile(params.source, params.destination);
        return { output: success ? `Copied: ${params.source} -> ${params.destination}` : 'Failed to copy', error: success ? undefined : 'Copy failed' };
      }
      
      case 'list_dir': {
        const path = params.path || await getHomeDir();
        try {
          const shellResult = await executeShell(`ls -la "${path}" 2>/dev/null`, 10);
          if (shellResult.exitCode === 0 && shellResult.stdout) {
            return { output: shellResult.stdout };
          }
          const entries = await listDir(path);
          return { output: entries.join('\n') || 'Empty directory' };
        } catch (err: any) {
          return { output: '', error: err.message };
        }
      }
      
      // === Web Tools ===
      case 'web_fetch': {
        try {
          const result = await nativeHttpRequest({
            url: params.url,
            method: 'GET',
            timeout: 25000,
            followRedirects: true,
          });
          
          if (result.error) {
            if (isNative()) {
              const shellResult = await executeShell(`curl -s -L "${params.url}" 2>/dev/null`, 20);
              if (shellResult.exitCode === 0 && shellResult.stdout) {
                if (shellResult.stdout.includes('<html') || shellResult.stdout.includes('<!DOCTYPE')) {
                  const scraped = parseHtmlContent(shellResult.stdout);
                  return { output: `Title: ${scraped.title}\n\n${scraped.text.substring(0, 15000)}` };
                }
                return { output: shellResult.stdout.substring(0, 15000) };
              }
            }
            return { output: '', error: `Fetch error: ${result.error}` };
          }
          
          if (result.status >= 400) {
            return { output: result.body.substring(0, 2000), error: `HTTP ${result.status}` };
          }
          
          if (result.body.includes('<html') || result.body.includes('<!DOCTYPE')) {
            const scraped = parseHtmlContent(result.body);
            return { output: `Title: ${scraped.title}\n\n${scraped.text.substring(0, 15000)}` };
          }
          
          return { output: result.body.substring(0, 15000) };
        } catch (err: any) {
          return { output: '', error: `Fetch failed: ${err.message}` };
        }
      }
      
      case 'web_search': {
        try {
          const results = await webSearch(params.query, params.num_results || 10);
          if (results.length === 0) {
            return { output: 'No se encontraron resultados' };
          }
          const formatted = results.map((r, i) => 
            `${i + 1}. ${r.title}\n   URL: ${r.url}\n   ${r.snippet}`
          ).join('\n\n');
          return { output: formatted };
        } catch (err: any) {
          return { output: '', error: `Search failed: ${err.message}` };
        }
      }
      
      case 'web_scrape': {
        try {
          const result = await webScrape(params.url);
          let output = `Title: ${result.title}\n\n${result.text}`;
          if (result.links.length > 0 && params.include_links) {
            output += `\n\nLinks found:\n${result.links.slice(0, 20).join('\n')}`;
          }
          return { output };
        } catch (err: any) {
          return { output: '', error: `Scrape failed: ${err.message}` };
        }
      }
      
      // === NPX ===
      case 'npx_install': {
        const packageName = params.package as string;
        const args = params.args || '';
        const result = await executeShell(`npx -y ${packageName} ${args}`, params.timeout || 120);
        let output = '';
        if (result.stdout) output += result.stdout;
        if (result.stderr) output += (output ? '\n' : '') + result.stderr;
        if (result.exitCode !== 0) {
          return { output: output || '(no output)', error: `Exit code: ${result.exitCode}` };
        }
        return { output: output || 'Package executed successfully' };
      }
      
      // === Search Tools ===
      case 'glob': {
        const dir = params.path || await getHomeDir();
        const result = await executeShell(`find "${dir}" -name "${params.pattern}" -type f 2>/dev/null | head -100`, 15);
        return { output: result.stdout || 'No matches found' };
      }
      
      case 'grep': {
        const dir = params.path || await getHomeDir();
        const includeFlag = params.include ? ` --include="${params.include}"` : '';
        const result = await executeShell(`grep -rn${includeFlag} "${params.pattern}" "${dir}" 2>/dev/null | head -100`, 15);
        return { output: result.stdout || 'No matches found' };
      }
      
      // === SMS ===
      case 'send_sms': {
        if (!bridge?.sendSms) {
          return { output: '', error: 'SMS not available in this environment' };
        }
        try {
          const result = await bridge.sendSms({ phoneNumber: params.phone_number, message: params.message });
          if (result.error) return { output: '', error: result.error };
          return { output: `SMS sent to ${params.phone_number}` };
        } catch (err: any) {
          return { output: '', error: err.message };
        }
      }
      
      case 'read_sms': {
        if (!bridge?.readSms) {
          return { output: '', error: 'SMS not available in this environment' };
        }
        try {
          const result = await bridge.readSms({ limit: params.limit || 20, phoneNumber: params.phone_number });
          if (result.error) return { output: '', error: result.error };
          const formatted = result.value.map((sms: any) => 
            `[${sms.type === 'received' ? 'IN' : 'OUT'}] ${sms.address}: ${sms.body} (${new Date(sms.date).toLocaleString()})`
          ).join('\n');
          return { output: formatted || 'No SMS messages found' };
        } catch (err: any) {
          return { output: '', error: err.message };
        }
      }
      
      // === WhatsApp ===
      case 'send_whatsapp': {
        if (!bridge?.sendWhatsApp) {
          return { output: '', error: 'WhatsApp not available in this environment' };
        }
        try {
          const result = await bridge.sendWhatsApp({ phoneNumber: params.phone_number || '', message: params.message });
          if (result.error) return { output: '', error: result.error };
          return { output: `WhatsApp opened${params.phone_number ? ` for ${params.phone_number}` : ''}. User must press send.${result.note ? ' ' + result.note : ''}` };
        } catch (err: any) {
          return { output: '', error: err.message };
        }
      }
      
      // === Phone ===
      case 'make_call': {
        if (!bridge?.makeCall) {
          return { output: '', error: 'Phone not available in this environment' };
        }
        try {
          const result = await bridge.makeCall({ phoneNumber: params.phone_number });
          if (result.error) return { output: '', error: result.error };
          return { output: `Calling ${params.phone_number}${result.note ? '. ' + result.note : ''}` };
        } catch (err: any) {
          return { output: '', error: err.message };
        }
      }
      
      case 'read_call_log': {
        if (!bridge?.readCallLog) {
          return { output: '', error: 'Call log not available in this environment' };
        }
        try {
          const result = await bridge.readCallLog({ limit: params.limit || 20 });
          if (result.error) return { output: '', error: result.error };
          const formatted = result.value.map((call: any) => 
            `[${call.type}] ${call.name || call.number} - Duration: ${call.duration}s (${new Date(call.date).toLocaleString()})`
          ).join('\n');
          return { output: formatted || 'No call log entries' };
        } catch (err: any) {
          return { output: '', error: err.message };
        }
      }
      
      // === Contacts ===
      case 'read_contacts': {
        if (!bridge?.readContacts) {
          return { output: '', error: 'Contacts not available in this environment' };
        }
        try {
          const result = await bridge.readContacts({ limit: params.limit || 50, search: params.search || '' });
          if (result.error) return { output: '', error: result.error };
          const formatted = result.value.map((c: any) => 
            `${c.name}: ${(c.phones || []).join(', ')}`
          ).join('\n');
          return { output: formatted || 'No contacts found' };
        } catch (err: any) {
          return { output: '', error: err.message };
        }
      }
      
      // === Apps ===
      case 'launch_app': {
        if (!bridge?.launchApp) {
          return { output: '', error: 'App launch not available in this environment' };
        }
        try {
          const result = await bridge.launchApp({ packageName: params.package_name, action: params.action || '', data: params.data || '' });
          if (result.error) return { output: '', error: result.error };
          return { output: `App launched: ${params.package_name}` };
        } catch (err: any) {
          return { output: '', error: err.message };
        }
      }
      
      case 'list_apps': {
        if (!bridge?.listInstalledApps) {
          return { output: '', error: 'App listing not available in this environment' };
        }
        try {
          const result = await bridge.listInstalledApps();
          if (result.error) return { output: '', error: result.error };
          const userApps = (result.value || []).filter((a: any) => a.isUser);
          const formatted = userApps.map((a: any) => `${a.name} (${a.packageName})`).join('\n');
          return { output: formatted || 'No apps found' };
        } catch (err: any) {
          return { output: '', error: err.message };
        }
      }
      
      // === Accessibility (UI Automation) ===
      case 'read_screen': {
        if (!bridge?.accessibilityReadScreen) {
          return { output: '', error: 'Accessibility not available. Enable it in Settings > Accessibility > Qwen Code' };
        }
        try {
          const result = await bridge.accessibilityReadScreen();
          if (result.error) return { output: '', error: result.error };
          let output = `Current App: ${result.packageName || 'unknown'}\n\nScreen Text:\n${result.text}`;
          return { output };
        } catch (err: any) {
          return { output: '', error: err.message };
        }
      }
      
      case 'click_text': {
        if (!bridge?.accessibilityClickText) {
          return { output: '', error: 'Accessibility not available' };
        }
        try {
          const result = await bridge.accessibilityClickText({ text: params.text, exactMatch: params.exact_match || false });
          if (result.error) return { output: '', error: result.error };
          return { output: result.value ? `Clicked on "${params.text}"` : 'Could not click' };
        } catch (err: any) {
          return { output: '', error: err.message };
        }
      }
      
      case 'click_at': {
        if (!bridge?.accessibilityClickAt) {
          return { output: '', error: 'Accessibility not available' };
        }
        try {
          const result = await bridge.accessibilityClickAt({ x: params.x, y: params.y });
          if (result.error) return { output: '', error: result.error };
          return { output: result.value ? `Clicked at (${params.x}, ${params.y})` : 'Could not click' };
        } catch (err: any) {
          return { output: '', error: err.message };
        }
      }
      
      case 'type_text': {
        if (!bridge?.accessibilityTypeText) {
          return { output: '', error: 'Accessibility not available' };
        }
        try {
          const result = await bridge.accessibilityTypeText({ text: params.text });
          if (result.error) return { output: '', error: result.error };
          return { output: result.value ? `Typed text` : 'Could not type' };
        } catch (err: any) {
          return { output: '', error: err.message };
        }
      }
      
      case 'swipe': {
        if (!bridge?.accessibilitySwipe) {
          return { output: '', error: 'Accessibility not available' };
        }
        try {
          const result = await bridge.accessibilitySwipe({
            startX: params.start_x || 0, startY: params.start_y || 0,
            endX: params.end_x || 0, endY: params.end_y || 0,
            duration: params.duration || 300
          });
          if (result.error) return { output: '', error: result.error };
          return { output: result.value ? 'Swipe performed' : 'Could not swipe' };
        } catch (err: any) {
          return { output: '', error: err.message };
        }
      }
      
      case 'press_back': {
        if (!bridge?.accessibilityPressBack) {
          return { output: '', error: 'Accessibility not available' };
        }
        try {
          const result = await bridge.accessibilityPressBack();
          return { output: result.value ? 'Pressed back' : 'Could not press back' };
        } catch (err: any) {
          return { output: '', error: err.message };
        }
      }
      
      case 'press_home': {
        if (!bridge?.accessibilityPressHome) {
          return { output: '', error: 'Accessibility not available' };
        }
        try {
          const result = await bridge.accessibilityPressHome();
          return { output: result.value ? 'Pressed home' : 'Could not press home' };
        } catch (err: any) {
          return { output: '', error: err.message };
        }
      }
      
      // === Notifications ===
      case 'read_notifications': {
        if (!bridge?.readNotifications) {
          return { output: '', error: 'Notification access not available. Enable it in Settings > Apps > Special App Access > Notification Access > Qwen Code' };
        }
        try {
          const result = await bridge.readNotifications({ limit: params.limit || 20 });
          if (result.error) return { output: '', error: result.error };
          const formatted = (result.value || []).map((n: any) => 
            `[${n.appName}] ${n.title || ''}: ${n.text || ''}${n.bigText ? '\n  ' + n.bigText : ''}`
          ).join('\n');
          return { output: formatted || 'No notifications' };
        } catch (err: any) {
          return { output: '', error: err.message };
        }
      }
      
      case 'dismiss_notification': {
        if (!bridge?.dismissNotification) {
          return { output: '', error: 'Notification access not available' };
        }
        try {
          const result = await bridge.dismissNotification({ key: params.key });
          return { output: result.value ? 'Notification dismissed' : 'Could not dismiss' };
        } catch (err: any) {
          return { output: '', error: err.message };
        }
      }
      
      // === Clipboard ===
      case 'clipboard_read': {
        if (!bridge?.clipboardRead) {
          return { output: '', error: 'Clipboard not available in this environment' };
        }
        try {
          const result = await bridge.clipboardRead();
          return { output: result.value || '(clipboard is empty)' };
        } catch (err: any) {
          return { output: '', error: err.message };
        }
      }
      
      case 'clipboard_write': {
        if (!bridge?.clipboardWrite) {
          return { output: '', error: 'Clipboard not available in this environment' };
        }
        try {
          const result = await bridge.clipboardWrite({ text: params.text });
          return { output: result.value ? 'Text copied to clipboard' : 'Failed to copy' };
        } catch (err: any) {
          return { output: '', error: err.message };
        }
      }
      
      // === Device Info ===
      case 'get_device_info': {
        if (!bridge?.getDeviceInfo) {
          const result = await executeShell('echo "Manufacturer: $(getprop ro.product.manufacturer)\nModel: $(getprop ro.product.model)\nAndroid: $(getprop ro.build.version.release)\nSDK: $(getprop ro.build.version.sdk)"', 5);
          return { output: result.stdout || 'Device info not available' };
        }
        try {
          const result = await bridge.getDeviceInfo();
          const formatted = `Device: ${result.manufacturer} ${result.model}\nAndroid: ${result.androidVersion} (SDK ${result.sdkVersion})\nBrand: ${result.brand}\nRooted: ${result.isRooted ? 'Yes' : 'No'}\nStorage: ${Math.round(result.freeStorage / 1024 / 1024 / 1024)}GB free of ${Math.round(result.totalStorage / 1024 / 1024 / 1024)}GB`;
          return { output: formatted };
        } catch (err: any) {
          return { output: '', error: err.message };
        }
      }
      
      case 'show_toast': {
        if (!bridge?.showToast) {
          return { output: 'Toast not available in this environment' };
        }
        try {
          await bridge.showToast({ message: params.message });
          return { output: 'Toast shown' };
        } catch (err: any) {
          return { output: '', error: err.message };
        }
      }
      
      // === OpenCode Tools ===
      case 'opencode_setup': {
        if (!isOpenCodeAvailable()) {
          return { output: '', error: 'OpenCode is only available in the native Android app' };
        }
        try {
          const reinstall = params.reinstall as boolean;
          if (reinstall) {
            const result = await OpenCodeBridge.fullSetup();
            return { output: result.value ? 'OpenCode environment setup complete (reinstalled)' : `Setup failed: ${result.error || 'Unknown error'}`, error: result.value ? undefined : result.error };
          }
          // Check current status first
          const status = await OpenCodeBridge.checkSetup();
          if (status.prootInstalled && status.ubuntuInstalled && status.opencodeInstalled) {
            return { output: 'OpenCode environment is already set up. Use reinstall: true to force reinstall.' };
          }
          const result = await OpenCodeBridge.fullSetup();
          return { output: result.value ? 'OpenCode environment setup complete. proot-distro, Ubuntu, and OpenCode are installed.' : `Setup failed: ${result.error || 'Unknown error'}`, error: result.value ? undefined : result.error };
        } catch (err: any) {
          return { output: '', error: `OpenCode setup failed: ${err.message}` };
        }
      }
      
      case 'opencode_run': {
        if (!isOpenCodeAvailable()) {
          return { output: '', error: 'OpenCode is only available in the native Android app' };
        }
        try {
          const command = params.command as string;
          const timeout = (params.timeout as number) || 60;
          if (!command) return { output: '', error: 'No command provided' };
          const result = await OpenCodeBridge.executeProotCommand({ command, timeout });
          let output = '';
          if (result.stdout) output += result.stdout;
          if (result.stderr) output += (output ? '\n[stderr]\n' : '[stderr]\n') + result.stderr;
          if (result.exitCode !== 0) {
            return { output: output || '(no output)', error: `Exit code: ${result.exitCode}` };
          }
          return { output: output || '(no output)' };
        } catch (err: any) {
          return { output: '', error: `OpenCode run failed: ${err.message}` };
        }
      }
      
      case 'opencode_status': {
        if (!isOpenCodeAvailable()) {
          return { output: '', error: 'OpenCode is only available in the native Android app' };
        }
        try {
          const result = await OpenCodeBridge.checkSetup();
          const lines = [
            `proot-distro: ${result.prootInstalled ? '✅ Installed' : '❌ Not installed'}`,
            `Ubuntu: ${result.ubuntuInstalled ? '✅ Installed' : '❌ Not installed'}`,
            `OpenCode: ${result.opencodeInstalled ? '✅ Installed' : '❌ Not installed'}`,
            `Setup Status: ${result.setupStatus}`,
          ];
          if (result.prootPath) lines.push(`proot Path: ${result.prootPath}`);
          if (result.ubuntuRootPath) lines.push(`Ubuntu Root: ${result.ubuntuRootPath}`);
          return { output: lines.join('\n') };
        } catch (err: any) {
          return { output: '', error: `Failed to check OpenCode status: ${err.message}` };
        }
      }
      
      default:
        return { output: '', error: `Unknown tool: ${toolName}` };
    }
  } catch (err: any) {
    return { output: '', error: err.message };
  }
}

// Helper: execute code by writing to temp file and running
async function executeCodeFile(language: string, code: string, timeout: number = 30): Promise<ShellResult> {
  const extensions: Record<string, string> = {
    python: 'py', python3: 'py', py: 'py',
    javascript: 'js', js: 'js', node: 'js',
    bash: 'sh', sh: 'sh', shell: 'sh',
    ruby: 'rb', perl: 'pl', lua: 'lua',
  };
  
  const commands: Record<string, string> = {
    python: 'python3', python3: 'python3', py: 'python3',
    javascript: 'node', js: 'node', node: 'node',
    bash: 'bash', sh: 'sh', shell: 'sh',
    ruby: 'ruby', perl: 'perl', lua: 'lua',
  };
  
  const ext = extensions[language.toLowerCase()] || 'txt';
  const runner = commands[language.toLowerCase()] || language;
  const homeDir = await getHomeDir();
  const tmpFile = `${homeDir}/.qwen_tmp_code_${Date.now()}.${ext}`;
  
  try {
    await writeFile(tmpFile, code);
    const result = await executeShell(`${runner} "${tmpFile}"`, timeout);
    await deleteFile(tmpFile, false);
    return result;
  } catch (err: any) {
    try { await deleteFile(tmpFile, false); } catch {}
    return { stdout: '', stderr: err.message, exitCode: -1 };
  }
}
