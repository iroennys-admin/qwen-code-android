// ==========================================
// OpenCode Android - File Explorer
// ==========================================

import React, { useState, useEffect, useCallback } from 'react';
import type { AppConfig } from '../types';
import { listDir, readFile, isNative } from '../services/bridge';

interface FileExplorerProps {
  config: AppConfig;
}

interface FileEntry {
  name: string;
  path: string;
  isDir: boolean;
  size?: number;
}

export default function FileExplorer({ config }: FileExplorerProps) {
  const [currentPath, setCurrentPath] = useState('/sdcard');
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [loading, setLoading] = useState(false);

  const loadDir = useCallback(async (path: string) => {
    setLoading(true);
    try {
      const result = await listDir(path);
      const mapped = (result || []).map((e: any) => ({
        name: e.name || e.path?.split('/').pop() || '?',
        path: e.path || `${path}/${e.name}`,
        isDir: e.isDir || false,
        size: e.size,
      }));
      // Sort: dirs first, then alphabetical
      mapped.sort((a: FileEntry, b: FileEntry) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      setEntries(mapped);
      setCurrentPath(path);
      setSelectedFile(null);
      setFileContent('');
    } catch (err: any) {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDir(currentPath); }, []);

  const handleEntryClick = useCallback(async (entry: FileEntry) => {
    if (entry.isDir) {
      loadDir(entry.path);
    } else {
      setSelectedFile(entry.path);
      try {
        const content = await readFile(entry.path);
        setFileContent(content);
      } catch {
        setFileContent('[Cannot read file]');
      }
    }
  }, [loadDir]);

  const goUp = useCallback(() => {
    const parent = currentPath.split('/').slice(0, -1).join('/') || '/';
    loadDir(parent);
  }, [currentPath, loadDir]);

  const fileIcon = (entry: FileEntry) => {
    if (entry.isDir) return '📁';
    const ext = entry.name.split('.').pop()?.toLowerCase() || '';
    const icons: Record<string, string> = {
      js: '📜', ts: '📘', tsx: '⚛️', jsx: '⚛️',
      py: '🐍', java: '☕', json: '📋', md: '📝',
      txt: '📄', xml: '📄', html: '🌐', css: '🎨',
      sh: '💻', yml: '⚙️', yaml: '⚙️', env: '🔒',
    };
    return icons[ext] || '📄';
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  // Breadcrumb
  const pathParts = currentPath.split('/').filter(Boolean);

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg-primary)',
    }}>
      {/* Header / Breadcrumb */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-sm)',
        padding: '8px var(--space-md)',
        borderBottom: '1px solid var(--border-primary)',
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        overflow: 'auto',
      }}>
        <button
          onClick={goUp}
          style={{
            background: 'none',
            border: '1px solid var(--border-primary)',
            color: 'var(--accent-green)',
            padding: '2px 8px',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
          }}
        >
          ←
        </button>
        <span style={{ color: 'var(--text-tertiary)' }}> / </span>
        {pathParts.map((part, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              onClick={() => loadDir('/' + pathParts.slice(0, i + 1).join('/'))}
              style={{
                background: 'none',
                border: 'none',
                color: i === pathParts.length - 1 ? 'var(--accent-green)' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                padding: 0,
              }}
            >
              {part}
            </button>
            {i < pathParts.length - 1 && <span style={{ color: 'var(--text-tertiary)' }}>/</span>}
          </span>
        ))}
      </div>

      {/* Content: File list + Preview */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* File List */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          borderRight: selectedFile ? '1px solid var(--border-primary)' : 'none',
        }}>
          {loading ? (
            <div style={{ padding: 'var(--space-lg)', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', textAlign: 'center' }}>
              Cargando...
            </div>
          ) : entries.length === 0 ? (
            <div style={{ padding: 'var(--space-lg)', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', textAlign: 'center' }}>
              Directorio vacío
            </div>
          ) : (
            entries.map((entry, i) => (
              <button
                key={i}
                onClick={() => handleEntryClick(entry)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-sm)',
                  padding: '8px var(--space-md)',
                  border: 'none',
                  borderBottom: '1px solid rgba(255,255,255,0.03)',
                  background: selectedFile === entry.path ? 'var(--bg-active)' : 'transparent',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 13,
                }}
              >
                <span>{fileIcon(entry)}</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {entry.name}
                </span>
                {entry.size && !entry.isDir && (
                  <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                    {formatSize(entry.size)}
                  </span>
                )}
              </button>
            ))
          )}
        </div>

        {/* File Preview */}
        {selectedFile && (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '6px var(--space-md)',
              borderBottom: '1px solid var(--border-primary)',
              fontSize: 12,
              color: 'var(--accent-green)',
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {selectedFile.split('/').pop()}
            </div>
            <pre style={{
              flex: 1,
              overflow: 'auto',
              padding: 'var(--space-md)',
              margin: 0,
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              lineHeight: 1.5,
              color: 'var(--text-primary)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}>
              {fileContent.substring(0, 50000) || '[Empty file]'}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
