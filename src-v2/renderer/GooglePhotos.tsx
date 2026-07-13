import React, { useEffect, useState } from 'react';

// Google Photos connector UI. Exposes the five required actions (§ buttons):
// Connect Google Photos · Choose School Assets · Add Today's Photos ·
// Replace Photo from Google Photos · Manage Approved Assets. All heavy lifting
// (OAuth, Picker, download, validation, filing) happens in the main process;
// this component only renders thumbnails and collects role assignments (§8, §9).

interface Staged { path: string; filename: string; originalName: string; width: number; height: number; thumbnailDataUrl?: string; role: string }
interface RoleInfo { role: string; label: string; permanent: boolean; assetKey: string | null }
interface DailyPhoto { path: string; role: string; name?: string; className?: string; thumbnailDataUrl?: string }

export function GooglePhotosPanel({ profileId, onDailyPhotos, reloadProfiles }: {
  profileId: string;
  onDailyPhotos: (photos: { path: string; name?: string; className?: string }[]) => void;
  reloadProfiles: () => void;
}) {
  const api = (window as any).posterApi;
  const [status, setStatus] = useState<{ configured: boolean; connected: boolean } | null>(null);
  const [roles, setRoles] = useState<RoleInfo[]>([]);
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState('');
  const [staged, setStaged] = useState<Staged[]>([]);
  const [approved, setApproved] = useState<{ key: string; label: string; path: string; width: number; height: number }[] | null>(null);
  const [replaceKey, setReplaceKey] = useState('mainLogo');

  const refresh = async () => { setStatus(await api.gpStatus()); setRoles(await api.gpRoleCatalog()); };
  useEffect(() => { refresh(); }, []);

  const guard = async (label: string, fn: () => Promise<void>) => {
    setBusy(label); setNote('');
    try { await fn(); } catch (e) { setNote(String((e as Error).message ?? e)); } finally { setBusy(''); }
  };

  const connect = () => guard('Connecting…', async () => { await api.gpConnect(); await refresh(); setNote('Google Photos connected.'); });
  const disconnect = () => guard('Disconnecting…', async () => { await api.gpDisconnect(); await refresh(); setNote('Disconnected.'); });

  const choose = () => guard('Opening Google Photos…', async () => {
    const r = await api.gpPick();
    if (r.canceled) { setNote(r.reason ?? 'No photos selected.'); return; }
    setStaged(r.items.map((it: any) => ({ ...it, role: 'student' })));
    setNote(`${r.items.length} photo(s) downloaded. Assign a role to each, then Save.`);
  });

  const saveAssignments = () => guard('Saving…', async () => {
    if (!profileId) { setNote('Select a school profile first.'); return; }
    const jobId = new Date().toISOString().slice(0, 10);
    const assignments = staged.map((s) => ({ path: s.path, role: s.role }));
    const res = await api.gpCommit(profileId, `daily-${jobId}`, assignments);
    const daily = (res.dailyPhotos ?? []).map((d: any) => ({ path: d.path, name: d.name, className: d.className }));
    if (daily.length) onDailyPhotos(daily);
    await reloadProfiles();
    const errs = (res.errors ?? []).length;
    setStaged([]);
    setNote(`Saved: ${res.approved?.length ?? 0} to the Approved Library, ${daily.length} to today's job folder${errs ? `, ${errs} failed` : ''}.`);
  });

  const addToday = () => guard('Opening Google Photos…', async () => {
    const r = await api.gpAddToday('activity-photo');
    if (r.canceled) { setNote(r.reason ?? 'No photos selected.'); return; }
    onDailyPhotos((r.photos ?? []).map((p: any) => ({ path: p.path })));
    setNote(`${r.photos?.length ?? 0} photo(s) added to today's job folder.`);
  });

  const replace = () => guard('Opening Google Photos…', async () => {
    if (!profileId) { setNote('Select a school profile first.'); return; }
    const r = await api.gpReplace(profileId, replaceKey);
    if (r.canceled) { setNote(r.reason ?? 'No photo selected.'); return; }
    await reloadProfiles();
    if (approved) setApproved((await api.gpListApproved(profileId)).assets);
    setNote(`Replaced "${replaceKey}" from Google Photos.`);
  });

  const manage = () => guard('Loading…', async () => {
    if (!profileId) { setNote('Select a school profile first.'); return; }
    setApproved((await api.gpListApproved(profileId)).assets);
  });

  const permanentKeys = roles.filter((r) => r.permanent && r.assetKey).map((r) => r.assetKey as string);

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <span className="eyebrow">GOOGLE PHOTOS</span>
      <h3>Photos from Google Photos</h3>
      {status && !status.configured && (
        <div className="file" style={{ borderColor: '#c0392b' }}>
          <b>⚠ Not configured.</b>
          <span>Add your Google OAuth "Desktop app" credentials (see docs/GOOGLE_PHOTOS_CONNECTOR.md) before connecting.</span>
        </div>
      )}
      <div className="actions" style={{ flexWrap: 'wrap', gap: 8 }}>
        {status?.connected
          ? <button onClick={disconnect} disabled={!!busy}>Disconnect Google Photos</button>
          : <button className="primary" onClick={connect} disabled={!!busy || (status ? !status.configured : false)}>Connect Google Photos</button>}
        <button onClick={choose} disabled={!!busy || !status?.connected}>Choose School Assets</button>
        <button onClick={addToday} disabled={!!busy || !status?.connected}>Add Today's Photos</button>
        <button onClick={manage} disabled={!!busy || !status?.connected}>Manage Approved Assets</button>
      </div>

      <div className="actions" style={{ marginTop: 8, gap: 8, alignItems: 'center' }}>
        <label style={{ fontSize: 12 }}>Replace slot
          <select value={replaceKey} onChange={(e) => setReplaceKey(e.target.value)} style={{ marginLeft: 6 }}>
            {permanentKeys.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </label>
        <button onClick={replace} disabled={!!busy || !status?.connected}>Replace Photo from Google Photos</button>
      </div>

      {busy && <p style={{ opacity: 0.7 }}>⏳ {busy} A browser window has opened — pick your photos there, then return here.</p>}
      {note && <p>{note}</p>}

      {staged.length > 0 && (
        <div className="file">
          <b>Assign roles ({staged.length})</b>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 10, marginTop: 8 }}>
            {staged.map((s, i) => (
              <div key={s.path} style={{ border: '1px solid #dce3ec', borderRadius: 8, padding: 6 }}>
                {s.thumbnailDataUrl
                  ? <img src={s.thumbnailDataUrl} alt={s.originalName} style={{ width: '100%', height: 96, objectFit: 'cover', borderRadius: 4 }} />
                  : <div style={{ height: 96, display: 'grid', placeItems: 'center', background: '#eef2f8', borderRadius: 4, fontSize: 11 }}>{s.width}×{s.height}</div>}
                <div style={{ fontSize: 10, opacity: 0.6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.originalName}</div>
                <select value={s.role} onChange={(e) => setStaged(staged.map((x, j) => j === i ? { ...x, role: e.target.value } : x))} style={{ width: '100%', marginTop: 4 }}>
                  {roles.map((r) => <option key={r.role} value={r.role}>{r.label}{r.permanent ? ' · library' : ' · today'}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div className="actions" style={{ marginTop: 8 }}>
            <button className="primary" onClick={saveAssignments} disabled={!!busy}>Save assignments</button>
            <button onClick={() => setStaged([])} disabled={!!busy}>Discard</button>
          </div>
        </div>
      )}

      {approved && (
        <div className="file">
          <b>Approved Asset Library ({approved.length})</b>
          {approved.length === 0 && <span>No permanent assets yet. Use “Choose School Assets”.</span>}
          {approved.map((a) => (
            <div key={a.key} style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
              <span>{a.label} <code style={{ opacity: 0.6 }}>{a.key}</code> · {a.width}×{a.height}</span>
              <button onClick={() => api.openPath(a.path)}>Open</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
