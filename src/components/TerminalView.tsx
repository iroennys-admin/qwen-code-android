// ==========================================
// OpenCode v2 - Built-in Terminal
// Built-in commands: opencode, oc, help, clear, providers, models
// Falls back to shell on Android device.
// ==========================================

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { executeShell, isNative } from '../services/bridge';
import { runOpencodeCommand, type CliEnv } from '../services/opencode-cli';
import type { AppConfig } from '../types';

interface Line { type: 'cmd' | 'stdout' | 'stderr' | 'info' | 'prompt'; text: string; }

interface Props {
  config: AppConfig;
  onConfigChange: (c: AppConfig) => void;
}

// Tokenize a command line respecting quotes
function tokenize(s: string): string[] {
  const out: string[] = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}

export default function TerminalView({ config, onConfigChange }: Props) {
  const [lines, setLines] = useState<Line[]>([
    { type: 'info',   text: '╔══════════════════════════════════════════════╗\n║  ◆ OpenCode Terminal                         ║\n║  Try:  opencode  ·  help  ·  ls -la /sdcard  ║\n╚══════════════════════════════════════════════╝\n' },
    { type: 'info',   text: isNative() ? `cwd: ${config.workingDir}\n` : `[Web preview — system shell limited]\n` },
  ]);
  const [cmd, setCmd] = useState('');
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const [interactivePrompt, setInteractivePrompt] = useState<string | null>(null);
  const outRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const readLineResolverRef = useRef<((s: string | null) => void) | null>(null);
  const configRef = useRef(config);
  useEffect(() => { configRef.current = config; }, [config]);

  useEffect(() => {
    outRef.current?.scrollTo({ top: outRef.current.scrollHeight });
  }, [lines, running, interactivePrompt]);

  const print = useCallback((text: string, type: 'stdout' | 'stderr' | 'info' = 'stdout') => {
    setLines(l => {
      const last = l[l.length - 1];
      // Coalesce streaming chunks of same type
      if (last && last.type === type && !text.includes('\n') && last.text.length < 8192) {
        const copy = l.slice(0, -1);
        copy.push({ type, text: last.text + text });
        return copy;
      }
      return [...l, { type, text }];
    });
  }, []);

  const readLine = useCallback((prompt: string): Promise<string | null> => {
    return new Promise(resolve => {
      setInteractivePrompt(prompt);
      readLineResolverRef.current = resolve;
      setTimeout(() => inputRef.current?.focus(), 50);
    });
  }, []);

  const runCmd = useCallback(async (command: string) => {
    if (!command.trim()) return;

    // If we're in an interactive readLine, deliver the answer
    if (readLineResolverRef.current) {
      const resolve = readLineResolverRef.current;
      readLineResolverRef.current = null;
      const prompt = interactivePrompt || '';
      setInteractivePrompt(null);
      setLines(l => [...l, { type: 'cmd', text: `${prompt}${command}\n` }]);
      setCmd('');
      resolve(command);
      return;
    }

    setRunning(true);
    setLines(l => [...l, { type: 'cmd', text: `$ ${command}\n` }]);
    setHistory(h => [...h, command]);
    setHistIdx(-1);
    setCmd('');

    const tokens = tokenize(command);
    const head = tokens[0];

    // ---- Built-in commands ----
    if (head === 'clear' || head === 'cls') {
      setLines([]);
      setRunning(false);
      return;
    }

    if (head === 'help') {
      print(`OpenCode Terminal\n\n` +
            `Built-in commands:\n` +
            `  opencode [prompt]    AI agent (REPL or one-shot)\n` +
            `  oc [prompt]          Short alias of opencode\n` +
            `  providers            List AI providers\n` +
            `  models               List models for active provider\n` +
            `  clear                Clear screen\n` +
            `  cd <dir>             Change directory (sets working dir)\n` +
            `  exit                 (no-op)\n` +
            `\nAnything else runs as a shell command on the device.\n`, 'info');
      setRunning(false);
      return;
    }

    if (head === 'cd') {
      const target = tokens[1] || '/sdcard';
      onConfigChange({ ...configRef.current, workingDir: target });
      print(`cwd: ${target}\n`, 'info');
      setRunning(false);
      return;
    }

    if (head === 'providers') {
      for (const p of config.providers) {
        const star = p.id === config.activeProvider ? '*' : ' ';
        print(` ${star} ${(p.emoji || '·')} ${p.id.padEnd(12)} ${p.name}${p.isFree ? ' [FREE]' : ''}${p.apiKey ? ' 🔑' : ''}\n`);
      }
      setRunning(false);
      return;
    }
    if (head === 'models') {
      const p = config.providers.find(x => x.id === config.activeProvider);
      if (p) for (const m of p.models) {
        const star = m.id === config.activeModel ? '*' : ' ';
        print(` ${star} ${m.id} — ${m.name}${m.isFree ? ' [FREE]' : ''}\n`);
      }
      setRunning(false);
      return;
    }

    if (head === 'opencode' || head === 'oc') {
      const env: CliEnv = {
        config: configRef.current,
        saveConfig: (c) => { onConfigChange(c); configRef.current = c; },
        print,
        readLine,
        setBusy: setRunning,
      };
      try {
        await runOpencodeCommand(tokens.slice(1), env);
      } catch (e: any) {
        print(`\n✗ ${e.message || e}\n`, 'stderr');
      } finally {
        setRunning(false);
      }
      return;
    }

    if (head === 'exit') {
      print('(use back button to leave terminal)\n', 'info');
      setRunning(false);
      return;
    }

    // ---- Fallback to system shell ----
    try {
      const r = await executeShell(command, 60, config.workingDir);
      if (r.stdout) print(r.stdout);
      if (r.stderr) print(r.stderr, 'stderr');
      if (r.exitCode !== 0) print(`\n[exit ${r.exitCode}]\n`, 'stderr');
    } catch (err: any) {
      print((err?.message || String(err)) + '\n', 'stderr');
    } finally {
      setRunning(false);
    }
  }, [config, interactivePrompt, print, readLine, onConfigChange]);

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); runCmd(cmd); }
    else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length) {
        const idx = histIdx < 0 ? history.length - 1 : Math.max(0, histIdx - 1);
        setHistIdx(idx); setCmd(history[idx]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (histIdx >= 0) {
        const idx = histIdx + 1;
        if (idx >= history.length) { setHistIdx(-1); setCmd(''); }
        else { setHistIdx(idx); setCmd(history[idx]); }
      }
    } else if (e.key === 'c' && e.ctrlKey) {
      e.preventDefault();
      if (readLineResolverRef.current) {
        readLineResolverRef.current(null);
        readLineResolverRef.current = null;
        setInteractivePrompt(null);
      }
      print('^C\n', 'stderr');
      setCmd('');
      setRunning(false);
    }
  };

  const promptText = interactivePrompt || '$';
  const placeholder =
    interactivePrompt ? '' :
    running ? 'ejecutando…' : 'comando';

  return (
    <div className="terminal">
      <div className="terminal-output scroll" ref={outRef}>
        {lines.map((l, i) => (
          <span key={i} className={l.type}>{l.text}</span>
        ))}
        {interactivePrompt && (
          <span className="prompt">{interactivePrompt}</span>
        )}
        {running && !interactivePrompt && (
          <span className="cmd"><span className="typing"><span /><span /><span /></span></span>
        )}
      </div>
      <div className="terminal-input">
        <span>{interactivePrompt ? '›' : '$'}</span>
        <input
          ref={inputRef}
          value={cmd}
          onChange={e => setCmd(e.target.value)}
          onKeyDown={handleKey}
          placeholder={placeholder}
          disabled={running && !interactivePrompt}
          autoCorrect="off" autoCapitalize="off" spellCheck={false}
        />
      </div>
    </div>
  );
}
