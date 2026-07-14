import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { PosterApi } from '../main/preload';
import { composeDailyPrayerEditorial } from '../main/design/dailyPrayerFamilies';
import { hashDesignPlan } from '../shared/designPlanHash';
import type { ComposeInput, Plan } from '../main/design/types';
import { ASSET_LABELS, formatAddress, type BrandAsset, type BrandAssetKey, type SchoolProfile } from '../shared/brandKit';
import { PlanSvg } from './planToSvg';
import { SchoolProfiles } from './SchoolProfiles';

declare global { interface Window { posterApi: PosterApi } }

type Page = 'Dashboard' | 'Daily Prayer' | 'Brand Assets' | 'Edit Existing PSD' | 'Settings';
type WorkflowStep = 1 | 2 | 3;
type PreviewZoom = 'fit' | 50 | 75 | 100;

const PAGES: Page[] = ['Dashboard', 'Daily Prayer', 'Brand Assets', 'Edit Existing PSD', 'Settings'];
const STAGES = ['Analysing content', 'Selecting composition', 'Preparing photos', 'Building Photoshop layers', 'Fitting typography', 'Running quality checks', 'Exporting files'];
const DEFAULT_PROGRAMME = [
  'Prayer Song', 'Pledge', 'Thought for the Day', 'News Headlines', 'Word of the Day',
  'Quiz Question', 'Birthday Wishes', 'Principal’s Message', 'National Anthem',
];

interface PhotoPick {
  path: string; name?: string; className?: string;
  width?: number; height?: number; bytes?: number;
  zoom?: number; offsetX?: number; offsetY?: number;
}

function fileUrl(path: string): string { return encodeURI(`file:///${path.replace(/\\/g, '/')}`); }
function fileName(path: string): string { return path.split(/[\\/]/).pop() || path; }
function humanBytes(bytes = 0): string { return bytes ? `${(bytes / 1024 / 1024).toFixed(bytes > 1024 * 1024 ? 1 : 2)} MB` : 'Size unavailable'; }
function formatDiskSize(bytes: number): string {
  if (bytes === 0) return '0 GB';
  const tb = bytes / 1e12;
  if (tb > 1) return `${tb.toFixed(1)} TB`;
  const gb = bytes / 1e9;
  if (gb > 1) return `${gb.toFixed(0)} GB`;
  const mb = bytes / 1e6;
  return `${mb.toFixed(0)} MB`;
}
function dayForDate(value: string): string {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.valueOf()) ? '' : date.toLocaleDateString('en-GB', { weekday: 'long' });
}
function displayDate(value: string): string {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function useProgress() {
  const [stage, setStage] = useState<{ label: string; index: number; variation?: number } | null>(null);
  useEffect(() => window.posterApi.onPosterProgress((event) => setStage({ label: event.label, index: event.stage, variation: event.variation })), []);
  return { stage, reset: () => setStage(null) };
}

function ProgressBar({ stage }: { stage: { label: string; index: number; variation?: number } | null }) {
  if (!stage) return null;
  const percent = ((stage.index + 1) / STAGES.length) * 100;
  return (
    <div className="progress-card" role="status">
      <div><b>{stage.label}</b><span>Step {stage.index + 1} of {STAGES.length}</span></div>
      <div className="progress-track"><div className="progress-value" style={{ width: `${percent}%` }} /></div>
    </div>
  );
}

async function pickImages(): Promise<PhotoPick[]> {
  const result: any = await window.posterApi.pickImages('photos');
  if (result.canceled) return [];
  return (result.images?.length ? result.images : result.paths.map((path: string) => ({ path })))
    .map((image: PhotoPick) => ({ ...image, zoom: 1, offsetX: 0, offsetY: 0 }));
}

function PhotoAssets({ title, emptyText, photos, setPhotos, max = 16, withNames = true }: {
  title: string; emptyText: string; photos: PhotoPick[]; setPhotos: (photos: PhotoPick[]) => void; max?: number; withNames?: boolean;
}) {
  const [cropIndex, setCropIndex] = useState<number | null>(null);
  const add = async () => setPhotos([...photos, ...(await pickImages())].slice(0, max));
  const replace = async (index: number) => {
    const picked = await pickImages();
    if (picked[0]) setPhotos(photos.map((photo, i) => i === index ? picked[0] : photo));
  };
  const patch = (index: number, values: Partial<PhotoPick>) => setPhotos(photos.map((photo, i) => i === index ? { ...photo, ...values } : photo));
  return (
    <div className="asset-section">
      <div className="section-heading"><div><h3>{title}</h3><p>{photos.length ? `${photos.length} selected` : emptyText}</p></div><button onClick={add}>{photos.length ? 'Add' : 'Upload'}</button></div>
      {photos.length > 0 && <div className="asset-grid local-assets">
        {photos.map((photo, index) => (
          <article className="asset-card" key={`${photo.path}-${index}`}>
            <img src={fileUrl(photo.path)} alt="" />
            <div className="asset-copy"><b>{photo.name || `${title.replace(/s$/, '')} ${index + 1}`}</b><span>{fileName(photo.path)}</span><span>{photo.width && photo.height ? `${photo.width} × ${photo.height}px` : 'Dimensions unavailable'} · {humanBytes(photo.bytes)}</span></div>
            {withNames && <div className="asset-fields"><input aria-label="Name" placeholder="Name" value={photo.name ?? ''} onChange={(e) => patch(index, { name: e.target.value })} /><input aria-label="Class" placeholder="Class" value={photo.className ?? ''} onChange={(e) => patch(index, { className: e.target.value })} /></div>}
            <div className="asset-actions"><button onClick={() => replace(index)}>Replace</button><button onClick={() => setCropIndex(cropIndex === index ? null : index)}>Crop</button><button className="danger-text" onClick={() => setPhotos(photos.filter((_, i) => i !== index))}>Remove</button></div>
            {cropIndex === index && <div className="crop-controls">
              <label>Zoom <input type="range" min="1" max="2.5" step="0.05" value={photo.zoom ?? 1} onChange={(e) => patch(index, { zoom: Number(e.target.value) })} /></label>
              <label>Horizontal <input type="range" min="-1" max="1" step="0.05" value={photo.offsetX ?? 0} onChange={(e) => patch(index, { offsetX: Number(e.target.value) })} /></label>
              <label>Vertical <input type="range" min="-1" max="1" step="0.05" value={photo.offsetY ?? 0} onChange={(e) => patch(index, { offsetY: Number(e.target.value) })} /></label>
            </div>}
          </article>
        ))}
      </div>}
    </div>
  );
}

function ProfileAsset({ profileId, assetKey, asset, emptyText, reload }: {
  profileId: string; assetKey: BrandAssetKey; asset?: BrandAsset; emptyText: string; reload: () => Promise<void>;
}) {
  const [cropping, setCropping] = useState(false);
  const [crop, setCrop] = useState(asset?.crop ?? { zoom: 1, offsetX: 0, offsetY: 0 });
  useEffect(() => setCrop(asset?.crop ?? { zoom: 1, offsetX: 0, offsetY: 0 }), [asset?.path, asset?.crop?.zoom, asset?.crop?.offsetX, asset?.crop?.offsetY]);
  const upload = async () => { const result: any = await window.posterApi.assetImport(profileId, assetKey); if (!result?.canceled) await reload(); };
  const remove = async () => { await window.posterApi.assetRemove(profileId, assetKey); await reload(); };
  const saveCrop = async () => { await window.posterApi.assetSetCrop(profileId, assetKey, crop); await reload(); setCropping(false); };
  return (
    <article className="asset-card profile-asset">
      <div className="asset-thumb">{asset ? <img src={fileUrl(asset.path)} alt="" /> : <span>No image</span>}</div>
      <div className="asset-copy"><b>{ASSET_LABELS[assetKey]}</b>{asset ? <><span>{asset.originalName}</span><span>{asset.width && asset.height ? `${asset.width} × ${asset.height}px` : 'Dimensions unavailable'} · {humanBytes(asset.bytes)}</span><span>Updated {new Date(asset.importedAt).toLocaleString()}</span></> : <span>{emptyText}</span>}</div>
      <div className="asset-actions"><button onClick={upload}>{asset ? 'Replace' : 'Upload'}</button>{asset && <><button onClick={() => setCropping(!cropping)}>Crop</button><button className="danger-text" onClick={remove}>Remove</button></>}</div>
      {asset && cropping && <div className="crop-controls">
        <label>Zoom <input type="range" min="1" max="4" step="0.05" value={crop.zoom} onChange={(e) => setCrop({ ...crop, zoom: Number(e.target.value) })} /></label>
        <label>Horizontal <input type="range" min="-1" max="1" step="0.05" value={crop.offsetX} onChange={(e) => setCrop({ ...crop, offsetX: Number(e.target.value) })} /></label>
        <label>Vertical <input type="range" min="-1" max="1" step="0.05" value={crop.offsetY} onChange={(e) => setCrop({ ...crop, offsetY: Number(e.target.value) })} /></label>
        <button className="primary small" onClick={saveCrop}>Save crop</button>
      </div>}
    </article>
  );
}

function ProgrammeRows({ items, setItems }: { items: string[]; setItems: (items: string[]) => void }) {
  const [dragging, setDragging] = useState<number | null>(null);
  const move = (from: number, to: number) => {
    if (from === to) return;
    const next = [...items]; const [item] = next.splice(from, 1); next.splice(to, 0, item); setItems(next);
  };
  return (
    <div className="programme-editor">
      {items.map((item, index) => <div className="programme-row" key={index} draggable onDragStart={() => setDragging(index)} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (dragging !== null) move(dragging, index); setDragging(null); }}>
        <button className="drag-handle" aria-label={`Reorder item ${index + 1}`} title="Drag to reorder">⋮⋮</button><span>{index + 1}</span>
        <input value={item} onChange={(e) => setItems(items.map((value, i) => i === index ? e.target.value : value))} />
        <button className="icon danger-text" aria-label={`Delete item ${index + 1}`} onClick={() => setItems(items.filter((_, i) => i !== index))}>×</button>
      </div>)}
      <button className="add-row" onClick={() => setItems([...items, `Programme item ${items.length + 1}`])}>+ Add programme item</button>
    </div>
  );
}

function RecentEdits({ selectedSchoolId, onEdit }: { selectedSchoolId: string; onEdit: (job: any) => void }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const load = async () => {
    setLoading(true);
    try {
      const list = await window.posterApi.listRecentEdits(selectedSchoolId || undefined, 12);
      setItems(list || []);
    } catch { setItems([]); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [selectedSchoolId]);

  const filtered = items.filter((item: any) => {
    if (search) {
      const q = search.toLowerCase();
      if (!item.title?.toLowerCase().includes(q) && !item.schoolName?.toLowerCase().includes(q) && !item.category?.toLowerCase().includes(q)) return false;
    }
    if (filterCategory && item.category !== filterCategory) return false;
    if (filterStatus && item.status !== filterStatus) return false;
    return true;
  }).slice(0, 6);

  const statusStyle = (s: string) => {
    const map: Record<string, string> = {
      'draft': 'status-draft', 'generating': 'status-generating', 'photoshop-open': 'status-photoshop',
      'psd-generated': 'status-psd', 'exported': 'status-exported', 'approved': 'status-approved',
      'failed': 'status-failed', 'missing-file': 'status-missing',
    };
    return map[s] || 'status-draft';
  };
  const statusLabel = (s: string) => {
    const map: Record<string, string> = {
      'draft': 'Draft', 'generating': 'Generating', 'photoshop-open': 'Photoshop Open',
      'psd-generated': 'PSD Generated', 'exported': 'Exported', 'approved': 'Approved',
      'failed': 'Failed', 'missing-file': 'Missing File',
    };
    return map[s] || s;
  };

  return <section className="recent-edits">
    <div className="section-heading">
      <div>
        <h2>Recent Edits</h2>
        <p>Continue working on your latest posters and projects.</p>
      </div>
      <div className="recent-edits-filters">
        <input placeholder="Search posters…" value={search} onChange={(e) => setSearch(e.target.value)} className="search-input" />
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
          <option value="">All categories</option>
          <option value="daily-prayer">Daily Prayer</option>
          <option value="event">Event</option>
          <option value="exam">Exam</option>
          <option value="festival">Festival</option>
          <option value="general">General</option>
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">All status</option>
          <option value="draft">Draft</option>
          <option value="psd-generated">PSD Generated</option>
          <option value="exported">Exported</option>
          <option value="approved">Approved</option>
        </select>
      </div>
    </div>
    {loading ? <div className="recent-edits-loading">Loading recent projects…</div> : filtered.length === 0 ? (
      <div className="recent-edits-empty">
        <h3>No recent edits yet</h3>
        <p>Create your first poster to see it here.</p>
        <button className="primary" onClick={() => { window.location.hash = '#create'; }}>Create Daily Prayer Poster</button>
      </div>
    ) : (
      <div className="recent-edits-grid">
        {filtered.map((item: any) => {
          const thumbnail = item.thumbnailPath || item.previewPath || item.pngPath || item.jpgPath;
          const missing = item.status === 'missing-file' || (item.psdPath && false);
          return <article className="recent-edit-card" key={item.jobId}>
            <div className="recent-edit-thumb">
              {thumbnail ? <img src={encodeURI(`file:///${thumbnail.replace(/\\/g, '/')}`)} alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} /> : <div className="recent-edit-thumb-placeholder">No preview</div>}
            </div>
            <div className="recent-edit-body">
              <h4>{item.title || 'Untitled Poster'}</h4>
              <span className="recent-edit-school">{item.schoolName || 'Unknown School'}</span>
              <div className="recent-edit-meta">
                <span>{item.updatedAt ? new Date(item.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}</span>
                <span className={`recent-edit-status ${statusStyle(item.status)}`}>{statusLabel(item.status)}</span>
              </div>
              <div className="recent-edit-outputs">
                {item.psdPath && <span className="output-badge">PSD</span>}
                {item.pngPath && <span className="output-badge">PNG</span>}
                {item.jpgPath && <span className="output-badge">JPG</span>}
              </div>
              <div className="recent-edit-actions">
                <button className="small primary" disabled={missing} onClick={() => onEdit(item)}>Continue Editing</button>
                {item.psdPath && <button className="small" disabled={missing} onClick={() => window.posterApi.openFileLocation(item.psdPath)}>Open Folder</button>}
                {missing && <button className="small" onClick={async () => {
                  const result: any = await window.posterApi.pickImages('photos');
                  if (!result.canceled && result.paths?.[0]) {
                    await window.posterApi.openFileLocation(result.paths[0]);
                  }
                }}>Locate File</button>}
              </div>
            </div>
          </article>;
        })}
      </div>
    )}
    {items.length > 6 && <div className="recent-edits-footer"><button onClick={() => {}}>View all projects →</button></div>}
  </section>;
}

function BrainFeedback({ result }: { result: any }) {
  const [fbState, setFbState] = useState<'idle' | 'approved' | 'rejected' | 'loading'>('idle');
  const [reasons, setReasons] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [brainStats, setBrainStats] = useState<Record<string, number> | null>(null);

  useEffect(() => { window.posterApi.brainStats().then(setBrainStats).catch(() => {}); }, []);

  const posterId = result?.renderLog?.JOB_ID ? `brain_${result.renderLog.JOB_ID}_v0` : null;
  if (!posterId) return null;

  const allReasons = ['wrong-hero-photo','bad-crop','missing-branding','too-empty','too-crowded','looks-mechanical','typography-problem','looks-like-table','ignores-photos','face-badly-cropped','empty-cards','repeated-rectangles','less-expressive-than-reference','dashboard-resemblance'];

  return <details className="brain-feedback" open={fbState === 'idle'}>
    <summary style={{ cursor: 'pointer', userSelect: 'none' }}>
      <span style={{ fontSize: 13, fontWeight: 600 }}>🧠 Poster Brain — Feedback</span>
      {brainStats && <span style={{ fontSize: 11, opacity: 0.6, marginLeft: 8 }}>{brainStats['human-approved'] + brainStats['generated-approved']} approved · {brainStats['generated-rejected']} rejected · {brainStats.totalPreferencePairs} comparisons</span>}
    </summary>
    {fbState === 'approved' && <div className="status success">✓ Approved — added to positive training data</div>}
    {fbState === 'rejected' && <div className="status" style={{ background: '#ffe0e0' }}>✗ Rejected — saved as negative example</div>}
    {fbState === 'idle' && <div className="brain-feedback-controls">
      <div className="brain-feedback-approve">
        <button className="primary" style={{ background: '#2a8' }} onClick={async () => { setFbState('loading'); await window.posterApi.brainApprove(posterId).catch(() => {}); setFbState('approved'); }}>✓ Approve</button>
      </div>
      <div className="brain-feedback-reject">
        <div className="brain-feedback-reasons">{allReasons.map(r => <label key={r} style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 3, marginRight: 6 }}><input type="checkbox" checked={reasons.includes(r)} onChange={(e) => setReasons(e.target.checked ? [...reasons, r] : reasons.filter(x => x !== r))} />{r.replace(/-/g, ' ')}</label>)}</div>
        <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
          <input placeholder="Optional rejection note…" value={note} onChange={(e) => setNote(e.target.value)} style={{ flex: 1, fontSize: 12, padding: '3px 6px' }} />
          <button style={{ background: '#c33', color: '#fff', fontSize: 12, padding: '3px 10px' }} disabled={reasons.length === 0} onClick={async () => { setFbState('loading'); await window.posterApi.brainReject(posterId, reasons, note).catch(() => {}); setFbState('rejected'); }}>✗ Reject</button>
        </div>
      </div>
    </div>}
  </details>;
}

function Results({ result, outputFolder, regenerate }: { result: any; outputFolder: string; regenerate: () => void }) {
  if (!result?.variations?.length) return null;
  const output = result.variations[0];
  const improve = async () => { await window.posterApi.openPath(output.psdPath); window.setTimeout(() => window.posterApi.assistantOpen(), 1500); };
  return <div className="result-card">
    <div><span className="success-dot" /><b>Photoshop generation completed</b></div>
    <p>Editable PSD, PNG and JPG were created.</p>
    <div className="result-actions"><button onClick={() => window.posterApi.openPath(output.psdPath)}>Open PSD</button>{output.pngPath && <button onClick={() => window.posterApi.openPath(output.pngPath)}>Open PNG</button>}{output.jpgPath && <button onClick={() => window.posterApi.openPath(output.jpgPath)}>Open JPG</button>}<button onClick={() => window.posterApi.openPath(outputFolder)}>Open output folder</button></div>
    <div className="result-actions secondary"><button onClick={improve}>Improve design</button><button onClick={regenerate}>Regenerate</button></div>
    <BrainFeedback result={result} />
    {result.renderLog && <details className="job-details" open><summary>Job details and renderer provenance</summary>
      {result.renderLog.LEGACY_RENDERER_USED && <div className="status error">LEGACY RENDERER USED — OUTPUT REJECTED</div>}
      <dl className="output-summary">
        {Object.entries(result.renderLog).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{Array.isArray(value) ? value.join(', ') : typeof value === 'object' ? JSON.stringify(value) : String(value ?? '')}</dd></div>)}
      </dl>
    </details>}
    {[...output.quality.warnings, ...output.photoshopWarnings.map((message: string) => ({ message }))].map((warning: any, index) => <span className="warning" key={index}>{warning.message}</span>)}
  </div>;
}

function PreviewPanel({ plan, result, zoom, setZoom, fullscreen, setFullscreen }: {
  plan: Plan | null; result: any; zoom: PreviewZoom; setZoom: (zoom: PreviewZoom) => void; fullscreen: boolean; setFullscreen: (value: boolean) => void;
}) {
  const exported = result?.variations?.[0]?.pngPath;
  const width = zoom === 'fit' ? 'min(100%, 540px)' : `${1080 * zoom / 100}px`;
  return <aside className={`preview-panel ${fullscreen ? 'fullscreen-preview' : ''}`}>
    <div className="preview-header"><div><span className="eyebrow">LIVE POSTER PREVIEW</span><b>{exported ? 'Final Photoshop export' : '1080 × 1350 portrait'}</b></div><div className="preview-controls"><button className={zoom === 'fit' ? 'active' : ''} onClick={() => setZoom('fit')}>Fit</button>{([50, 75, 100] as const).map((value) => <button key={value} className={zoom === value ? 'active' : ''} onClick={() => setZoom(value)}>{value}%</button>)}<button onClick={() => setFullscreen(!fullscreen)}>{fullscreen ? 'Exit full screen' : 'Full screen'}</button></div></div>
    <div className="poster-stage">
      <div className="poster-canvas" style={{ width }}>
        {exported ? <img src={fileUrl(exported)} alt="Generated Daily Prayer poster" /> : plan ? <PlanSvg plan={plan} /> : <div className="preview-empty">Select a school profile to preview the poster.</div>}
      </div>
    </div>
  </aside>;
}

function LayerTree({ layers }: { layers: any[] }) {
  return <div className="layer-tree">{layers.map((layer) => <div key={layer.id} className="layer-branch">
    {layer.children?.length ? <details open={layer.depth === 0}><summary>{layer.name} <span>{layer.type}</span></summary><LayerTree layers={layer.children} /></details> : <div className="layer-leaf" style={{ paddingLeft: `${12 + layer.depth * 14}px` }}>{layer.name}<span>{layer.type}</span></div>}
  </div>)}</div>;
}

function PsdAnalysisPanel({ analysis }: { analysis: any }) {
  const rows = useMemo(() => {
    const flat: any[] = [];
    const walk = (layers: any[]) => layers.forEach((layer) => { if (layer.type !== 'group' && (layer.probableRole !== 'unknown' || layer.type === 'text' || layer.smartObject || layer.type === 'pixel')) flat.push(layer); walk(layer.children || []); });
    walk(analysis.layers); return flat;
  }, [analysis]);
  const [mapping, setMapping] = useState<Record<number, { role: string; use: boolean }>>(() => Object.fromEntries(rows.map((row) => [row.id, { role: row.probableRole, use: row.probableRole !== 'unknown' }])));
  const [confirmed, setConfirmed] = useState(false);
  const roles = ['unknown', 'schoolName', 'headerText', 'headline', 'subheadline', 'date', 'bodyText', 'logo', 'mainPhoto', 'supportingPhoto', 'photoPlaceholder', 'footer', 'background'];
  return <div className="analysis-panel">
    <div className="analysis-summary"><b>{analysis.document.name} · {analysis.document.width} × {analysis.document.height}</b><span>{analysis.layers.length} top-level layers · original PSD unchanged</span></div>
    <h3>Layer tree</h3><LayerTree layers={analysis.layers} />
    <h3>Role mapping</h3>
    <div className="mapping-table"><div className="mapping-head"><b>Detected layer</b><b>Type</b><b>Proposed role</b><b>Confidence</b><b>Use</b></div>{rows.map((row) => {
      const value = mapping[row.id] ?? { role: row.probableRole, use: false };
      return <div className="mapping-row" key={row.id}><span>{row.name}</span><span>{row.type}</span><select value={value.role} onChange={(e) => { setConfirmed(false); setMapping({ ...mapping, [row.id]: { ...value, role: e.target.value } }); }}>{roles.map((role) => <option key={role}>{role}</option>)}</select><span>{row.confidence}%</span><label><input type="checkbox" checked={value.use} onChange={(e) => { setConfirmed(false); setMapping({ ...mapping, [row.id]: { ...value, use: e.target.checked } }); }} /> {value.use ? 'Use' : 'Ignore'}</label></div>;
    })}</div>
    <div className="button-row"><button className="primary" onClick={() => setConfirmed(true)}>Confirm mapping</button></div>
    {confirmed && <div className="status success">Mapping confirmed for {Object.values(mapping).filter((item) => item.use).length} layers. The original PSD has not been modified.</div>}
  </div>;
}

function SettingsPage({ base }: { base: string }) {
  const [settings, setSettings] = useState<{ root: string; usage: any } | null>(null);
  const [migrationInfo, setMigrationInfo] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [migrationChoice, setMigrationChoice] = useState<'move' | 'none' | 'cancel' | null>(null);
  const load = async () => setSettings(await window.posterApi.getStorageSettings());
  useEffect(() => { load(); }, []);
  const changeRoot = async () => {
    const picked: any = await window.posterApi.chooseStorageRoot();
    if (picked.canceled) return;
    setBusy(true); setMsg(''); setMigrationChoice(null);
    try {
      const validation = await window.posterApi.validateStorageRoot(picked.path);
      if (!validation.valid) { setMsg(`Invalid: ${validation.errors?.join(', ') || validation.error}`); return; }
      const plan = await window.posterApi.estimateMigration(picked.path);
      if (plan.totalFiles > 0) {
        setMigrationInfo({ ...plan, newRoot: picked.path });
      } else {
        await window.posterApi.migrateStorage(picked.path, false);
        await load();
        setMsg('Storage root changed successfully.');
      }
    } catch (e) { setMsg(String(e)); } finally { setBusy(false); }
  };
  const confirmMigration = async (mode: 'move' | 'none') => {
    if (!migrationInfo) return;
    setBusy(true); setMsg('');
    try {
      const result = await window.posterApi.migrateStorage(migrationInfo.newRoot, mode === 'move');
      if (result.ok) {
        await load();
        setMsg(`Storage root changed successfully.${mode === 'move' ? ` Moved ${result.plan?.totalFiles || 0} files.` : ''}`);
        setMigrationInfo(null);
      } else {
        setMsg(`Migration failed: ${result.error}`);
      }
    } catch (e) { setMsg(`Migration failed: ${String(e)}`); } finally { setBusy(false); }
  };
  const openRoot = async () => { await window.posterApi.openStorageRoot(); };
  const clearDir = async (dir: 'cache' | 'temp') => {
    setBusy(true);
    try {
      const result = dir === 'cache' ? await window.posterApi.clearCache() : await window.posterApi.clearTemp();
      setMsg(`Cleared ${result.filesDeleted} files, recovered ${formatDiskSize(result.bytesRecovered)}.`);
      await load();
    } catch (e) { setMsg(String(e)); } finally { setBusy(false); }
  };
  const usage = settings?.usage;
  const disk = usage?.disk;
  return <section className="page-scroll">
    <div className="workflow-card">
      <h2>Settings</h2>

      <h3>Storage location</h3>
      <p>All project files, Photoshop exports, brand assets, and cache are stored here.</p>
      <div className="storage-info">
        <div className="storage-path"><b>Current root</b><code>{settings?.root || base}</code><button className="small" onClick={openRoot}>Open in Explorer</button></div>
        {usage && <div className="storage-stats">
          <span>Disk: {formatDiskSize(disk?.freeBytes || 0)} free / {formatDiskSize(disk?.totalBytes || 0)} total</span>
          <span>Used: {(disk?.usagePercent || 0).toFixed(1)}%</span>
          <span>Cache: {formatDiskSize(usage.cacheSizeBytes || 0)}</span>
          <span>Temp: {formatDiskSize(usage.tempSizeBytes || 0)}</span>
          <span>Directories: {usage.directoryCount || 0}</span>
        </div>}
      </div>
      <div className="button-row">
        <button disabled={busy} onClick={changeRoot}>Change storage location…</button>
        <button disabled={busy} onClick={() => clearDir('cache')}>Clear cache</button>
        <button disabled={busy} onClick={() => clearDir('temp')}>Clear temp files</button>
      </div>

      {migrationInfo && <div className="migration-card">
        <h4>Move existing project data to the new location?</h4>
        <p>New root: <code>{migrationInfo.newRoot}</code></p>
        <p>Files to migrate: {migrationInfo.totalFiles ?? '…'} ({formatDiskSize(migrationInfo.totalBytes || 0)})</p>
        <div className="button-row">
          <button className="primary" disabled={busy} onClick={() => confirmMigration('move')}>Move existing data</button>
          <button disabled={busy} onClick={() => confirmMigration('none')}>Use new location without moving</button>
          <button disabled={busy} onClick={() => setMigrationInfo(null)}>Cancel</button>
        </div>
        {migrationInfo.totalFiles > 0 && !migrationInfo.sufficientSpace && <div className="status error">Insufficient space on target drive. Free at least {formatDiskSize(migrationInfo.totalBytes)}.</div>}
      </div>}

      {msg && <div className={/success/i.test(msg) ? 'status success' : 'status error'}>{msg}</div>}

      <h3>Experimental integrations</h3>
      <p>Google Photos is hidden from the Daily Prayer workflow until it is configured and verified. Local upload is the primary photo method.</p>
    </div>
  </section>;
}

function App() {
  const [page, setPage] = useState<Page>('Dashboard');
  const [step, setStep] = useState<WorkflowStep>(1);
  const [base, setBase] = useState('Loading…');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [profiles, setProfiles] = useState<SchoolProfile[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [issues, setIssues] = useState<{ field: string; message: string }[]>([]);
  const [zoom, setZoom] = useState<PreviewZoom>('fit');
  const [fullscreen, setFullscreen] = useState(false);
  const [photos, setPhotos] = useState<PhotoPick[]>([]);
  const [birthdays, setBirthdays] = useState<PhotoPick[]>([]);
  const [referencePoster, setReferencePoster] = useState<PhotoPick[]>([]);
  const [programme, setProgramme] = useState(DEFAULT_PROGRAMME);
  const [management, setManagement] = useState({ chairman: false, principal: false });
  const [form, setForm] = useState({
    title: 'DAILY PRAYER PROCEEDINGS', subtitle: 'A meaningful start to the school day',
    date: '2026-07-13', prayerName: 'Morning Prayer', thought: '',
    message: 'Let us begin the day with discipline, confidence and positive thoughts.', examInfo: '', festivalInfo: '',
    showSchoolLogo: true, showLead: true, showChairman: true, showPrincipal: true, showContact: true, showAddress: true, showFooterBranding: true,
    overrideLogoPath: '',
    compositionFamily: 'auto',
  });
  const [showOverrides, setShowOverrides] = useState(false);
  const { stage, reset } = useProgress();

  const reloadProfiles = async () => {
    const list: SchoolProfile[] = await window.posterApi.profilesList();
    setProfiles(list);
    setSelectedId((current) => list.some((profile) => profile.id === current) ? current : (list[0]?.id ?? ''));
  };
  useEffect(() => {
    window.posterApi.bootstrap().then((data: any) => setBase(data.baseFolder));
    reloadProfiles();
    window.posterApi.profileGetDefault().then((defaultProfile) => { if (defaultProfile) setSelectedId(defaultProfile.id); });
  }, []);
  const profile = profiles.find((item) => item.id === selectedId);
  const day = dayForDate(form.date);
  const outputFolder = `${base}\\outputs`;
  const asset = (key: BrandAssetKey) => profile?.assets[key] ? { path: profile.assets[key]!.path, hasAlpha: profile.assets[key]!.hasAlpha, crop: profile.assets[key]!.crop } : undefined;

  const composeInput = useMemo<ComposeInput | null>(() => profile ? ({
    category: 'prayer', headline: form.title, subheadline: form.subtitle, message: form.message, details: displayDate(form.date),
    photos: [...photos, ...birthdays], width: profile.defaultWidth || 1080, height: profile.defaultHeight || 1350, variationSeed: 0,
    school: {
      name: profile.name,
      address: form.showAddress ? formatAddress(profile) : '',
      phone: form.showContact ? profile.phone1 : '',
      academicYear: `Academic Year ${profile.academicYear}`,
      logoPath: form.showSchoolLogo ? (form.overrideLogoPath || asset('mainLogo')?.path) : undefined,
    },
    brand: {
      colors: { primary: profile.branding.primary, secondary: profile.branding.secondary, accent: profile.branding.accent, background: profile.branding.background },
      headingFont: profile.branding.headingFont, bodyFont: profile.branding.bodyFont,
      footerStyle: form.showFooterBranding ? profile.branding.footerStyle : 'minimal-line',
      logoPlacement: profile.branding.logoPlacement,
      leadPlacement: profile.branding.leadPlacement, showLead: form.showLead && form.showFooterBranding,
    },
    assets: {
      mainLogo: form.showSchoolLogo ? (form.overrideLogoPath ? { path: form.overrideLogoPath } : asset('mainLogo')) : undefined,
      leadLogo: form.showLead && form.showFooterBranding ? asset('leadLogo') : undefined,
      studentPhoto: asset('studentPhoto'), assemblyPhoto: asset('assemblyPhoto'), campusPhoto: asset('campusPhoto'),
      background: asset('defaultBackground'),
    },
    management: {
      chairman: form.showChairman ? { show: true, asset: asset('chairmanPhoto'), name: profile.management.chairman.name || undefined, designation: profile.management.chairman.designation || 'Chairman', frame: 'circle' } : undefined,
      principal: form.showPrincipal ? { show: true, asset: asset('principalPhoto'), name: profile.management.principal.name || undefined, designation: profile.management.principal.designation || 'Principal', frame: 'circle' } : undefined,
    },
    prayer: { day, prayerTitle: form.prayerName, thought: form.thought, programme, examInfo: form.examInfo, festivalInfo: form.festivalInfo, birthdays: birthdays.map((item) => ({ name: item.name || 'Student', className: item.className })) },
    requestedCompositionFamily: form.compositionFamily === 'auto' ? undefined : form.compositionFamily,
  }) : null, [profile, form, photos, birthdays, programme, management, day]);
  const [previewPlan, setPreviewPlan] = useState<Plan | null>(null);
  useEffect(() => { try { setPreviewPlan(composeInput ? composeDailyPrayerEditorial(composeInput) : null); } catch { setPreviewPlan(null); } }, [composeInput]);
  const previewPlanHash = useMemo(() => previewPlan ? hashDesignPlan(previewPlan) : '', [previewPlan]);

  const buildRequest = () => ({
    category: 'prayer', headline: form.title, subheadline: form.subtitle, message: form.message, details: displayDate(form.date),
    width: profile?.defaultWidth || 1080, height: profile?.defaultHeight || 1350, variations: 1, exportPng: true, schoolProfileId: selectedId,
    logoPath: (form.showSchoolLogo && form.overrideLogoPath) ? form.overrideLogoPath : undefined,
    schoolOverride: {
      name: undefined, address: form.showAddress ? undefined : '', phone: form.showContact ? undefined : '',
      showLead: form.showLead && form.showFooterBranding,
    },
    photos: [...photos, ...birthdays].map(({ path, name, className, zoom, offsetX, offsetY }) => ({ path, name, className, zoom, offsetX, offsetY })),
    management: {
      chairman: form.showChairman && profile?.assets.chairmanPhoto ? { show: true, assetKey: 'chairmanPhoto', name: profile.management.chairman.name || undefined, designation: profile.management.chairman.designation || 'Chairman', frame: 'circle' } : undefined,
      principal: form.showPrincipal && profile?.assets.principalPhoto ? { show: true, assetKey: 'principalPhoto', name: profile.management.principal.name || undefined, designation: profile.management.principal.designation || 'Principal', frame: 'circle' } : undefined,
    },
    prayer: { day, prayerTitle: form.prayerName, thought: form.thought, programme, examInfo: form.examInfo, festivalInfo: form.festivalInfo, birthdays: birthdays.map((item) => ({ name: item.name || 'Student', className: item.className, photo: item.path })) },
    requestedCompositionFamily: form.compositionFamily === 'auto' ? undefined : form.compositionFamily,
    designPlan: previewPlan ?? undefined,
    previewPlanHash: previewPlanHash || undefined,
  });

  const generate = async () => {
    setBusy(true); setResult(null); setIssues([]); reset(); setStatus('Validating poster content and assets…'); setStep(3);
    try {
      const request = buildRequest();
      const validation: any = await window.posterApi.validatePosterRequest(request);
      if (!validation.ok) { setIssues(validation.issues); setStatus('Fix the highlighted issues before generating.'); return; }
      setStatus('Connecting to Photoshop…');
      const generated = await window.posterApi.generatePoster(request);
      setResult(generated); setStatus('Poster generated successfully in Photoshop.');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const recovery = /PHOTOSHOP|PS_COM|VBS/i.test(message) ? ' Start Photoshop, finish any open dialog, then choose Regenerate.' : '';
      setStatus(`${message}${recovery}`);
    } finally { setBusy(false); }
  };

  const analyze = async () => { setBusy(true); setStatus('Reading the active Photoshop document…'); try { setAnalysis(await window.posterApi.analyzeActivePsd()); setStatus('PSD analysis completed.'); } catch (error) { setStatus(String(error)); } finally { setBusy(false); } };

  const profileSummary = profile ? <div className="profile-summary">
    <div className="profile-summary-logo">{asset('mainLogo') ? <img src={`file://${asset('mainLogo')!.path}`} alt="School logo" /> : <div className="profile-summary-logo-placeholder">No logo</div>}</div>
    <div className="profile-summary-details">
      <b>{profile.name}</b>
      <span>{formatAddress(profile)}</span>
      <span>Phone: {profile.phone1}{profile.phone2 ? ` / ${profile.phone2}` : ''}</span>
      <span>Academic Year: {profile.academicYear}</span>
      <div className="profile-summary-management">
        {profile.management.chairman.name && <span>Chairman: {profile.management.chairman.name}</span>}
        {profile.management.principal.name && <span>Principal: {profile.management.principal.name}</span>}
      </div>
      <span className="profile-summary-lead">{profile.branding.showLead ? '✓ Powered by LEAD Curriculum' : ''}</span>
    </div>
    <button onClick={() => setPage('Brand Assets')} style={{ fontSize: 12, padding: '4px 10px', alignSelf: 'center' }}>Edit school profile</button>
  </div> : null;

  const contentStep = <div className="workflow-card">
    <div className="section-heading"><div><span className="eyebrow">STEP 1</span><h2>Content</h2><p>Enter today's prayer programme. The day follows the selected date automatically. School details are loaded from the profile.</p></div></div>
    <div className="form-grid compact">
      <label className="wide">School<select className="styled-select" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>{profiles.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
      {profileSummary}
      <label>Poster title<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
      <label>Subtitle<input value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} /></label>
      <label>Date<input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
      <label>Day<input readOnly value={day} /></label>
      <label className="wide">Prayer name<input value={form.prayerName} onChange={(e) => setForm({ ...form, prayerName: e.target.value })} /></label>
      <label className="wide">Composition family<select className="styled-select" value={form.compositionFamily} onChange={(e) => setForm({ ...form, compositionFamily: e.target.value })}>
        <option value="auto">Automatic — match available visual assets</option>
        <option value="fullBleedAssemblyEditorial">Full-Bleed Assembly Editorial</option>
        <option value="asymmetricStudentHero">Asymmetric Student Hero</option>
        <option value="editorialPhotoSplit">Editorial Photo Split</option>
        <option value="layeredPrayerCollage">Layered Prayer Collage</option>
        <option value="premiumEmblematicAssembly">Premium Emblematic Assembly (no photo)</option>
        <option value="magazineProgrammeLayout">Magazine Programme Layout</option>
      </select></label>
      <label className="wide">Thought of the day<textarea rows={2} value={form.thought} onChange={(e) => setForm({ ...form, thought: e.target.value })} /></label>
      <label className="wide">Main message<textarea rows={3} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></label>
      <label>Exam announcement<textarea rows={2} value={form.examInfo} onChange={(e) => setForm({ ...form, examInfo: e.target.value })} /></label>
      <label>Festival or special event<textarea rows={2} value={form.festivalInfo} onChange={(e) => setForm({ ...form, festivalInfo: e.target.value })} /></label>
    </div>
    <div className="subsection"><div className="section-heading"><div><h3>Programme order</h3><p>Drag rows to reorder. Every row becomes an editable Photoshop text layer.</p></div></div><ProgrammeRows items={programme} setItems={setProgramme} /></div>
    <div className="step-footer"><button className="primary" onClick={() => setStep(2)}>Continue to assets</button></div>
  </div>;

  const assetsStep = <div className="workflow-card">
    <div className="section-heading"><div><span className="eyebrow">STEP 2</span><h2>Assets</h2><p>Upload poster images here. Every asset is optional and missing assets never create blank frames. Toggle which items appear on the poster — these switches do not delete saved assets.</p></div></div>
    {profile && <>
      <div className="asset-grid">
        <ProfileAsset profileId={profile.id} assetKey="mainLogo" asset={profile.assets.mainLogo} emptyText="No main school logo selected" reload={reloadProfiles} />
        <ProfileAsset profileId={profile.id} assetKey="leadLogo" asset={profile.assets.leadLogo} emptyText="No LEAD logo selected" reload={reloadProfiles} />
        <ProfileAsset profileId={profile.id} assetKey="chairmanPhoto" asset={profile.assets.chairmanPhoto} emptyText="No chairman photo selected" reload={reloadProfiles} />
        <ProfileAsset profileId={profile.id} assetKey="principalPhoto" asset={profile.assets.principalPhoto} emptyText="No principal photo selected" reload={reloadProfiles} />
        <ProfileAsset profileId={profile.id} assetKey="studentPhoto" asset={profile.assets.studentPhoto} emptyText="No student hero photo selected" reload={reloadProfiles} />
        <ProfileAsset profileId={profile.id} assetKey="assemblyPhoto" asset={profile.assets.assemblyPhoto} emptyText="No assembly photo selected" reload={reloadProfiles} />
        <ProfileAsset profileId={profile.id} assetKey="campusPhoto" asset={profile.assets.campusPhoto} emptyText="No campus photo selected" reload={reloadProfiles} />
        <ProfileAsset profileId={profile.id} assetKey="defaultBackground" asset={profile.assets.defaultBackground} emptyText="No optional background image selected" reload={reloadProfiles} />
      </div>
      <div className="management-toggles">
        <label><input type="checkbox" checked={form.showSchoolLogo} onChange={(e) => setForm({ ...form, showSchoolLogo: e.target.checked })} /> Show school logo</label>
        <label><input type="checkbox" checked={form.showChairman} onChange={(e) => setForm({ ...form, showChairman: e.target.checked })} /> Show chairman {profile.management.chairman.name ? `(${profile.management.chairman.name})` : ''}</label>
        {form.showChairman && !profile.assets.chairmanPhoto && <div className="inline-warning"><span>No chairman photo is saved in the profile. Upload one now.</span><button onClick={async () => { await window.posterApi.assetImport(profile.id, 'chairmanPhoto'); await reloadProfiles(); }}>Upload</button></div>}
        <label><input type="checkbox" checked={form.showPrincipal} onChange={(e) => setForm({ ...form, showPrincipal: e.target.checked })} /> Show principal {profile.management.principal.name ? `(${profile.management.principal.name})` : ''}</label>
        {form.showPrincipal && !profile.assets.principalPhoto && <div className="inline-warning"><span>No principal photo is saved in the profile. Upload one now.</span><button onClick={async () => { await window.posterApi.assetImport(profile.id, 'principalPhoto'); await reloadProfiles(); }}>Upload</button></div>}
        <label><input type="checkbox" checked={form.showContact} onChange={(e) => setForm({ ...form, showContact: e.target.checked })} /> Show contact number ({profile.phone1})</label>
        <label><input type="checkbox" checked={form.showAddress} onChange={(e) => setForm({ ...form, showAddress: e.target.checked })} /> Show address</label>
        <label><input type="checkbox" checked={form.showLead} onChange={(e) => setForm({ ...form, showLead: e.target.checked })} /> Show LEAD branding</label>
        <label><input type="checkbox" checked={form.showFooterBranding} onChange={(e) => setForm({ ...form, showFooterBranding: e.target.checked })} /> Show footer branding</label>
      </div>
      {/* Per-poster overrides */}
      <div style={{ marginTop: 16 }}>
        <button onClick={() => setShowOverrides(!showOverrides)} style={{ fontSize: 12, borderStyle: 'dashed' }}>
          {showOverrides ? '−' : '+'} Use a different image for this poster only
        </button>
        {showOverrides && <div className="form-grid compact" style={{ marginTop: 8 }}>
          <label className="wide" style={{ fontSize: 12, opacity: 0.8 }}>School logo override (for this poster only — does not replace saved logo)</label>
          <label className="wide" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input value={form.overrideLogoPath} onChange={(e) => setForm({ ...form, overrideLogoPath: e.target.value })} placeholder="Image file path…" style={{ flex: 1 }} />
            <button onClick={async () => {
              const r = await window.posterApi.pickImages('logo');
              if (!r.canceled && r.paths[0]) setForm({ ...form, overrideLogoPath: r.paths[0] });
            }} style={{ padding: '4px 10px', fontSize: 12 }}>Browse</button>
            {form.overrideLogoPath && <button onClick={() => setForm({ ...form, overrideLogoPath: '' })} style={{ padding: '4px 8px', fontSize: 12, borderColor: '#a03' }}>Clear</button>}
          </label>
        </div>}
      </div>
    </>}
    <PhotoAssets title="Student photos" emptyText="No student photos selected" photos={photos} setPhotos={setPhotos} />
    <PhotoAssets title="Birthday-student photos" emptyText="No birthday-student photos selected" photos={birthdays} setPhotos={setBirthdays} max={12} />
    <PhotoAssets title="Optional reference poster" emptyText="No reference poster selected" photos={referencePoster} setPhotos={setReferencePoster} max={1} withNames={false} />
    <div className="step-footer"><button onClick={() => setStep(1)}>Back</button><button className="primary" onClick={() => setStep(3)}>Review poster</button></div>
  </div>;

  const reviewStep = <div className="workflow-card review-card">
    <div className="section-heading"><div><span className="eyebrow">STEP 3</span><h2>Review and generate</h2><p>Check the live preview, then create the editable Photoshop document and exports.</p></div></div>
    <dl className="output-summary"><div><dt>Output size</dt><dd>1080 × 1350 px</dd></div><div><dt>PSD</dt><dd>{outputFolder}\\psd\\{profile?.name ? profile.name.replace(/[^a-zA-Z0-9]/g, '_') : 'school'}\\{form.date.replace(/-/g, '')}\\</dd></div><div><dt>PNG</dt><dd>{outputFolder}\\png\\{profile?.name ? profile.name.replace(/[^a-zA-Z0-9]/g, '_') : 'school'}\\{form.date.replace(/-/g, '')}\\</dd></div><div><dt>Photoshop files</dt><dd>Editable PSD + PNG + JPG</dd></div></dl>
    {issues.length > 0 && <div className="error-card"><b>Fix before generating</b>{issues.map((issue, index) => <span key={index}>{issue.message}</span>)}</div>}
    <ProgressBar stage={busy ? stage : null} />
    {status && <div className={/successfully|completed/i.test(status) ? 'status success' : /error|failed|PHOTOSHOP|PS_COM|VBS/i.test(status) ? 'status error' : 'status'}>{status}</div>}
    <Results result={result} outputFolder={outputFolder} regenerate={generate} />
    <div className="step-footer"><button onClick={() => setStep(2)}>Back to assets</button></div>
  </div>;

  return <div className="app-shell">
    <aside className="sidebar"><div className="brand"><img src="app-icon.png" alt="SNHS" /><div><b>SNHS</b><span>SMART POSTER AGENT</span></div></div><nav>{PAGES.map((item) => <button key={item} className={page === item ? 'active' : ''} onClick={() => setPage(item)}>{item}</button>)}</nav><div className="school-chip"><b>{profile?.name || 'No school selected'}</b><span>{profile ? formatAddress(profile) : ''}</span></div></aside>
    <main className="main-shell">
      <header className="topbar"><div><h1>{page}</h1><p>Professional layered poster automation for Photoshop</p></div>{profile && <label className="school-select"><span>School</span><select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>{profiles.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}</header>
      {page === 'Dashboard' && <section className="dashboard"><div className="hero"><span className="eyebrow">WINDOWS + PHOTOSHOP</span><h2>Create today's school poster as a real editable PSD.</h2><p>The Daily Prayer workflow generates a professional 1080 × 1350 poster, exports PNG and JPG, and keeps every major element editable.</p><button className="primary" onClick={() => { setPage('Daily Prayer'); setStep(1); }}>Create Daily Prayer poster</button></div><div className="dashboard-grid"><article><span>Core workflow</span><b>Photoshop generation ready</b></article><article><span>Output</span><b>PSD · PNG · JPG</b></article><article><span>Canvas</span><b>1080 × 1350</b></article></div>
        <RecentEdits selectedSchoolId={selectedId} onEdit={(job) => { setPage('Daily Prayer'); /* TODO: load job into form */ }} />
      </section>}
      {page === 'Daily Prayer' && <section className="prayer-workspace">
        <div className="workflow-panel"><div className="step-tabs">{([1, 2, 3] as const).map((value) => <button key={value} className={step === value ? 'active' : ''} onClick={() => setStep(value)}><span>{value}</span>{value === 1 ? 'Content' : value === 2 ? 'Assets' : 'Review & Generate'}</button>)}</div>{step === 1 ? contentStep : step === 2 ? assetsStep : reviewStep}<div className="generate-bar"><div><b>{busy ? 'Photoshop is generating your poster…' : 'Ready to create the editable poster'}</b><span>PSD, PNG and JPG · 1080 × 1350</span></div><button className="primary generate" disabled={busy || !profile} onClick={generate}>{busy ? 'Generating in Photoshop…' : 'Generate in Photoshop'}</button></div></div>
        <PreviewPanel plan={previewPlan} result={result} zoom={zoom} setZoom={setZoom} fullscreen={fullscreen} setFullscreen={setFullscreen} />
      </section>}
      {page === 'Brand Assets' && <section className="page-scroll"><SchoolProfiles profiles={profiles} reload={reloadProfiles} selectedId={selectedId} onSelect={setSelectedId} /></section>}
      {page === 'Edit Existing PSD' && <section className="page-scroll"><div className="workflow-card"><h2>Analyze current PSD</h2><p>Open a PSD in Photoshop, then inspect its layer hierarchy and proposed content roles without changing the original document.</p><div className="button-row"><button className="primary" disabled={busy} onClick={analyze}>{busy ? 'Analyzing…' : 'Analyze current PSD'}</button><button onClick={() => window.posterApi.assistantOpen()}>Open Design Assistant</button></div>{analysis && <PsdAnalysisPanel analysis={analysis} />}{status && <div className="status">{status}</div>}</div></section>}
      {page === 'Settings' && <SettingsPage base={base} />}
    </main>
  </div>;
}

createRoot(document.getElementById('root')!).render(<App />);
