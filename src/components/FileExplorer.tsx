import React, { useState, useEffect } from 'react';
import type { AppConfig } from '../types';
import { listDir, readFile, getHomeDir } from '../services/bridge';

interface FileNode {
  name: string;
  path: string;
  isDir: boolean;
  children?: FileNode[];
  expanded?: boolean;
  content?: string;
}

interface FileExplorerProps {
  config: AppConfig;
}

export default function FileExplorer({ config }: FileExplorerProps) {
  const [currentPath, setCurrentPath] = useState('/home/user');
  const [items, setItems] = useState<FileNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    loadDirectory(currentPath);
  }, [currentPath]);
  
  const loadDirectory = async (path: string) => {
    setLoading(true);
    try {
      const entries = await listDir(path);
      const nodes: FileNode[] = entries.map(name => ({
        name,
        path: `${path}/${name}`.replace(/\/+/g, '/'),
        isDir: !name.includes('.'),
      }));
      nodes.sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      setItems(nodes);
    } catch (err: any) {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };
  
  const openFile = async (path: string) => {
    setSelectedFile(path);
    try {
      const content = await readFile(path);
      setFileContent(content);
    } catch (err: any) {
      setFileContent(`Error: ${err.message}`);
    }
  };
  
  const navigateTo = (path: string) => {
    setCurrentPath(path);
    setSelectedFile(null);
    setFileContent('');
  };
  
  const pathParts = currentPath.split('/').filter(Boolean);
  
  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Path Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-xs)',
        padding: 'var(--space-sm) var(--space-md)',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-primary)',
        overflow: 'auto',
      }}>
        <span style={{ color: 'var(--accent-secondary)', fontSize: 14 }}>📁</span>
        <button
          onClick={() => navigateTo('/')}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--accent-secondary)',
            cursor: 'pointer',
            fontSize: 12,
            fontFamily: 'var(--font-mono)',
          }}
        >
          /
        </button>
        {pathParts.map((part, i) => (
          <React.Fragment key={i}>
            <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>/</span>
            <button
              onClick={() => navigateTo('/' + pathParts.slice(0, i + 1).join('/'))}
              style={{
                background: 'none',
                border: 'none',
                color: i === pathParts.length - 1 ? 'var(--text-primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: 12,
                fontFamily: 'var(--font-mono)',
              }}
            >
              {part}
            </button>
          </React.Fragment>
        ))}
      </div>
      
      {/* Content Area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* File List */}
        <div style={{
          width: selectedFile ? '40%' : '100%',
          overflow: 'auto',
          borderRight: selectedFile ? '1px solid var(--border-primary)' : 'none',
        }}>
          {loading ? (
            <div style={{ padding: 'var(--space-lg)', textAlign: 'center', color: 'var(--text-tertiary)' }}>
              Cargando...
            </div>
          ) : items.length === 0 ? (
            <div style={{ padding: 'var(--space-lg)', textAlign: 'center', color: 'var(--text-tertiary)' }}>
              Directorio vacío
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.path}
                onClick={() => item.isDir ? navigateTo(item.path) : openFile(item.path)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-sm)',
                  padding: '10px var(--space-md)',
                  cursor: 'pointer',
                  borderBottom: '1px solid var(--border-secondary)',
                  transition: 'background var(--transition-fast)',
                }}
                onMouseOver={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ fontSize: 16 }}>
                  {item.isDir ? '📁' : getFileIcon(item.name)}
                </span>
                <span style={{
                  fontSize: 13,
                  color: item.isDir ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontWeight: item.isDir ? 500 : 400,
                }}>
                  {item.name}
                </span>
              </div>
            ))
          )}
        </div>
        
        {/* File Content */}
        {selectedFile && (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '8px var(--space-md)',
              background: 'var(--bg-secondary)',
              borderBottom: '1px solid var(--border-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                {selectedFile}
              </span>
              <button
                onClick={() => { setSelectedFile(null); setFileContent(''); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-tertiary)',
                  cursor: 'pointer',
                  fontSize: 16,
                }}
              >
                ✕
              </button>
            </div>
            <pre style={{
              flex: 1,
              overflow: 'auto',
              padding: 'var(--space-md)',
              margin: 0,
              fontSize: 12,
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-secondary)',
              background: 'rgba(0,0,0,0.2)',
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
            }}>
              {fileContent}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

function getFileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const icons: Record<string, string> = {
    py: '🐍', js: '📜', ts: '📘', jsx: '⚛️', tsx: '⚛️',
    json: '📋', md: '📝', txt: '📄', html: '🌐', css: '🎨',
    java: '☕', kt: '🟣', xml: '📄', yaml: '📋', yml: '📋',
    sh: '💻', bash: '💻', zsh: '💻', env: '🔐',
    jpg: '🖼️', png: '🖼️', gif: '🖼️', svg: '🖼️',
    zip: '📦', tar: '📦', gz: '📦',
  };
  return icons[ext] || '📄';
}
