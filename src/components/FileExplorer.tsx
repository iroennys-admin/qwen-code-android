// ==========================================
// OpenCode v2 - File Explorer
// ==========================================

import React, { useEffect, useState } from 'react';
import { listDir, readFile, writeFile, deletePath, isNative } from '../services/bridge';

interface Entry { name: string; isDir: boolean; size?: number; }

export default function FileExplorer({ initialPath = '/sdcard' }: { initialPath?: string }) {
  const [path, setPath] = useState(initialPath);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ path: string; content: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true); setError(null);
    try {
      if (!isNative()) {
        setEntries([
          { name: 'Documentos', isDir: true },
          { name: 'Download', isDir: true },
          { name: 'notes.txt', isDir: false, size: 1234 },
          { name: 'README.md', isDir: false, size: 4567 },
        ]);
      } else {
        const list = await listDir(path, true);
        list.sort((a: any, b: any) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : (a.isDir ? -1 : 1)));
        setEntries(list);
      }
    } catch (e: any) { setError(e?.message || 'Error'); setEntries([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { refresh(); }, [path]);

  const goUp = () => {
    if (path === '/' || !path) return;
    const p = path.replace(/\/$/, '').split('/').slice(0, -1).join('/') || '/';
    setPath(p);
  };

  const open = async (e: Entry) => {
    const full = path.replace(/\/$/, '') + '/' + e.name;
    if (e.isDir) { setPath(full); return; }
    try {
      const content = await readFile(full);
      setEditor({ path: full, content });
    } catch (err: any) { setError(err?.message || 'Cannot read'); }
  };

  const remove = async (e: Entry) => {
    const full = path.replace(/\/$/, '') + '/' + e.name;
    if (!confirm(`Eliminar ${e.name}?`)) return;
    try { await deletePath(full, e.isDir); await refresh(); }
    catch (err: any) { setError(err?.message || 'Cannot delete'); }
  };

  const save = async () => {
    if (!editor) return;
    try { await writeFile(editor.path, editor.content); setEditor(null); await refresh(); }
    catch (err: any) { setError(err?.message || 'Cannot save'); }
  };

  if (editor) {
    return (
      <div className="files">
        <div className="path-bar">
          <button className="btn btn-sm" onClick={() => setEditor(null)}>← Volver</button>
          <span className="crumb active" style={{ marginLeft: 8 }}>{editor.path}</span>
        </div>
        <textarea
          style={{ height: 'calc(100vh - 260px)', fontFamily: 'var(--font-mono)', fontSize: 13 }}
          value={editor.content}
          onChange={e => setEditor({ ...editor, content: e.target.value })}
        />
        <div className="flex gap-2" style={{ marginTop: 8 }}>
          <button className="btn btn-primary" onClick={save}>💾 Guardar</button>
          <button className="btn" onClick={() => setEditor(null)}>Cancelar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="files scroll">
      <div className="path-bar scroll">
        <button className="btn btn-sm" onClick={goUp}>↑</button>
        <span className="crumb active">{path}</span>
        <span style={{ flex: 1 }} />
        <button className="btn btn-sm" onClick={refresh}>🔄</button>
      </div>
      {error && <div className="tool-call error"><div className="tc-body">{error}</div></div>}
      {loading ? <div className="muted center" style={{ padding: 16 }}>Cargando…</div> :
        entries.length === 0 ? <div className="muted center" style={{ padding: 16 }}>(vacío)</div> :
        entries.map((e, i) => (
          <div key={i} className="file-row" onClick={() => open(e)}>
            <span className="icon">{e.isDir ? '📁' : iconFor(e.name)}</span>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {e.name}{e.isDir ? '/' : ''}
            </span>
            {!e.isDir && e.size != null && <span className="meta">{formatSize(e.size)}</span>}
            <button className="btn btn-sm btn-danger" onClick={ev => { ev.stopPropagation(); remove(e); }} style={{ marginLeft: 8 }}>🗑</button>
          </div>
        ))
      }
    </div>
  );
}

function iconFor(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase();
  if (!ext) return '📄';
  if (['js','ts','tsx','jsx','mjs'].includes(ext)) return '🟨';
  if (['py'].includes(ext)) return '🐍';
  if (['md','txt'].includes(ext)) return '📝';
  if (['json'].includes(ext)) return '📋';
  if (['html','css'].includes(ext)) return '🌐';
  if (['png','jpg','jpeg','gif','webp','svg'].includes(ext)) return '🖼️';
  if (['mp4','webm','mkv','avi'].includes(ext)) return '🎬';
  if (['mp3','wav','ogg','m4a'].includes(ext)) return '🎵';
  if (['zip','tar','gz','7z'].includes(ext)) return '🗜️';
  if (['apk'].includes(ext)) return '📦';
  return '📄';
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
