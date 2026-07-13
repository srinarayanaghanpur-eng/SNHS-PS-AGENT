import React, { useCallback, useEffect, useState } from 'react';

// The assistant window talks to main only through the typed, context-isolated
// preload bridge (api().assistant*). No Node APIs in the renderer.
type Api = {
  assistantReadState: () => Promise<any>;
  assistantReadActiveLayer: () => Promise<any>;
  assistantCommand: (command: string, liveApply?: boolean) => Promise<any>;
  assistantApplyPlan: (plan: unknown) => Promise<any>;
  assistantUndo: () => Promise<any>;
  assistantRedo: () => Promise<any>;
  assistantRestoreOriginal: () => Promise<any>;
  assistantSaveVersion: () => Promise<any>;
  assistantSearchAssets: (q: string) => Promise<any>;
  assistantDownloadAsset: (url: string, source: string, license?: string) => Promise<any>;
  assistantReplaceBackground: (assetPath: string, fit?: 'cover' | 'contain') => Promise<any>;
  assistantClose: () => Promise<any>;
};
// Access the preload bridge without globally re-declaring Window.posterApi
// (index.tsx already augments it with the full PosterApi type).
const api = (): Api => (window as unknown as { posterApi: Api }).posterApi;

interface LogLine { time: string; text: string; kind: 'info' | 'error' | 'warn' }

export function DesignAssistantWindow() {
  const [command, setCommand] = useState('');
  const [docName, setDocName] = useState('—');
  const [activeLayer, setActiveLayer] = useState<string>('—');
  const [activeLayerId, setActiveLayerId] = useState<number | null>(null);
  const [activeLayerDetails, setActiveLayerDetails] = useState<any | null>(null);
  const [detected, setDetected] = useState<{ layerId: number; role: string; confidence: number; name: string }[]>([]);
  const [liveApply, setLiveApply] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<any | null>(null);
  const [confirmWarning, setConfirmWarning] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [tab, setTab] = useState<'command' | 'asset' | 'background'>('command');
  const [candidates, setCandidates] = useState<any[]>([]);
  const [issues, setIssues] = useState<any[]>([]);
  const [log, setLog] = useState<LogLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState('Ready for a command.');

  const addLog = useCallback((text: string, kind: LogLine['kind'] = 'info') => {
    setLog((l) => [{ time: new Date().toLocaleTimeString(), text, kind }, ...l].slice(0, 200));
  }, []);

  const refreshState = useCallback(async () => {
    const r = await api().assistantReadState();
    if (!r.ok) { addLog(`Cannot read Photoshop: ${r.error}`, 'error'); return; }
    setDocName(r.scene.document.name);
    const flat: any[] = [];
    const walk = (ls: any[]) => ls.forEach((x) => { flat.push(x); if (x.children?.length) walk(x.children); });
    walk(r.scene.layers);
    const active = flat.find((x) => x.id === r.scene.activeLayerId);
    setActiveLayer(active ? active.name : '—');
    setActiveLayerId(r.scene.activeLayerId ?? null);
    setActiveLayerDetails(active ?? null);
  }, [addLog]);

  useEffect(() => { void refreshState(); }, [refreshState]);

  const send = async () => {
    if (!command.trim()) return;
    setBusy(true); setPreview(null); setPendingPlan(null); setConfirmWarning(null); setIssues([]);
    try {
      const r = await api().assistantCommand(command, liveApply);
      handleOutcome(r);
    } catch (e: any) { addLog(String(e?.message ?? e), 'error'); }
    finally { setBusy(false); }
  };

  const handleOutcome = (r: any) => {
    switch (r.status) {
      case 'applied':
        setLastResult('Command applied to the selected Photoshop layer.');
        addLog(`Applied: ${command}`, 'info');
        if (r.result?.previewPath) setPreview(`file://${r.result.previewPath}`);
        if (r.issues?.length) { setIssues(r.issues); r.issues.forEach((i: any) => addLog(`Check: ${i.message}`, i.severity === 'error' ? 'error' : 'warn')); }
        void refreshState();
        break;
      case 'needs_preview':
        setLastResult('Preview ready. Review it before applying.');
        setPendingPlan(r.plan); addLog('Preview ready — review, then Apply.', 'info');
        break;
      case 'needs_confirmation':
        setLastResult(r.warning ?? 'Confirmation required.');
        setPendingPlan(r.plan); setConfirmWarning(r.warning ?? 'Confirm this change?'); addLog(r.warning ?? 'Confirmation required', 'warn');
        break;
      case 'needs_selection':
        setLastResult(r.message ?? 'Select a valid Photoshop layer.');
        setDetected(r.candidates ?? []); addLog(r.message ?? 'Select the intended layer.', 'warn');
        break;
      default:
        setLastResult(r.message ?? 'Command failed.');
        addLog(r.message ?? 'Command failed', 'error');
    }
  };

  const applyPending = async () => {
    if (!pendingPlan) return;
    setBusy(true);
    try { const r = await api().assistantApplyPlan(pendingPlan); handleOutcome(r); setPendingPlan(null); setConfirmWarning(null); }
    finally { setBusy(false); }
  };

  const quick = (text: string) => { setCommand(text); };
  const runQuick = async (text: string) => { setCommand(text); setBusy(true); try { handleOutcome(await api().assistantCommand(text, liveApply)); } finally { setBusy(false); } };

  const history = async (fn: 'assistantUndo' | 'assistantRedo' | 'assistantRestoreOriginal' | 'assistantSaveVersion', label: string) => {
    setBusy(true);
    try { const r = await window.posterApi[fn](); addLog(`${label}: ${r.ok ? 'ok' : r.error}`, r.ok ? 'info' : 'error'); void refreshState(); }
    finally { setBusy(false); }
  };

  const search = async (q: string) => {
    setBusy(true);
    try {
      const r = await api().assistantSearchAssets(q);
      if (r.ok) { setCandidates(r.result.candidates ?? []); addLog(`Found ${r.result.candidates?.length ?? 0} via ${r.result.provider}`, 'info'); if (r.result.note) addLog(r.result.note, 'warn'); }
      else addLog(r.error, 'error');
    } finally { setBusy(false); }
  };

  const choose = async (c: any) => {
    setBusy(true);
    try {
      const r = await api().assistantDownloadAsset(c.fullUrl, c.source, c.license);
      addLog(r.ok ? `Downloaded ${r.width}×${r.height} from ${c.source}` : `Rejected: ${r.reason}`, r.ok ? 'info' : 'error');
      return r;
    } finally { setBusy(false); }
  };

  // Download a candidate, then place it as the new background (behind content).
  const chooseAsBackground = async (c: any) => {
    setBusy(true); setPreview(null); setIssues([]);
    try {
      const dl = await api().assistantDownloadAsset(c.fullUrl, c.source, c.license);
      if (!dl.ok) { addLog(`Rejected: ${dl.reason}`, 'error'); return; }
      addLog(`Downloaded ${dl.width}×${dl.height}; placing as background…`, 'info');
      const r = await api().assistantReplaceBackground(dl.path, 'cover');
      if (r.success) {
        addLog('Background replaced (previous background hidden, not deleted).', 'info');
        if (r.previewPath) setPreview(`file://${r.previewPath}`);
        void refreshState();
      } else addLog(`Background replace failed: ${r.error}`, 'error');
    } finally { setBusy(false); }
  };

  const QUICK = [
    ['Move left', 'move selected 20px left'], ['Move right', 'move selected 20px right'],
    ['Move up', 'move selected 20px up'], ['Move down', 'move selected 20px down'],
    ['Smaller', 'make this 10 percent smaller'], ['Larger', 'make this 10 percent larger'],
    ['Centre horizontally', 'center this horizontally'], ['Centre vertically', 'center this vertically'],
    ['Hide', 'hide selected'], ['Show', 'show selected'],
    ['Lock', 'lock selected'], ['Unlock', 'unlock selected'],
  ];

  return (
    <div style={{ fontFamily: 'Segoe UI, sans-serif', fontSize: 13, padding: 10, display: 'flex', flexDirection: 'column', gap: 8, height: '100vh', boxSizing: 'border-box', overflow: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <b>Design Assistant</b>
        <button onClick={() => api().assistantClose()}>Close</button>
      </div>

      <div style={{ background: '#f2f5fa', borderRadius: 10, padding: 12, display: 'grid', gap: 5 }}>
        <div><b>Document:</b> {docName}</div>
        <div><b>Selected layer:</b> {activeLayer} {activeLayerId != null ? `(#${activeLayerId})` : ''}</div>
        <div><b>Layer type:</b> {activeLayerDetails?.type ?? '—'}</div>
        <div><b>Dimensions:</b> {activeLayerDetails ? `${Math.round(activeLayerDetails.width)} × ${Math.round(activeLayerDetails.height)} px` : '—'}</div>
        <div><b>Position:</b> {activeLayerDetails ? `X ${Math.round(activeLayerDetails.x)}, Y ${Math.round(activeLayerDetails.y)}` : '—'}</div>
        <button onClick={refreshState} disabled={busy}>Use Selected Layer / Refresh</button>
      </div>

      {(
        <>
          <textarea value={command} onChange={(e) => setCommand(e.target.value)} placeholder="e.g. Move the school logo 30 pixels left" rows={2} />
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button onClick={send} disabled={busy || activeLayerId == null}>Apply</button>
            <label><input type="checkbox" checked={liveApply} onChange={(e) => setLiveApply(e.target.checked)} /> Live Apply</label>
          </div>

          <div>
            <b>Quick edits</b>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
              {QUICK.map(([label, cmd]) => (
                <button key={label} disabled={busy || activeLayerId == null} onClick={() => runQuick(cmd)}>{label}</button>
              ))}
            </div>
          </div>

          {detected.length > 0 && (
            <div style={{ background: '#fff7e6', borderRadius: 6, padding: 6 }}>
              <b>Detected elements — pick one</b>
              {detected.map((d) => (
                <div key={d.layerId} style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                  <span>{d.name} · {d.role} · {(d.confidence * 100).toFixed(0)}%</span>
                  <button onClick={() => quick(`${command} (layer ${d.layerId})`)}>Use</button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <div style={{ background: '#eef3f8', borderRadius: 8, padding: 9 }}><b>Command result</b><div>{lastResult}</div></div>

      {(pendingPlan || preview) && (
        <div style={{ background: '#eef6ee', borderRadius: 6, padding: 6 }}>
          <b>Before / after preview</b>
          {confirmWarning && <div style={{ color: '#a15c00', margin: '4px 0' }}>{confirmWarning}</div>}
          {preview && <img src={preview} alt="preview" style={{ maxWidth: '100%', borderRadius: 4, marginTop: 4 }} />}
          {pendingPlan && (
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <button onClick={applyPending} disabled={busy}>Apply</button>
              <button onClick={() => { setPendingPlan(null); setConfirmWarning(null); addLog('Preview cancelled', 'info'); }}>Cancel preview</button>
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        <button onClick={() => history('assistantUndo', 'Undo')} disabled={busy}>Undo</button>
        <button onClick={() => history('assistantRedo', 'Redo')} disabled={busy}>Redo</button>
        <button onClick={() => history('assistantRestoreOriginal', 'Restore original')} disabled={busy}>Restore original</button>
        <button onClick={() => history('assistantSaveVersion', 'Save version')} disabled={busy}>Save version</button>
      </div>

      {issues.length > 0 && (
        <div style={{ background: '#fff0f0', borderRadius: 6, padding: 6 }}>
          <b>Verification</b>
          {issues.map((i, k) => <div key={k} style={{ color: i.severity === 'error' ? '#b00' : '#a15c00' }}>{i.code}: {i.message}</div>)}
        </div>
      )}

      <div style={{ flex: 1 }}>
        <b>Activity log</b>
        <div style={{ background: '#0d1b2a', color: '#cfe', fontFamily: 'monospace', fontSize: 11, borderRadius: 6, padding: 6, maxHeight: 160, overflow: 'auto' }}>
          {log.map((l, k) => <div key={k} style={{ color: l.kind === 'error' ? '#ff8080' : l.kind === 'warn' ? '#ffd580' : '#cfe' }}>{l.time} {l.text}</div>)}
        </div>
      </div>
    </div>
  );
}

function AssetTab({ onSearch, candidates, onChoose, onChooseBackground, busy, label }: { onSearch: (q: string) => void; candidates: any[]; onChoose: (c: any) => void; onChooseBackground?: (c: any) => void; busy: boolean; label: string }) {
  const [q, setQ] = useState('');
  return (
    <div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input style={{ flex: 1 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder={label} />
        <button onClick={() => onSearch(q)} disabled={busy || !q.trim()}>Search</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginTop: 6 }}>
        {candidates.map((c, k) => (
          <div key={k} style={{ border: '1px solid #ddd', borderRadius: 4, padding: 4 }} title={`${c.source} ${c.license ?? ''}`}>
            <img src={c.thumbnailUrl} alt="candidate" style={{ width: '100%', height: 64, objectFit: 'cover', borderRadius: 3 }} />
            <div style={{ fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.width && c.height ? `${c.width}×${c.height}` : ''} {c.source}</div>
            <div style={{ display: 'flex', gap: 3, marginTop: 2 }}>
              <button style={{ fontSize: 10, flex: 1 }} disabled={busy} onClick={() => onChoose(c)}>Download</button>
              {onChooseBackground && <button style={{ fontSize: 10, flex: 1 }} disabled={busy} onClick={() => onChooseBackground(c)}>Use as bg</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
