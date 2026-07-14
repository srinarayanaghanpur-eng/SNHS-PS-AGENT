import React, { useCallback, useEffect, useRef, useState } from 'react';

type BridgeResult<T = any> = {
  success: boolean;
  operation: string;
  message: string;
  data?: T;
  errorCode?: string;
  technicalDetails?: string;
};

type QuickOperation =
  | { operation: 'move'; deltaX: number; deltaY: number }
  | { operation: 'resize'; scalePercent: number }
  | { operation: 'centre'; horizontal: boolean; vertical: boolean }
  | { operation: 'setText'; text: string }
  | { operation: 'hide' | 'show' | 'lock' | 'unlock' };

type Api = {
  assistantReadState: () => Promise<BridgeResult>;
  photoshopLaunch: () => Promise<BridgeResult>;
  assistantSelectPsd: () => Promise<BridgeResult>;
  assistantOpenRecentPsd: () => Promise<BridgeResult>;
  assistantQuickOperation: (input: QuickOperation) => Promise<BridgeResult>;
  assistantParseCommand: (command: string) => Promise<BridgeResult>;
  assistantCommand: (command: string, liveApply?: boolean) => Promise<BridgeResult>;
  assistantUndo: () => Promise<BridgeResult>;
  assistantRedo: () => Promise<BridgeResult>;
  assistantSaveVersion: () => Promise<BridgeResult>;
  assistantExportPng: () => Promise<BridgeResult>;
  assistantClose: () => Promise<any>;
};

const api = (): Api => (window as unknown as { posterApi: Api }).posterApi;

interface LogLine { time: string; text: string; kind: 'info' | 'error' | 'warn' }
type ConnectionState = 'checking' | 'not_running' | 'no_document' | 'no_layer' | 'ready' | 'error';

function detailsFor(result: BridgeResult): string {
  return result.success
    ? result.message
    : `ERROR ${result.errorCode || 'PHOTOSHOP_OPERATION_FAILED'}: ${result.message}${result.technicalDetails ? ` — ${result.technicalDetails}` : ''}`;
}

export function DesignAssistantWindow() {
  const [command, setCommand] = useState('');
  const [connection, setConnection] = useState<ConnectionState>('checking');
  const [statusMessage, setStatusMessage] = useState('Checking Photoshop…');
  const [document, setDocument] = useState<any | null>(null);
  const [layer, setLayer] = useState<any | null>(null);
  const [parsedOperation, setParsedOperation] = useState('—');
  const [log, setLog] = useState<LogLine[]>([]);
  const [busy, setBusy] = useState(false);
  const lastState = useRef('');

  const addLog = useCallback((text: string, kind: LogLine['kind'] = 'info') => {
    setLog((lines) => [{ time: new Date().toLocaleTimeString('en-GB'), text, kind }, ...lines].slice(0, 200));
  }, []);

  const refreshState = useCallback(async (announce = true) => {
    const result = await api().assistantReadState();
    if (!result.success) {
      setConnection('error'); setStatusMessage(result.message); setDocument(null); setLayer(null);
      addLog(detailsFor(result), 'error'); return;
    }
    const state = result.data?.state as ConnectionState;
    setConnection(state); setStatusMessage(result.message);
    setDocument(result.data?.document ?? null); setLayer(result.data?.layer ?? null);
    const signature = `${state}|${result.data?.document?.path || ''}|${result.data?.layer?.id || ''}`;
    if (announce || signature !== lastState.current) {
      if (state === 'not_running') addLog('Photoshop is not running.', 'warn');
      else if (state === 'no_document') addLog('ERROR PHOTOSHOP_NO_DOCUMENT: No active Photoshop document was found.', 'error');
      else {
        addLog('Photoshop detected.');
        if (result.data?.document?.name) addLog(`Opened ${result.data.document.name}`);
        if (result.data?.layer?.name) addLog(`Selected layer: ${result.data.layer.name}`);
      }
    }
    lastState.current = signature;
  }, [addLog]);

  useEffect(() => { void refreshState(true); }, [refreshState]);

  const runBridge = async (label: string, action: () => Promise<BridgeResult>) => {
    setBusy(true);
    try {
      const result = await action();
      addLog(result.success ? result.message || label : detailsFor(result), result.success ? 'info' : 'error');
      if (result.success) await refreshState(false);
      return result;
    } finally { setBusy(false); }
  };

  const launch = async () => { await runBridge('Photoshop launched.', () => api().photoshopLaunch()); };
  const openPsd = async (recent: boolean) => {
    await runBridge('PSD opened.', () => recent ? api().assistantOpenRecentPsd() : api().assistantSelectPsd());
  };

  const runQuick = async (input: QuickOperation, label: string) => {
    setParsedOperation(label);
    addLog(`Parsed operation: ${label}`);
    const result = await runBridge(label, () => api().assistantQuickOperation(input));
    if (result?.success && result.data?.before && result.data?.after) {
      const before = result.data.before; const after = result.data.after;
      addLog(`${before.name}: X ${Math.round(before.x)} → ${Math.round(after.x)}, Y ${Math.round(before.y)} → ${Math.round(after.y)}, ${Math.round(before.width)}×${Math.round(before.height)} → ${Math.round(after.width)}×${Math.round(after.height)}`);
    }
  };

  const send = async () => {
    if (!command.trim()) return;
    setBusy(true);
    try {
      const parsed = await api().assistantParseCommand(command);
      if (!parsed.success) { setParsedOperation('—'); addLog(detailsFor(parsed), 'error'); return; }
      setParsedOperation(parsed.data?.label || parsed.message);
      addLog(parsed.message);
      const result = await api().assistantCommand(command, true);
      addLog(result.success ? result.message : detailsFor(result), result.success ? 'info' : 'error');
      if (result.success) await refreshState(false);
    } finally { setBusy(false); }
  };

  const canEdit = connection === 'ready' && Boolean(layer);
  const canTransform = canEdit && !layer?.locked;
  const isText = canEdit && layer?.type === 'text';

  return (
    <div style={{ fontFamily: 'Segoe UI, sans-serif', fontSize: 13, padding: 12, display: 'flex', flexDirection: 'column', gap: 9, height: '100vh', boxSizing: 'border-box', overflow: 'auto', background: '#f7f9fc' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <b style={{ fontSize: 16 }}>Design Assistant</b>
        <button onClick={() => api().assistantClose()}>Close</button>
      </div>

      <div style={{ background: '#eef3f8', borderRadius: 9, padding: 10, display: 'grid', gap: 7 }}>
        <div><b>Photoshop:</b> {statusMessage}</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {connection === 'not_running' && <button onClick={launch} disabled={busy}>Launch Photoshop</button>}
          {connection === 'no_document' && <button onClick={() => openPsd(true)} disabled={busy}>Open Recent PSD</button>}
          {connection === 'no_document' && <button onClick={() => openPsd(false)} disabled={busy}>Select PSD</button>}
          <button onClick={() => refreshState(true)} disabled={busy}>Refresh Photoshop</button>
        </div>
      </div>

      <div style={{ background: '#fff', borderRadius: 9, padding: 11, display: 'grid', gap: 5, border: '1px solid #dfe5ed' }}>
        <div><b>Document:</b> {document?.name ?? '—'}</div>
        <div style={{ wordBreak: 'break-all' }}><b>PSD path:</b> {document?.path || '—'}</div>
        <div><b>Canvas:</b> {document ? `${Math.round(document.width)} × ${Math.round(document.height)} px` : '—'}</div>
        <hr style={{ border: 0, borderTop: '1px solid #e4e8ee', width: '100%' }} />
        <div><b>Selected layer:</b> {layer?.name ?? '—'} {layer ? `(#${layer.id})` : ''}</div>
        <div><b>Layer type:</b> {layer?.type ?? '—'}</div>
        <div><b>Position:</b> {layer ? `X ${Math.round(layer.x)}, Y ${Math.round(layer.y)}` : '—'}</div>
        <div><b>Dimensions:</b> {layer ? `${Math.round(layer.width)} × ${Math.round(layer.height)} px` : '—'}</div>
        <div><b>Visible:</b> {layer ? (layer.visible ? 'Yes' : 'No') : '—'} &nbsp; <b>Locked:</b> {layer ? (layer.locked ? 'Yes' : 'No') : '—'}</div>
        {isText && <div style={{ whiteSpace: 'pre-wrap' }}><b>Text:</b> {layer.text}</div>}
      </div>

      <div>
        <b>Quick edits</b>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 5 }}>
          <button disabled={busy || !canTransform} onClick={() => runQuick({ operation: 'move', deltaX: -10, deltaY: 0 }, 'Move selected layer X: -10, Y: 0')}>Move left</button>
          <button disabled={busy || !canTransform} onClick={() => runQuick({ operation: 'move', deltaX: 10, deltaY: 0 }, 'Move selected layer X: 10, Y: 0')}>Move right</button>
          <button disabled={busy || !canTransform} onClick={() => runQuick({ operation: 'move', deltaX: 0, deltaY: -10 }, 'Move selected layer X: 0, Y: -10')}>Move up</button>
          <button disabled={busy || !canTransform} onClick={() => runQuick({ operation: 'move', deltaX: 0, deltaY: 10 }, 'Move selected layer X: 0, Y: 10')}>Move down</button>
          <button disabled={busy || !canTransform} onClick={() => runQuick({ operation: 'resize', scalePercent: 95 }, 'Scale selected layer to 95%')}>Smaller</button>
          <button disabled={busy || !canTransform} onClick={() => runQuick({ operation: 'resize', scalePercent: 105 }, 'Scale selected layer to 105%')}>Larger</button>
          <button disabled={busy || !canTransform} onClick={() => runQuick({ operation: 'centre', horizontal: true, vertical: false }, 'Centre selected layer horizontally')}>Centre horizontally</button>
          <button disabled={busy || !canTransform} onClick={() => runQuick({ operation: 'centre', horizontal: false, vertical: true }, 'Centre selected layer vertically')}>Centre vertically</button>
          <button disabled={busy || !canEdit || !layer.visible || layer.locked} onClick={() => runQuick({ operation: 'hide' }, 'Hide selected layer')}>Hide</button>
          <button disabled={busy || !canEdit || layer.visible || layer.locked} onClick={() => runQuick({ operation: 'show' }, 'Show selected layer')}>Show</button>
          <button disabled={busy || !canEdit || layer.locked} onClick={() => runQuick({ operation: 'lock' }, 'Lock selected layer')}>Lock</button>
          <button disabled={busy || !canEdit || !layer.locked} onClick={() => runQuick({ operation: 'unlock' }, 'Unlock selected layer')}>Unlock</button>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 5 }}>
        <b>Command</b>
        <textarea value={command} onChange={(event) => setCommand(event.target.value)} placeholder={isText ? 'Change the selected text to Admissions Open 2026–27' : 'Move the selected layer 30 pixels left'} rows={2} />
        <div><b>Parsed operation:</b> {parsedOperation}</div>
        <button onClick={send} disabled={busy || !canEdit || !command.trim()}>Apply command</button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        <button onClick={() => runBridge('Undo', () => api().assistantUndo())} disabled={busy || connection === 'not_running' || connection === 'no_document'}>Undo</button>
        <button onClick={() => runBridge('Redo', () => api().assistantRedo())} disabled={busy || connection === 'not_running' || connection === 'no_document'}>Redo</button>
        <button onClick={() => runBridge('Save version', () => api().assistantSaveVersion())} disabled={busy || !document}>Save version</button>
        <button onClick={() => runBridge('Export PNG', () => api().assistantExportPng())} disabled={busy || !document}>Export PNG</button>
      </div>

      <div style={{ flex: 1, minHeight: 130 }}>
        <b>Activity Log</b>
        <div style={{ marginTop: 5, background: '#0d1b2a', color: '#cfe', fontFamily: 'Consolas, monospace', fontSize: 11, borderRadius: 7, padding: 8, height: 150, overflow: 'auto' }}>
          {log.length === 0 && <div>Waiting for Photoshop status…</div>}
          {log.map((line, index) => <div key={`${line.time}-${index}`} style={{ color: line.kind === 'error' ? '#ff8b8b' : line.kind === 'warn' ? '#ffd580' : '#cfe', marginBottom: 3 }}>[{line.time}] {line.text}</div>)}
        </div>
      </div>
    </div>
  );
}
