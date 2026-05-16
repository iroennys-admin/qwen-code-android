import type { ShellResult, ToolType } from '../types';

// Bridge to native Android shell execution via Capacitor
declare global {
  interface Window {
    QwenCodeBridge?: {
      executeShell: (command: string, timeout: number) => Promise<ShellResult>;
      readFile: (path: string) => Promise<{ value: string; error?: string }>;
      writeFile: (path: string, content: string) => Promise<{ value: boolean; error?: string }>;
      listDir: (path: string) => Promise<{ value: any[]; error?: string }>;
      exists: (path: string) => Promise<{ value: boolean; isFile: boolean; isDir: boolean }>;
      delete: (path: string, recursive?: boolean) => Promise<{ value: boolean }>;
      move: (source: string, destination: string) => Promise<{ value: boolean }>;
      copy: (source: string, destination: string) => Promise<{ value: boolean; error?: string }>;
      mkdir: (path: string) => Promise<{ value: boolean }>;
      getHomeDir: () => Promise<{ value: string }>;
      getWorkingDir: () => Promise<{ value: string }>;
      setWorkingDir: (dir: string) => Promise<{ value: boolean; error?: string }>;
      httpRequest: (options: {
        url: string;
        method?: string;
        body?: string;
        headers?: Record<string, string>;
        timeout?: number;
        followRedirects?: boolean;
      }) => Promise<{
        status: number;
        body: string;
        headers?: Record<string, string>;
        url?: string;
        error?: string;
      }>;
      checkPermissions: () => Promise<{
        canReadStorage: boolean;
        canWriteStorage: boolean;
        hasAllFilesAccess: boolean;
      }>;
      requestStoragePermission: () => Promise<{ value: boolean }>;
      isCapacitor: () => Promise<{ value: boolean }>;
    };
    AndroidBridge?: any;
  }
}

export const isNative = (): boolean => {
  return !!(window.QwenCodeBridge);
};

// Shell command execution
export async function executeShell(command: string, timeout: number = 60): Promise<ShellResult> {
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
  
  if (cmd === 'pwd') return { stdout: '/sdcard', stderr: '', exitCode: 0 };
  if (cmd.startsWith('echo ')) return { stdout: command.slice(5).replace(/^["']|["']$/g, ''), stderr: '', exitCode: 0 };
  if (cmd === 'whoami') return { stdout: 'shell', stderr: '', exitCode: 0 };
  if (cmd === 'uname -a' || cmd === 'uname') return { stdout: 'Linux localhost 5.15.0-android #1 SMP aarch64 Android', stderr: '', exitCode: 0 };
  if (cmd.startsWith('ls')) return { stdout: 'Documents\nDownloads\nPictures\nMusic\nVideos\nprojects', stderr: '', exitCode: 0 };
  if (cmd === 'date') return { stdout: new Date().toString(), stderr: '', exitCode: 0 };
  if (cmd === 'hostname') return { stdout: 'android', stderr: '', exitCode: 0 };
  
  return { 
    stdout: '', 
    stderr: `Shell execution is only available in the Android app. Command: ${command}`, 
    exitCode: 127 
  };
}

// File operations
export async function readFile(path: string): Promise<string> {
  if (window.QwenCodeBridge) {
    try {
      const result = await window.QwenCodeBridge.readFile(path);
      if (result.error) {
        throw new Error(result.error);
      }
      return result.value || '';
    } catch (err: any) {
      throw new Error(err.message || 'Failed to read file');
    }
  }
  return `[File content of ${path} - available in Android app]`;
}

export async function writeFile(path: string, content: string): Promise<boolean> {
  if (window.QwenCodeBridge) {
    try {
      const result = await window.QwenCodeBridge.writeFile(path, content);
      if (result.error) {
        throw new Error(result.error);
      }
      return result.value;
    } catch (err: any) {
      throw new Error(err.message || 'Failed to write file');
    }
  }
  console.log(`[Would write to ${path}]: ${content.substring(0, 100)}...`);
  return true;
}

export async function listDir(path: string): Promise<string[]> {
  if (window.QwenCodeBridge) {
    try {
      const result = await window.QwenCodeBridge.listDir(path);
      if (result.error) {
        throw new Error(result.error);
      }
      // Handle both old format (string[]) and new format (JSObject[])
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
  if (window.QwenCodeBridge) {
    try {
      const result = await window.QwenCodeBridge.exists(path);
      return result.value;
    } catch {
      return false;
    }
  }
  return false;
}

export async function deleteFile(path: string, recursive: boolean = false): Promise<boolean> {
  if (window.QwenCodeBridge) {
    try {
      const result = await window.QwenCodeBridge.delete(path, recursive);
      return result.value;
    } catch {
      return false;
    }
  }
  return true;
}

export async function moveFile(source: string, destination: string): Promise<boolean> {
  if (window.QwenCodeBridge) {
    try {
      const result = await window.QwenCodeBridge.move(source, destination);
      return result.value;
    } catch {
      return false;
    }
  }
  return true;
}

export async function copyFile(source: string, destination: string): Promise<boolean> {
  if (window.QwenCodeBridge) {
    try {
      const result = await window.QwenCodeBridge.copy(source, destination);
      return result.value;
    } catch {
      return false;
    }
  }
  return true;
}

export async function makeDir(path: string): Promise<boolean> {
  if (window.QwenCodeBridge) {
    try {
      const result = await window.QwenCodeBridge.mkdir(path);
      return result.value;
    } catch {
      return false;
    }
  }
  return true;
}

export async function getHomeDir(): Promise<string> {
  if (window.QwenCodeBridge) {
    try {
      const result = await window.QwenCodeBridge.getHomeDir();
      return result.value;
    } catch {
      return '/sdcard';
    }
  }
  return '/sdcard';
}

export async function getWorkingDir(): Promise<string> {
  if (window.QwenCodeBridge) {
    try {
      const result = await window.QwenCodeBridge.getWorkingDir();
      return result.value;
    } catch {
      return '/sdcard';
    }
  }
  return '/sdcard';
}

export async function setWorkingDir(dir: string): Promise<boolean> {
  if (window.QwenCodeBridge) {
    try {
      const result = await window.QwenCodeBridge.setWorkingDir(dir);
      return result.value;
    } catch {
      return false;
    }
  }
  return true;
}

/**
 * Native HTTP request - uses Android's HttpURLConnection.
 * Bypasses WebView CORS restrictions completely.
 */
export async function nativeHttpRequest(options: {
  url: string;
  method?: string;
  body?: string;
  headers?: Record<string, string>;
  timeout?: number;
  followRedirects?: boolean;
}): Promise<{ status: number; body: string; headers?: Record<string, string>; url?: string; error?: string }> {
  if (window.QwenCodeBridge?.httpRequest) {
    try {
      return await window.QwenCodeBridge.httpRequest(options);
    } catch (err: any) {
      return { status: -1, body: '', error: err.message };
    }
  }
  
  // Fallback for web/development: use fetch
  try {
    const response = await fetch(options.url, {
      method: options.method || 'GET',
      headers: options.headers || {},
      body: options.body,
    });
    const text = await response.text();
    return {
      status: response.status,
      body: text.substring(0, 512 * 1024),
    };
  } catch (err: any) {
    return { status: -1, body: '', error: err.message };
  }
}

/**
 * Web search using DuckDuckGo HTML (works from Cuba).
 */
export async function webSearch(query: string, numResults: number = 10): Promise<Array<{ title: string; url: string; snippet: string }>> {
  const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  
  const result = await nativeHttpRequest({
    url: searchUrl,
    method: 'GET',
    timeout: 20000,
    followRedirects: true,
  });
  
  if (result.error || result.status !== 200) {
    throw new Error(`Search failed: ${result.error || `HTTP ${result.status}`}`);
  }
  
  const html = result.body;
  const results: Array<{ title: string; url: string; snippet: string }> = [];
  
  // Parse DuckDuckGo HTML results
  const resultRegex = /<a[^>]+class="result__a"[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi;
  const snippetRegex = /<a[^>]+class="result__snippet"[^>]*>(.*?)<\/a>/gi;
  
  let match;
  while ((match = resultRegex.exec(html)) !== null && results.length < numResults) {
    let url = match[1];
    let title = match[2].replace(/<[^>]+>/g, '').trim();
    
    // DuckDuckGo uses redirect URLs, extract the actual URL
    const uddgMatch = url.match(/uddg=([^&]+)/);
    if (uddgMatch) {
      url = decodeURIComponent(uddgMatch[1]);
    }
    
    results.push({ title, url, snippet: '' });
  }
  
  // Extract snippets
  let i = 0;
  while ((match = snippetRegex.exec(html)) !== null && i < results.length) {
    results[i].snippet = match[1].replace(/<[^>]+>/g, '').trim();
    i++;
  }
  
  return results;
}

/**
 * Scrape a web page and extract text content.
 */
export async function webScrape(url: string): Promise<{ title: string; text: string; links: string[] }> {
  const result = await nativeHttpRequest({
    url,
    method: 'GET',
    timeout: 20000,
    followRedirects: true,
  });
  
  if (result.error || result.status !== 200) {
    throw new Error(`Scrape failed: ${result.error || `HTTP ${result.status}`}`);
  }
  
  const html = result.body;
  
  // Extract title
  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '';
  
  // Remove scripts, styles, and other non-content elements
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
  
  // Limit text size
  if (text.length > 30000) {
    text = text.substring(0, 30000) + '\n... [Content truncated]';
  }
  
  // Extract links
  const linkRegex = /href=["'](https?:\/\/[^"']+)["']/gi;
  const links: string[] = [];
  let linkMatch;
  while ((linkMatch = linkRegex.exec(html)) !== null && links.length < 50) {
    links.push(linkMatch[1]);
  }
  
  return { title, text, links };
}

// Execute a tool call and return the result
export async function executeToolCall(
  toolName: string, 
  params: Record<string, any>
): Promise<{ output: string; error?: string }> {
  try {
    switch (toolName as ToolType) {
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
        const timeout = params.timeout || 30;
        
        if (!code) return { output: '', error: 'No code provided' };
        
        const result = await executeCodeFile(lang, code, timeout);
        let output = '';
        if (result.stdout) output += result.stdout;
        if (result.stderr) output += (output ? '\n[stderr]\n' : '[stderr]\n') + result.stderr;
        if (result.exitCode !== 0) {
          return { output: output || '(no output)', error: `Process exited with code ${result.exitCode}` };
        }
        return { output: output || '(no output)' };
      }
      
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
            const diffPreview = `Edited ${params.path}: Replaced ${oldText.split('\n').length} line(s) with ${newText.split('\n').length} line(s)`;
            return { output: diffPreview };
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
          const result = await nativeHttpRequest({ url: `file://${path}`, method: 'GET' });
          // For native, use shell
          const shellResult = await executeShell(`ls -la "${path}" 2>/dev/null`, 10);
          if (shellResult.exitCode === 0 && shellResult.stdout) {
            return { output: shellResult.stdout };
          }
          // Fallback to listDir API
          const entries = await listDir(path);
          return { output: entries.join('\n') || 'Empty directory' };
        } catch (err: any) {
          return { output: '', error: err.message };
        }
      }
      
      case 'web_fetch': {
        try {
          const result = await nativeHttpRequest({
            url: params.url,
            method: 'GET',
            timeout: 20000,
            followRedirects: true,
          });
          
          if (result.error) {
            return { output: '', error: `Fetch error: ${result.error}` };
          }
          
          if (result.status >= 400) {
            return { output: result.body.substring(0, 2000), error: `HTTP ${result.status}` };
          }
          
          // Try to extract text from HTML
          if (result.body.includes('<html') || result.body.includes('<!DOCTYPE')) {
            const scraped = webScrapeStatic(result.body);
            return { output: scraped.substring(0, 15000) };
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
            return { output: 'No results found' };
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
  const tmpFile = `${homeDir}/.qwencode_tmp_${Date.now()}.${ext}`;
  
  await writeFile(tmpFile, code);
  
  const result = await executeShell(`${runner} "${tmpFile}"`, timeout);
  
  // Cleanup
  await executeShell(`rm -f "${tmpFile}"`, 5);
  
  return result;
}

// Helper: static HTML to text (no network needed)
function webScrapeStatic(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n\s*\n/g, '\n')
    .trim()
    .substring(0, 15000);
}
