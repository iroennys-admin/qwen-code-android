// ==========================================
// OpenCode v2 - About
// ==========================================

import React, { useEffect, useState } from 'react';
import { getDeviceInfo, loadTodos, saveTodos, loadMemory, saveMemory } from '../services/bridge';

export default function AboutView() {
  const [info, setInfo] = useState<any>({});
  const [todos, setTodos] = useState<any[]>([]);
  const [mem, setMem] = useState<Record<string, any>>({});

  useEffect(() => {
    getDeviceInfo().then(setInfo);
    setTodos(loadTodos());
    setMem(loadMemory());
  }, []);

  return (
    <div className="settings scroll">
      <div className="section">
        <h3>◆ OpenCode AI v2</h3>
        <p className="muted small">Agente de IA con herramientas reales sobre Android. Multi-proveedor, multi-modelo, gratis.</p>
        <div className="divider" />
        <div className="muted small">Construido con React + Capacitor. UI Aurora. Tools: shell, file_*, web_*, memory, todos, clipboard.</div>
      </div>

      <div className="section">
        <h3>📱 Dispositivo</h3>
        <div className="row"><div className="label">Modelo</div><div className="value">{info.manufacturer} {info.model}</div></div>
        <div className="row"><div className="label">Android</div><div className="value">{info.androidVersion} (SDK {info.sdkVersion})</div></div>
        <div className="row"><div className="label">Almacenamiento libre</div><div className="value">{formatGB(info.freeStorage)} / {formatGB(info.totalStorage)}</div></div>
        <div className="row"><div className="label">Root</div><div className="value">{info.isRooted ? '✅' : '❌'}</div></div>
      </div>

      <div className="section">
        <h3>✅ TODOs ({todos.length})</h3>
        {todos.length === 0 && <div className="muted small">(vacío) — el agente puede añadir todos durante la conversación.</div>}
        {todos.map(t => (
          <div key={t.id} className="row">
            <div className="label">
              {t.done ? '✅' : '⬜'} {t.text}
              <div className="sub tiny">{new Date(t.createdAt).toLocaleString()}</div>
            </div>
            <button className="btn btn-sm" onClick={() => { t.done = !t.done; const ns = [...todos]; setTodos(ns); saveTodos(ns); }}>
              {t.done ? '↺' : '✓'}
            </button>
            <button className="btn btn-sm btn-danger" onClick={() => { const ns = todos.filter(x => x.id !== t.id); setTodos(ns); saveTodos(ns); }}>🗑</button>
          </div>
        ))}
      </div>

      <div className="section">
        <h3>🧠 Memoria ({Object.keys(mem).length})</h3>
        {Object.keys(mem).length === 0 && <div className="muted small">(vacío) — el agente puede guardar facts con memory_save.</div>}
        {Object.entries(mem).map(([k, v]: any) => (
          <div key={k} className="row">
            <div className="label">
              <strong>{k}</strong>
              <div className="sub">{v.value}</div>
            </div>
            <button className="btn btn-sm btn-danger" onClick={() => { const ns = { ...mem }; delete ns[k]; setMem(ns); saveMemory(ns); }}>🗑</button>
          </div>
        ))}
      </div>

      <div className="section">
        <h3>🔗 Enlaces</h3>
        <a className="btn btn-ghost" href="https://github.com/iroennys-admin/qwen-code-android" target="_blank" rel="noreferrer" style={{ width: '100%', marginBottom: 8 }}>📦 Código fuente</a>
        <a className="btn btn-ghost" href="https://github.com/iroennys-admin/qwen-code-android/releases" target="_blank" rel="noreferrer" style={{ width: '100%' }}>⬇️ Última versión</a>
      </div>
    </div>
  );
}

function formatGB(b: number): string {
  if (!b) return '?';
  return `${(b / (1024 ** 3)).toFixed(1)} GB`;
}
