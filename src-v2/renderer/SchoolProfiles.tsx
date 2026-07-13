import React, { useEffect, useState } from 'react';
import type { PosterApi } from '../main/preload';
import { BRAND_ASSET_KEYS, ASSET_LABELS, type BrandAssetKey, type BrandAsset, type SchoolProfile, type ManagementPersonDetails } from '../shared/brandKit';

declare global { interface Window { posterApi: PosterApi } }

const BASIC_FIELDS: [keyof SchoolProfile, string, string?][] = [
  ['name', 'School name'],
  ['shortName', 'Short school name'],
  ['groupName', 'School group name'],
  ['addressLine1', 'Address line 1'],
  ['addressLine2', 'Address line 2'],
  ['village', 'Village / Town'],
  ['mandal', 'Mandal'],
  ['district', 'District'],
  ['state', 'State'],
  ['pin', 'PIN code'],
  ['phone1', 'Phone 1'],
  ['phone2', 'Phone 2'],
  ['whatsapp', 'WhatsApp number'],
  ['email', 'Email'],
  ['website', 'Website'],
  ['academicYear', 'Academic year'],
  ['tagline', 'School tagline'],
  ['footerText', 'Footer text'],
  ['affiliation', 'Affiliation / curriculum'],
  ['admissionsText', 'Admissions text'],
];

const MGMT_ROLES: { key: keyof SchoolProfile['management']; label: string }[] = [
  { key: 'chairman', label: 'Chairman' },
  { key: 'correspondent', label: 'Correspondent' },
  { key: 'director', label: 'Director' },
  { key: 'principal', label: 'Principal' },
  { key: 'headmaster', label: 'Headmaster' },
];

const BRAND_COLOR_FIELDS: [string, string][] = [
  ['primary', 'Primary'], ['secondary', 'Secondary'], ['accent', 'Accent'], ['background', 'Background'],
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function AssetThumbnail({ asset }: { asset: BrandAsset }) {
  const [error, setError] = useState(false);
  if (error) return <div style={{ width: '100%', height: 80, background: '#102844', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5a7596', fontSize: 11 }}>No preview</div>;
  return (
    <img
      src={`file://${asset.path}`}
      alt={asset.originalName}
      style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 6, background: '#0a1d35' }}
      onError={() => setError(true)}
    />
  );
}

export function SchoolProfiles({ profiles, reload, selectedId, onSelect }: {
  profiles: SchoolProfile[]; reload: () => Promise<void>; selectedId: string; onSelect: (id: string) => void;
}) {
  const profile = profiles.find((p) => p.id === selectedId) ?? profiles[0];
  const [draft, setDraft] = useState<SchoolProfile | null>(profile ?? null);
  const [status, setStatus] = useState('');
  const [missing, setMissing] = useState<{ key: string }[]>([]);
  const [defaultId, setDefaultId] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [previewAsset, setPreviewAsset] = useState<BrandAsset | null>(null);
  const [showCrop, setShowCrop] = useState<BrandAssetKey | null>(null);

  useEffect(() => {
    setDraft(profile ?? null);
    if (profile) {
      window.posterApi.assetCheckMissing(profile.id).then(setMissing);
      window.posterApi.profileGetDefault().then((d) => setDefaultId(d?.id ?? ''));
    }
  }, [profile?.id, profile?.updatedAt]);

  if (!draft) return <div className="empty"><h2>No school profiles</h2><button onClick={async () => { const p: any = await window.posterApi.profileCreate({ name: 'New School' }); await reload(); onSelect(p.id); }}>Create one</button></div>;

  const save = async () => {
    setStatus('Saving…');
    const { assets, id, createdAt, updatedAt, ...patch } = draft;
    await window.posterApi.profileUpdate(draft.id, patch as Record<string, unknown>);
    await reload();
    setStatus('School profile saved successfully.');
    setTimeout(() => setStatus(''), 4000);
  };

  const setField = (k: keyof SchoolProfile, v: string) => setDraft({ ...draft, [k]: v } as SchoolProfile);
  const setNumberField = (k: keyof SchoolProfile, v: string) => setDraft({ ...draft, [k]: v === '' ? 0 : Number(v) } as SchoolProfile);
  const setColor = (k: string, v: string) => setDraft({ ...draft, branding: { ...draft.branding, [k]: v.replace('#', '') } });
  const setMgmtField = (role: keyof SchoolProfile['management'], field: keyof ManagementPersonDetails, value: string) => {
    setDraft({ ...draft, management: { ...draft.management, [role]: { ...draft.management[role], [field]: value } } });
  };

  const uploadAsset = async (key: BrandAssetKey) => {
    setStatus(`Importing ${ASSET_LABELS[key]}…`);
    const r: any = await window.posterApi.assetImport(draft.id, key);
    if (r?.canceled) { setStatus(''); return; }
    if (r?.error) { setStatus(r.error); return; }
    await reload();
    setStatus(`${ASSET_LABELS[key]} imported.`);
    setTimeout(() => setStatus(''), 3000);
  };

  const removeAsset = async (key: BrandAssetKey) => {
    if (!confirm(`Remove ${ASSET_LABELS[key]}?`)) return;
    await window.posterApi.assetRemove(draft.id, key);
    await reload();
    setStatus(`${ASSET_LABELS[key]} removed.`);
    setTimeout(() => setStatus(''), 3000);
  };

  const handleDelete = async () => {
    if (!confirm(`Delete school profile "${draft.name}" permanently?\n\nThis action cannot be undone. All saved assets will be deleted.`)) return;
    setStatus('Deleting…');
    await window.posterApi.profileDelete(draft.id);
    await reload();
    setDeleteConfirm('');
    setStatus('Profile deleted.');
    setTimeout(() => setStatus(''), 3000);
  };

  const handleDuplicate = async () => {
    setStatus('Duplicating…');
    const p: any = await window.posterApi.profileDuplicate(draft.id);
    await reload();
    onSelect(p.id);
    setStatus('Profile duplicated.');
    setTimeout(() => setStatus(''), 3000);
  };

  const handleSetDefault = async () => {
    await window.posterApi.profileSetDefault(draft.id);
    setDefaultId(draft.id);
    setStatus('Set as default school.');
    setTimeout(() => setStatus(''), 3000);
  };

  return (
    <div className="card" style={{ maxWidth: 960 }}>
      {/* Toolbar */}
      <div className="actions" style={{ marginBottom: 12 }}>
        <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>Profile</span>
          <select value={draft.id} onChange={(e) => { onSelect(e.target.value); setPreviewAsset(null); }}>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}{p.id === defaultId ? ' ★ (default)' : ''}
              </option>
            ))}
          </select>
        </label>
        <button onClick={async () => { const p: any = await window.posterApi.profileCreate({ name: 'New School' }); await reload(); onSelect(p.id); }}>+ New</button>
        <button onClick={handleDuplicate}>Duplicate</button>
        {draft.id !== defaultId && <button onClick={handleSetDefault}>Set as default</button>}
        {profiles.length > 1 && <button onClick={() => setDeleteConfirm(draft.id)} style={{ borderColor: '#a03' }}>Delete</button>}
      </div>

      {draft.id === defaultId && <div className="file" style={{ borderColor: '#e9a83b', marginBottom: 12, padding: '8px 14px' }}><b>★ Default school profile</b> <span style={{ fontSize: 12, opacity: 0.8 }}>This profile is selected automatically for new posters.</span></div>}

      {/* Basic details */}
      <h3>School Information</h3>
      <div className="form">
        {BASIC_FIELDS.map(([k, label]) => (
          <label key={k}>{label}<input value={String((draft as any)[k] ?? '')} onChange={(e) => setField(k, e.target.value)} /></label>
        ))}
      </div>

      {/* Management details */}
      <h3 style={{ marginTop: 20 }}>Management Details</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {MGMT_ROLES.map(({ key, label }) => {
          const mgmt = draft.management[key];
          const photoKey = `${key}Photo` as BrandAssetKey;
          const hasPhoto = !!draft.assets[photoKey];
          return (
            <div key={key} className="file" style={{ margin: 0 }}>
              <b>{label}</b>
              <div className="form" style={{ marginTop: 8 }}>
                <label>Name<input value={mgmt.name} onChange={(e) => setMgmtField(key, 'name', e.target.value)} placeholder={`${label} name`} /></label>
                <label>Designation<input value={mgmt.designation} onChange={(e) => setMgmtField(key, 'designation', e.target.value)} placeholder={`${label} designation`} /></label>
                <div className="actions" style={{ marginTop: 4 }}>
                  {hasPhoto ? <span style={{ fontSize: 11, opacity: 0.7 }}>Photo saved ✓</span> : <span style={{ fontSize: 11, opacity: 0.5 }}>No photo — add in assets below</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Brand colours & fonts */}
      <h3 style={{ marginTop: 20 }}>Brand Colours & Fonts</h3>
      <div className="form">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {BRAND_COLOR_FIELDS.map(([k, label]) => (
            <label key={k}>{label}<input type="color" value={`#${(draft.branding as any)[k]}`} onChange={(e) => setColor(k, e.target.value)} /></label>
          ))}
        </div>
        <label>Heading font<input value={draft.branding.headingFont} onChange={(e) => setDraft({ ...draft, branding: { ...draft.branding, headingFont: e.target.value } })} /></label>
        <label>Body font<input value={draft.branding.bodyFont} onChange={(e) => setDraft({ ...draft, branding: { ...draft.branding, bodyFont: e.target.value } })} /></label>
        <label>Logo placement<select value={draft.branding.logoPlacement} onChange={(e) => setDraft({ ...draft, branding: { ...draft.branding, logoPlacement: e.target.value as any } })}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>
        <label>Footer style<select value={draft.branding.footerStyle} onChange={(e) => setDraft({ ...draft, branding: { ...draft.branding, footerStyle: e.target.value as any } })}><option value="gradient-bar">Gradient bar</option><option value="solid-bar">Solid bar</option><option value="minimal-line">Minimal line</option></select></label>
        <label>LEAD logo placement<select value={draft.branding.leadPlacement} onChange={(e) => setDraft({ ...draft, branding: { ...draft.branding, leadPlacement: e.target.value as any } })}><option value="top-right">Top-right</option><option value="footer-right">Footer-right</option><option value="beside-powered-by">Beside "Powered by LEAD"</option></select></label>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', alignSelf: 'end' }}><input type="checkbox" checked={draft.branding.showLead} onChange={(e) => setDraft({ ...draft, branding: { ...draft.branding, showLead: e.target.checked } })} /> Show "Powered by LEAD Curriculum" by default</label>
      </div>

      {/* Fixed poster defaults */}
      <h3 style={{ marginTop: 20 }}>Default Poster Settings</h3>
      <div className="form">
        <label>Default poster width (px)<input type="number" min={600} max={4000} value={draft.defaultWidth} onChange={(e) => setNumberField('defaultWidth', e.target.value)} /></label>
        <label>Default poster height (px)<input type="number" min={600} max={4000} value={draft.defaultHeight} onChange={(e) => setNumberField('defaultHeight', e.target.value)} /></label>
        <label>Default contact number shown on posters<input value={draft.branding ? draft.phone1 : ''} placeholder={draft.phone1} onChange={(e) => setField('phone1', e.target.value)} /></label>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', alignSelf: 'end', opacity: 0.6 }}><span>Default output folder:</span><span style={{ fontSize: 12 }}>Set in Daily Prayer (per-poster)</span></label>
      </div>

      {/* Save button */}
      <div className="actions" style={{ marginTop: 16 }}>
        <button className="primary" onClick={save} style={{ fontWeight: 700 }}>Save school profile</button>
        <span style={{ color: status.includes('successfully') ? '#4caf50' : status ? '#ffbd3e' : '#8ca8c9', fontSize: 13 }}>{status}</span>
      </div>

      {/* Brand assets */}
      <h3 style={{ marginTop: 24 }}>Brand Assets</h3>
      {missing.length > 0 && <div className="file" style={{ borderColor: '#c0392b', marginBottom: 12 }}><b>⚠ {missing.length} asset file(s) moved or deleted</b>{missing.map((m) => <span key={m.key}>{ASSET_LABELS[m.key as BrandAssetKey]}</span>)}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
        {BRAND_ASSET_KEYS.map((key) => {
          const asset = draft.assets[key];
          return (
            <div key={key} className="file" style={{ margin: 0, padding: 12 }}>
              <b style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>{ASSET_LABELS[key]}</b>
              {asset ? (
                <>
                  <div style={{ cursor: 'pointer' }} onClick={() => setPreviewAsset(asset)}>
                    <AssetThumbnail asset={asset} />
                  </div>
                  <div style={{ fontSize: 10, color: '#8ca8c9', marginTop: 6, lineHeight: 1.5 }}>
                    {asset.originalName}<br />
                    {asset.width && asset.height ? `${asset.width}×${asset.height} · ` : ''}{formatFileSize(asset.bytes)} · {asset.format.toUpperCase()}
                    {asset.hasAlpha ? ' · alpha' : ''}
                  </div>
                  <div className="actions" style={{ marginTop: 6, gap: 4 }}>
                    <button onClick={() => uploadAsset(key)} style={{ fontSize: 11, padding: '4px 8px' }}>Replace</button>
                    <button onClick={() => setShowCrop(key)} style={{ fontSize: 11, padding: '4px 8px' }} disabled title="Coming soon">Crop</button>
                    <button onClick={() => removeAsset(key)} style={{ fontSize: 11, padding: '4px 8px', borderColor: '#a03' }}>Remove</button>
                  </div>
                </>
              ) : (
                <div style={{ height: 80, background: '#0d213b', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed #294a70' }}>
                  <button onClick={() => uploadAsset(key)} style={{ fontSize: 11, padding: '4px 12px' }}>Upload</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Asset preview modal */}
      {previewAsset && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setPreviewAsset(null)}>
          <div style={{ background: '#0d213b', borderRadius: 16, padding: 24, maxWidth: '90vw', maxHeight: '90vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div className="actions" style={{ marginBottom: 12 }}>
              <b>{previewAsset.originalName}</b>
              <button onClick={() => setPreviewAsset(null)}>✕ Close</button>
            </div>
            <img src={`file://${previewAsset.path}`} alt={previewAsset.originalName} style={{ maxWidth: '70vw', maxHeight: '70vh', borderRadius: 8 }} />
            <div style={{ fontSize: 12, color: '#8ca8c9', marginTop: 8 }}>
              {previewAsset.width}×{previewAsset.height} · {formatFileSize(previewAsset.bytes)} · {previewAsset.format.toUpperCase()}
            </div>
          </div>
        </div>
      )}

      {/* Crop placeholder */}
      {showCrop && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowCrop(null)}>
          <div className="card" onClick={(e) => e.stopPropagation()}>
            <h3>Crop: {ASSET_LABELS[showCrop]}</h3>
            <p>Crop controls coming in the next update. Use an external image editor for now.</p>
            <button onClick={() => setShowCrop(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
