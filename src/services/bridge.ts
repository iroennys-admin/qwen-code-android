import type { ShellResult, ToolType } from '../types';

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

export const isNative = (): boolean => {
  return !!(window.QwenCodeBridge?.isCapacitor?.() || window.AndroidBridge);
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
  if (cmd.startsWith('python3 ') || cmd.startsWith('python ')) {
    return { stdout: 'Python 3.11.0', stderr: '', exitCode: 0 };
  }
  if (cmd.startsWith('node ') || cmd.startsWith('node -e')) {
    return { stdout: 'Node.js v20.0.0', stderr: '', exitCode: 0 };
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

export async function deleteFile(path: string): Promise<boolean> {
  if (window.QwenCodeBridge) {
    return await window.QwenCodeBridge.delete(path);
  }
  const result = await executeShell(`rm -rf "${path}"`);
  return result.exitCode === 0;
}

export async function getHomeDir(): Promise<string> {
  if (window.QwenCodeBridge) {
    return await window.QwenCodeBridge.getHomeDir();
  }
  return '/home/user';
}

export async function getWorkingDir(): Promise<string> {
  if (window.QwenCodeBridge) {
    return await window.QwenCodeBridge.getWorkingDir();
  }
  return '/home/user';
}

export async function setWorkingDir(dir: string): Promise<boolean> {
  if (window.QwenCodeBridge) {
    return await window.QwenCodeBridge.setWorkingDir(dir);
  }
  return true;
}

// Code execution - runs code in a specific language and returns output
async function executeCode(language: string, code: string, timeout: number = 30): Promise<ShellResult> {
  let command: string;
  
  switch (language.toLowerCase()) {
    case 'python':
    case 'python3':
      command = `python3 -c ${shellEscape(code)}`;
      break;
    case 'javascript':
    case 'js':
    case 'node':
      command = `node -e ${shellEscape(code)}`;
      break;
    case 'bash':
    case 'sh':
    case 'shell':
      command = code;
      break;
    case 'ruby':
      command = `ruby -e ${shellEscape(code)}`;
      break;
    case 'perl':
      command = `perl -e ${shellEscape(code)}`;
      break;
    default:
      // Try running with the language as command
      command = `${language} ${shellEscape(code)}`;
  }
  
  return executeShell(command, timeout);
}

function shellEscape(str: string): string {
  // Escape single quotes and wrap in single quotes
  return "'" + str.replace(/'/g, "'\\''") + "'";
}

// Write code to a temp file and execute it (more reliable than -c/-e for complex code)
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
  const tmpFile = `/tmp/qwen_code_${Date.now()}.${ext}`;
  
  // Write code to file
  await writeFile(tmpFile, code);
  
  // Execute
  const result = await executeShell(`${runner} "${tmpFile}"`, timeout);
  
  // Cleanup
  await executeShell(`rm -f "${tmpFile}"`, 5);
  
  return result;
}

// Execute a tool call and return the result
export async function executeToolCall(
  toolName: string, 
  params: Record<string, any>
): Promise<{ output: string; error?: string }> {
  const startTime = Date.now();
  
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
        
        if (!code) {
          return { output: '', error: 'No code provided' };
        }
        
        // Try file-based execution first (more reliable for complex code)
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
        const content = await readFile(params.path);
        if (!content || content.startsWith('[File content of')) {
          return { output: '', error: `Could not read file: ${params.path}` };
        }
        // Support line range
        if (params.start_line || params.end_line) {
          const lines = content.split('\n');
          const start = (params.start_line || 1) as number - 1;
          const end = (params.end_line || lines.length) as number;
          const selected = lines.slice(start, end);
          // Add line numbers
          const numbered = selected.map((line, i) => `${start + i + 1}: ${line}`).join('\n');
          return { output: numbered };
        }
        return { output: content };
      }
      
      case 'file_write': {
        const success = await writeFile(params.path, params.content);
        return { output: success ? `File written: ${params.path}` : 'Failed to write file', error: success ? undefined : 'Write failed' };
      }
      
      case 'file_edit': {
        const content = await readFile(params.path);
        if (!content || content.startsWith('[File content of')) {
          return { output: '', error: `Could not read file for editing: ${params.path}` };
        }
        
        const oldText = params.old_text as string;
        const newText = params.new_text as string;
        
        if (!content.includes(oldText)) {
          // Try to give helpful context about what's in the file
          const firstLines = content.split('\n').slice(0, 10).join('\n');
          return { output: '', error: `Text not found in ${params.path}. File starts with:\n${firstLines}` };
        }
        
        // Replace first occurrence or all occurrences
        const replaceAll = params.replace_all as boolean;
        let newContent: string;
        if (replaceAll) {
          newContent = content.split(oldText).join(newText);
        } else {
          newContent = content.replace(oldText, newText);
        }
        
        const success = await writeFile(params.path, newContent);
        
        if (success) {
          // Show a diff-like preview
          const oldLines = oldText.split('\n');
          const newLines = newText.split('\n');
          const diffPreview = [
            `Edited ${params.path}:`,
            `Removed ${oldLines.length} line(s), Added ${newLines.length} line(s)`,
            ...(newLines.slice(0, 5).map(l => `+ ${l}`)),
            ...(newLines.length > 5 ? [`... and ${newLines.length - 5} more lines`] : []),
          ].join('\n');
          return { output: diffPreview };
        }
        return { output: '', error: 'Failed to write edited file' };
      }
      
      case 'mkdir': {
        const result = await executeShell(`mkdir -p "${params.path}"`, 10);
        if (result.exitCode !== 0) {
          return { output: '', error: `Failed to create directory: ${result.stderr}` };
        }
        return { output: `Directory created: ${params.path}` };
      }
      
      case 'rm': {
        const path = params.path as string;
        const recursive = params.recursive as boolean;
        const flag = recursive ? '-rf' : '-f';
        const result = await executeShell(`rm ${flag} "${path}"`, 10);
        if (result.exitCode !== 0) {
          return { output: '', error: `Failed to delete: ${result.stderr}` };
        }
        return { output: `Deleted: ${path}` };
      }
      
      case 'mv': {
        const result = await executeShell(`mv "${params.source}" "${params.destination}"`, 10);
        if (result.exitCode !== 0) {
          return { output: '', error: `Failed to move: ${result.stderr}` };
        }
        return { output: `Moved: ${params.source} -> ${params.destination}` };
      }
      
      case 'cp': {
        const recursive = params.recursive as boolean;
        const flag = recursive ? '-r' : '';
        const result = await executeShell(`cp ${flag} "${params.source}" "${params.destination}"`, 10);
        if (result.exitCode !== 0) {
          return { output: '', error: `Failed to copy: ${result.stderr}` };
        }
        return { output: `Copied: ${params.source} -> ${params.destination}` };
      }
      
      case 'list_dir': {
        const path = params.path || await getHomeDir();
        const all = params.all as boolean;
        const flag = all ? '-la' : '-la';
        const result = await executeShell(`ls ${flag} "${path}"`, 10);
        if (result.exitCode !== 0) {
          return { output: '', error: `Failed to list directory: ${result.stderr}` };
        }
        return { output: result.stdout };
      }
      
      case 'web_fetch': {
        try {
          const response = await fetch(params.url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/125.0.0.0 Mobile Safari/537.36',
            },
          });
          const text = await response.text();
          if (!response.ok) {
            return { output: text.substring(0, 2000), error: `HTTP ${response.status}` };
          }
          return { output: text.substring(0, 15000) };
        } catch (err: any) {
          return { output: '', error: `Fetch failed: ${err.message}` };
        }
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
