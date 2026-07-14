import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { PosterApi } from '../main/preload';
import { composeDailyPrayerEditorial } from '../main/design/dailyPrayerFamilies';
import { hashDesignPlan } from '../shared/designPlanHash';
import type { ComposeInput, Plan } from '../main/design/types';
import { ASSET_LABELS, formatAddress, type BrandAsset, type BrandAssetKey, type SchoolProfile } from '../shared/brandKit';
import { PlanSvg } from './planToSvg';
import { SchoolProfiles } from './SchoolProfiles';
import { POSTER_CATEGORIES, type PosterCategoryId, type PosterCategory, POPULAR_CATEGORIES, CANVAS_OPTIONS, inferCategoryFromDescription } from '../shared/posterCategories';

declare global { interface Window { posterApi: PosterApi } }

type Page = 'Dashboard' | 'Create Poster' | 'Recreate Reference' | 'Edit Existing PSD' | 'Brand Assets' | 'Recent Edits' | 'Settings';
type WorkflowStep = 'select-type' | 'select-mode' | 'content' | 'assets' | 'review';
type CreateMode = 'new-design' | 'recreate-reference' | 'use-psd' | 'blank-canvas';
type PreviewZoom = 'fit' | 50 | 75 | 100;

const PAGES: Page[] = ['Dashboard', 'Create Poster', 'Recreate Reference', 'Edit Existing PSD', 'Recent Edits', 'Brand Assets', 'Settings'];
const CATEGORY_SHORTCUTS: { id: PosterCategoryId; label: string; icon: string }[] = [
  { id: 'admissions-open', label: 'Admissions', icon: '📚' },
  { id: 'daily-prayer', label: 'Daily Prayer', icon: '🙏' },
  { id: 'birthday-wishes', label: 'Birthday', icon: '🎂' },
  { id: 'student-achievement', label: 'Achievement', icon: '🏆' },
  { id: 'holiday-notice', label: 'Notices', icon: '🎉' },
  { id: 'teacher-recruitment', label: 'Recruitment', icon: '👩‍🏫' },
  { id: 'custom', label: 'Custom', icon: '✨' },
];
const STAGES = ['Analysing content', 'Selecting composition', 'Preparing photos', 'Building Photoshop layers', 'Fitting typography', 'Running quality checks', 'Exporting files'];

interface PhotoPick {
  path: string; name?: string; className?: string;
  width?: number; height?: number; bytes?: number;
  zoom?: number; offsetX?: number; offsetY?: number;
}

interface PosterFormData {
  category: PosterCategoryId;
  createMode: CreateMode;
  canvasId: string;
  customWidth: number;
  customHeight: number;
  values: Record<string, string>;
  photos: PhotoPick[];
  programmeItems: string[];
  referenceImage: PhotoPick[];
  userDescription: string;
  inferredCategory: PosterCategoryId | null;
  inferredReasoning: string;
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
  if (!value) return '';
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.valueOf()) ? '' : date.toLocaleDateString('en-GB', { weekday: 'long' });
}
function displayDate(value: string): string {
  if (!value) return '';
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
      <button className="add-row" onClick={() => setItems([...items, `Item ${items.length + 1}`])}>+ Add item</button>
    </div>
  );
}

function RecentEdits({ selectedSchoolId, onEdit, onCreateNew }: { selectedSchoolId: string; onEdit: (job: any) => void; onCreateNew: () => void }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const load = async () => {
    setLoading(true);
    try {
      const list = await window.posterApi.listRecentEdits(selectedSchoolId || undefined, 24);
      setItems(list || []);
    } catch { setItems([]); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [selectedSchoolId]);

  const allCategories = Object.values(POSTER_CATEGORIES);
  const filtered = items.filter((item: any) => {
    if (search) {
      const q = search.toLowerCase();
      if (!item.title?.toLowerCase().includes(q) && !item.schoolName?.toLowerCase().includes(q) && !item.category?.toLowerCase().includes(q)) return false;
    }
    if (filterCategory && item.category !== filterCategory && item.posterType !== filterCategory) return false;
    if (filterStatus && item.status !== filterStatus) return false;
    return true;
  }).slice(0, 12);

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

  const categoryOptions = [
    { value: '', label: 'All categories' },
    ...allCategories.map(c => ({ value: c.id, label: c.name })),
  ];

  return <section className="recent-edits">
    <div className="section-heading">
      <div>
        <h2>Recent Edits</h2>
        <p>Continue working on your latest posters and projects.</p>
      </div>
      <div className="recent-edits-filters">
        <input placeholder="Search posters…" value={search} onChange={(e) => setSearch(e.target.value)} className="search-input" />
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
          {categoryOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
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
        <button className="primary" onClick={onCreateNew}>Create New Poster</button>
      </div>
    ) : (
      <div className="recent-edits-grid">
        {filtered.map((item: any) => {
          const cat = allCategories.find(c => c.id === item.category || c.id === item.posterType);
          const thumbnail = item.thumbnailPath || item.previewPath || item.pngPath || item.jpgPath;
          const missing = item.status === 'missing-file' || (item.psdPath && false);
          return <article className="recent-edit-card" key={item.jobId}>
            <div className="recent-edit-thumb">
              {thumbnail ? <img src={encodeURI(`file:///${thumbnail.replace(/\\/g, '/')}`)} alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} /> : <div className="recent-edit-thumb-placeholder">{cat?.icon || '📄'}</div>}
            </div>
            <div className="recent-edit-body">
              <h4>{item.title || 'Untitled Poster'}</h4>
              <span className="recent-edit-category">{cat?.icon || '📄'} {cat?.name || item.category}</span>
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
              </div>
            </div>
          </article>;
        })}
      </div>
    )}
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
  const psdPath = result.psdPath || output.psdPath;
  const pngPath = result.pngPath || output.pngPath;
  const jpgPath = result.jpgPath || output.jpgPath;
  const improve = async () => { await window.posterApi.openPath(output.psdPath); window.setTimeout(() => window.posterApi.assistantOpen(), 1500); };
  return <div className="result-card">
    <div><span className="success-dot" /><b>Photoshop generation completed</b></div>
    <p>Editable PSD, PNG and JPG were created.</p>
    <dl className="output-summary"><div><dt>PSD</dt><dd>{psdPath}</dd></div>{pngPath && <div><dt>PNG</dt><dd>{pngPath}</dd></div>}{jpgPath && <div><dt>JPG</dt><dd>{jpgPath}</dd></div>}{result.jobDirectory && <div><dt>Job folder</dt><dd>{result.jobDirectory}</dd></div>}</dl>
    <div className="result-actions"><button onClick={() => window.posterApi.openStorageFolder('psd')}>Open PSD folder</button>{pngPath && <button onClick={() => window.posterApi.openStorageFolder('png')}>Open image folder</button>}{result.jobDirectory && <button onClick={() => window.posterApi.openPath(result.jobDirectory)}>Open job folder</button>}</div>
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

function PreviewPanel({ plan, result, zoom, setZoom, fullscreen, setFullscreen, categoryName }: {
  plan: Plan | null; result: any; zoom: PreviewZoom; setZoom: (zoom: PreviewZoom) => void; fullscreen: boolean; setFullscreen: (value: boolean) => void; categoryName?: string;
}) {
  const exported = result?.variations?.[0]?.pngPath;
  const width = zoom === 'fit' ? 'min(100%, 540px)' : `${1080 * zoom / 100}px`;
  return <aside className={`preview-panel ${fullscreen ? 'fullscreen-preview' : ''}`}>
    <div className="preview-header"><div><span className="eyebrow">LIVE POSTER PREVIEW</span><b>{exported ? 'Final Photoshop export' : 'Poster preview'}</b></div><div className="preview-controls"><button className={zoom === 'fit' ? 'active' : ''} onClick={() => setZoom('fit')}>Fit</button>{([50, 75, 100] as const).map((value) => <button key={value} className={zoom === value ? 'active' : ''} onClick={() => setZoom(value)}>{value}%</button>)}<button onClick={() => setFullscreen(!fullscreen)}>{fullscreen ? 'Exit full screen' : 'Full screen'}</button></div></div>
    <div className="poster-stage">
      <div className="poster-canvas" style={{ width }}>
        {exported ? <img src={fileUrl(exported)} alt={`Generated ${categoryName || 'poster'}`} /> : plan ? <PlanSvg plan={plan} /> : <div className="preview-empty">Select a school profile to preview the poster.</div>}
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
  const [settings, setSettings] = useState<{ root: string; usage: any; validation?: any; paths?: any } | null>(null);
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
  const resetRoot = async () => {
    setBusy(true); setMsg('');
    try { await window.posterApi.resetStorageRoot(); await load(); setMsg('Storage location reset to the E: default.'); }
    catch (e) { setMsg(String(e)); } finally { setBusy(false); }
  };
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
        {settings?.validation && <div className={settings.validation.valid ? 'status success' : 'status error'}>{settings.validation.valid ? 'Storage drive connected and writable.' : settings.validation.errors?.join(' ')}</div>}
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
        <button disabled={busy} onClick={load}>Check available space</button>
        <button disabled={busy} onClick={resetRoot}>Reset to default</button>
        <button disabled={busy} onClick={() => window.posterApi.openStorageFolder('psd')}>Open PSD folder</button>
        <button disabled={busy} onClick={() => window.posterApi.openStorageFolder('png')}>Open image folder</button>
        <button disabled={busy} onClick={() => window.posterApi.openStorageFolder('jobs')}>Open jobs folder</button>
        <button disabled={busy} onClick={() => clearDir('cache')}>Clear cache</button>
        <button disabled={busy} onClick={() => clearDir('temp')}>Clear temp files</button>
      </div>
      {migrationInfo && <div className="migration-card">{/* migration UI unchanged */}</div>}
      {msg && <div className={/success/i.test(msg) ? 'status success' : 'status error'}>{msg}</div>}
    </div>
  </section>;
}

function App() {
  const [page, setPage] = useState<Page>('Dashboard');
  const [step, setStep] = useState<WorkflowStep>('select-type');
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
  const [searchQuery, setSearchQuery] = useState('');
  const [showInferred, setShowInferred] = useState(false);
  const { stage, reset } = useProgress();

  const initFormData = (): PosterFormData => ({
    category: 'daily-prayer',
    createMode: 'new-design',
    canvasId: 'instagram-portrait',
    customWidth: 1080,
    customHeight: 1350,
    values: {},
    photos: [],
    programmeItems: ['Prayer Song', 'Pledge', 'Thought for the Day', 'News Headlines', 'Word of the Day', 'Quiz Question', 'Birthday Wishes', 'Principal\'s Message', 'National Anthem'],
    referenceImage: [],
    userDescription: '',
    inferredCategory: null,
    inferredReasoning: '',
  });

  const [form, setForm] = useState<PosterFormData>(initFormData);

  const [management, setManagement] = useState({ chairman: false, principal: false });
  const [formToggles, setFormToggles] = useState({
    showSchoolLogo: true, showLead: true, showChairman: true, showPrincipal: true,
    showContact: true, showAddress: true, showFooterBranding: true,
    overrideLogoPath: '',
    compositionFamily: 'auto',
  });
  const [showOverrides, setShowOverrides] = useState(false);

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
  const category = POSTER_CATEGORIES[form.category];
  const outputFolder = `${base}\\outputs`;
  const day = dayForDate(form.values.eventDate || form.values.date);

  const asset = (key: BrandAssetKey) => profile?.assets[key] ? { path: profile.assets[key]!.path, hasAlpha: profile.assets[key]!.hasAlpha, crop: profile.assets[key]!.crop } : undefined;

  const resetForm = () => {
    setForm(initFormData());
    setResult(null);
    setIssues([]);
    setStep('select-type');
    setStatus('');
    reset();
  };

  const startCreatePoster = (categoryId?: PosterCategoryId) => {
    const cat = categoryId ? POSTER_CATEGORIES[categoryId] : null;
    const defaults: Record<string, string> = {};
    if (cat) {
      for (const f of cat.fields) {
        if (f.kind === 'date') {
          defaults[f.key] = new Date().toISOString().split('T')[0];
        }
      }
    }
    setForm({
      ...initFormData(),
      category: categoryId || 'daily-prayer',
      values: defaults,
      programmeItems: categoryId === 'daily-prayer'
        ? ['Prayer Song', 'Pledge', 'Thought for the Day', 'News Headlines', 'Word of the Day', 'Quiz Question', 'Birthday Wishes', 'Principal\'s Message', 'National Anthem']
        : [],
    });
    setResult(null);
    setIssues([]);
    setStep('select-mode');
    setStatus('');
    reset();
  };

  const getCanvasDims = () => {
    const opt = CANVAS_OPTIONS.find(c => c.id === form.canvasId);
    if (form.canvasId === 'custom') return { w: form.customWidth || 1080, h: form.customHeight || 1350 };
    return { w: opt?.width || 1080, h: opt?.height || 1350 };
  };

  const inferredResult = useMemo(() => {
    if (form.userDescription.trim().length < 10) return null;
    return inferCategoryFromDescription(form.userDescription);
  }, [form.userDescription]);

  const buildContentBlocks = () => {
    const blocks: { role: string; text?: string; imagePath?: string }[] = [];
    const cat = category;
    if (!cat) return blocks;
    for (const field of cat.fields) {
      const val = form.values[field.key];
      if (val) {
        blocks.push({ role: field.key, text: val });
      }
    }
    return blocks;
  };

  const buildRequest = () => {
    const dims = getCanvasDims();
    const head = form.values.headline || form.values.posterTitle || form.values.subject || form.values.eventName || form.values.competitionName || form.values.holidayName || form.values.festivalName || form.values.dayName || form.values.topic || form.values.campName || form.values.promoTitle || form.values.announcementTitle || form.values.meetingTitle || form.values.feeTitle || form.values.awardTitle || form.values.achievementTitle || form.values.studentName || form.values.subjectName || form.values.recipientName || form.values.schoolName || form.values.examName || form.values.quote || category?.name || 'Poster';
    const subhead = form.values.subtitle || form.values.subheadline || '';
    const msg = form.values.message || form.values.bodyContent || form.values.body || form.values.details || form.values.greetingMessage || form.values.birthdayMessage || form.values.congratulationsMessage || form.values.instructions || '';
    const detail = form.values.date || form.values.eventDate || form.values.holidayDate || form.values.startDate || form.values.reopeningDate || form.values.dueDate || form.values.admissionDate || form.values.interviewDate || form.values.resultDate || form.values.festivalDate || '';

    return {
      category: form.category,
      headline: head,
      subheadline: subhead,
      message: msg,
      details: detail,
      contentBlocks: buildContentBlocks(),
      width: dims.w,
      height: dims.h,
      variations: 1,
      exportPng: true,
      schoolProfileId: selectedId,
      photos: form.photos.map(({ path, name, className, zoom, offsetX, offsetY }) => ({ path, name, className, zoom, offsetX, offsetY })),
      prayer: form.category === 'daily-prayer' ? {
        day: day || dayForDate(form.values.eventDate),
        prayerTitle: form.values.prayerName || 'Morning Prayer',
        thought: form.values.thought || '',
        programme: form.programmeItems.length > 0 ? form.programmeItems : undefined,
        examInfo: form.values.examInfo || '',
        festivalInfo: form.values.festivalInfo || '',
        birthdays: form.photos.filter(p => p.name).map(p => ({ name: p.name || 'Student', className: p.className })),
      } : undefined,
      management: {
        chairman: formToggles.showChairman && profile?.assets.chairmanPhoto ? { show: true, assetKey: 'chairmanPhoto', name: profile.management.chairman.name || undefined, designation: profile.management.chairman.designation || 'Chairman', frame: 'circle' } : undefined,
        principal: formToggles.showPrincipal && profile?.assets.principalPhoto ? { show: true, assetKey: 'principalPhoto', name: profile.management.principal.name || undefined, designation: profile.management.principal.designation || 'Principal', frame: 'circle' } : undefined,
      },
      useProEngine: form.createMode === 'new-design' && form.category !== 'daily-prayer',
    };
  };

  const previewPlan = useMemo<Plan | null>(() => {
    if (!profile || form.category !== 'daily-prayer') return null;
    try {
      const ci: ComposeInput = {
        category: 'prayer',
        headline: form.values.headline || form.values.posterTitle || 'DAILY PRAYER PROCEEDINGS',
        subheadline: form.values.subtitle || 'A meaningful start to the school day',
        message: form.values.message || '',
        details: displayDate(form.values.eventDate || form.values.date || ''),
        photos: form.photos.map(p => ({ path: p.path, name: p.name, className: p.className })),
        school: {
          name: profile.name,
          address: formToggles.showAddress ? formatAddress(profile) : '',
          phone: formToggles.showContact ? profile.phone1 : '',
          academicYear: `Academic Year ${profile.academicYear}`,
          logoPath: formToggles.showSchoolLogo ? (formToggles.overrideLogoPath || asset('mainLogo')?.path) : undefined,
        },
        brand: {
          colors: { primary: profile.branding.primary, secondary: profile.branding.secondary, accent: profile.branding.accent, background: profile.branding.background },
          headingFont: profile.branding.headingFont, bodyFont: profile.branding.bodyFont,
          footerStyle: formToggles.showFooterBranding ? profile.branding.footerStyle : 'minimal-line',
          logoPlacement: profile.branding.logoPlacement,
          leadPlacement: profile.branding.leadPlacement, showLead: formToggles.showLead && formToggles.showFooterBranding,
        },
        assets: {
          mainLogo: formToggles.showSchoolLogo ? (formToggles.overrideLogoPath ? { path: formToggles.overrideLogoPath } : asset('mainLogo')) : undefined,
          leadLogo: formToggles.showLead && formToggles.showFooterBranding ? asset('leadLogo') : undefined,
          studentPhoto: asset('studentPhoto'), assemblyPhoto: asset('assemblyPhoto'), campusPhoto: asset('campusPhoto'),
          background: asset('defaultBackground'),
        },
        management: {
          chairman: formToggles.showChairman ? { show: true, asset: asset('chairmanPhoto'), name: profile.management.chairman.name || undefined, designation: profile.management.chairman.designation || 'Chairman', frame: 'circle' } : undefined,
          principal: formToggles.showPrincipal ? { show: true, asset: asset('principalPhoto'), name: profile.management.principal.name || undefined, designation: profile.management.principal.designation || 'Principal', frame: 'circle' } : undefined,
        },
        prayer: {
          day: day || 'TODAY',
          prayerTitle: form.values.prayerName || 'Morning Prayer',
          thought: form.values.thought || '',
          programme: form.programmeItems,
          examInfo: form.values.examInfo || '',
          festivalInfo: form.values.festivalInfo || '',
          birthdays: form.photos.filter(p => p.name).map(item => ({ name: item.name || 'Student', className: item.className })),
        },
        width: profile.defaultWidth || 1080,
        height: profile.defaultHeight || 1350,
        variationSeed: 0,
        requestedCompositionFamily: formToggles.compositionFamily === 'auto' ? undefined : formToggles.compositionFamily,
      };
      return composeDailyPrayerEditorial(ci);
    } catch { return null; }
  }, [form, profile, formToggles, day]);

  const validate = async () => {
    const req = buildRequest();
    const validation: any = await window.posterApi.validatePosterRequest(req);
    if (!validation.ok) { setIssues(validation.issues); return false; }
    return true;
  };

  const generate = async () => {
    setBusy(true); setResult(null); setIssues([]); reset(); setStatus('Validating poster content and assets…');
    try {
      const request = buildRequest();
      const ok = await validate();
      if (!ok) { setStatus('Fix the highlighted issues before generating.'); return; }
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

  const filteredCategories = Object.values(POSTER_CATEGORIES).filter(c => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q) || c.id.includes(q);
  });

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

  const renderCategoryCards = () => <div className="category-grid">
    {filteredCategories.map((cat) => (
      <button key={cat.id} className="category-card" onClick={() => { setForm({ ...form, category: cat.id as PosterCategoryId }); startCreatePoster(cat.id as PosterCategoryId); }}>
        <span className="category-icon" aria-hidden="true">{cat.name.slice(0, 1)}</span>
        <span className="category-name">{cat.name}</span>
        <span className="category-desc">{cat.description}</span>
      </button>
    ))}
  </div>;

  const renderField = (field: PosterCategory['fields'][number]) => {
    const val = form.values[field.key] ?? '';
    const setVal = (v: string) => setForm({ ...form, values: { ...form.values, [field.key]: v } });

    if (field.kind === 'boolean') {
      return <label key={field.key} className="field-boolean">
        <input type="checkbox" checked={val === 'true'} onChange={(e) => setVal(e.target.checked ? 'true' : 'false')} />
        <span>{field.label}</span>
      </label>;
    }

    if (field.kind === 'select' && field.options) {
      return <label key={field.key} className="field-select">
        <span>{field.label}{field.required ? ' *' : ''}</span>
        <select value={val} onChange={(e) => setVal(e.target.value)}>
          <option value="">Select...</option>
          {field.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </label>;
    }

    return (
      <label key={field.key} className={`field-${field.kind}`}>
        <span>{field.label}{field.required ? ' *' : ''}</span>
        {field.kind === 'textarea' ? (
          <textarea value={val} onChange={(e) => setVal(e.target.value)} placeholder={field.placeholder} rows={field.key === 'programmeItems' || field.key === 'userDescription' ? 4 : 3} />
        ) : field.kind === 'date' ? (
          <input type="date" value={val} onChange={(e) => setVal(e.target.value)} />
        ) : field.kind === 'multi-image' ? (
          <div className="field-multi-image">
            <button onClick={async () => {
              const picked = await pickImages();
              if (picked.length) setForm({ ...form, photos: [...form.photos, ...picked].slice(0, 16) });
            }}>Upload {field.label}</button>
            {form.photos.length > 0 && <span>{form.photos.length} photo(s) selected</span>}
          </div>
        ) : field.kind === 'image' ? (
          <div className="field-image">
            <button onClick={async () => {
              const picked = await pickImages();
              if (picked[0]) setForm({ ...form, photos: [...form.photos, picked[0]] });
            }}>Upload {field.label}</button>
          </div>
        ) : (
          <input type="text" value={val} onChange={(e) => setVal(e.target.value)} placeholder={field.placeholder} />
        )}
      </label>
    );
  };

  const renderCustomInference = () => {
    if (!form.userDescription || form.userDescription.trim().length < 10) return null;
    const inf = inferCategoryFromDescription(form.userDescription);
    const cat = POSTER_CATEGORIES[inf.categoryId];
    return (
      <div className="inference-card">
        <h4>Inferred Poster Type</h4>
        <p><strong>{cat?.icon || '📄'} {cat?.name || inf.categoryId}</strong></p>
        <p className="inference-reason">{inf.reasoning}</p>
        <p className="inference-suggestion">The system will generate a {cat?.name?.toLowerCase() || 'poster'} layout based on your description.</p>
      </div>
    );
  };

  const renderSelectType = () => <section className="page-scroll">
    <div className="workflow-card">
      <div className="section-heading"><div><span className="eyebrow">STEP 1</span><h2>Choose Poster Type</h2><p>Select the type of poster you want to create.</p></div></div>
      <div className="category-search">
        <input type="text" placeholder="Search poster types…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="search-input large" />
      </div>
      <div className="popular-categories">
        <h3>Popular</h3>
        <div className="popular-grid">
          {POPULAR_CATEGORIES.map(id => {
            const cat = POSTER_CATEGORIES[id];
            return <button key={id} className="popular-chip" onClick={() => startCreatePoster(id)}>
              <span className="category-icon" aria-hidden="true">{cat.name.slice(0, 1)}</span>
              <span>{cat.name}</span>
            </button>;
          })}
        </div>
      </div>
      <h3>All Categories</h3>
      {renderCategoryCards()}
    </div>
  </section>;

  const renderSelectMode = () => {
    const cat = category;
    return <section className="page-scroll">
      <div className="workflow-card">
        <div className="section-heading"><div><span className="eyebrow">STEP 2</span><h2>How should this poster be created?</h2><p>{cat?.icon} {cat?.name} — {cat?.description}</p></div></div>
        <div className="create-mode-grid">
          <button className={`create-mode-card ${form.createMode === 'new-design' ? 'selected' : ''}`} onClick={() => setForm({ ...form, createMode: 'new-design' })}>
            <span className="mode-icon">🎨</span>
            <span className="mode-name">Create a New Design</span>
            <span className="mode-desc">Generate a new composition using school assets and category-appropriate design families.</span>
          </button>
          <button className={`create-mode-card ${form.createMode === 'recreate-reference' ? 'selected' : ''}`} onClick={() => setForm({ ...form, createMode: 'recreate-reference' })}>
            <span className="mode-icon">📐</span>
            <span className="mode-name">Recreate a Reference Poster</span>
            <span className="mode-desc">Upload a reference poster to analyse and rebuild with your branding and content.</span>
          </button>
          <button className={`create-mode-card ${form.createMode === 'use-psd' ? 'selected' : ''}`} onClick={() => setForm({ ...form, createMode: 'use-psd' })}>
            <span className="mode-icon">📁</span>
            <span className="mode-name">Use an Existing PSD Template</span>
            <span className="mode-desc">Select a PSD and map your content into its existing editable layers.</span>
          </button>
          <button className={`create-mode-card ${form.createMode === 'blank-canvas' ? 'selected' : ''}`} onClick={() => setForm({ ...form, createMode: 'blank-canvas' })}>
            <span className="mode-icon">🖌️</span>
            <span className="mode-name">Start from Blank Canvas</span>
            <span className="mode-desc">Open the Design Assistant to add text, photos, and shapes manually.</span>
          </button>
        </div>
        <div className="canvas-selector">
          <h3>Canvas Size</h3>
          <div className="canvas-grid">
            {CANVAS_OPTIONS.map(opt => (
              <button key={opt.id} className={`canvas-chip ${form.canvasId === opt.id ? 'selected' : ''}`} onClick={() => setForm({ ...form, canvasId: opt.id })}>
                <span className="canvas-label">{opt.label}</span>
                <span className="canvas-dims">{opt.width > 0 ? `${opt.width} × ${opt.height}` : 'Custom'}</span>
              </button>
            ))}
          </div>
          {form.canvasId === 'custom' && <div className="custom-size-inputs">
            <label>Width (px) <input type="number" value={form.customWidth} onChange={(e) => setForm({ ...form, customWidth: Number(e.target.value) })} min={100} max={10000} /></label>
            <label>Height (px) <input type="number" value={form.customHeight} onChange={(e) => setForm({ ...form, customHeight: Number(e.target.value) })} min={100} max={10000} /></label>
          </div>}
        </div>
        <div className="step-footer">
          <button onClick={() => setStep('select-type')}>Back</button>
          <button className="primary" onClick={() => {
            if (form.createMode === 'blank-canvas') {
              window.posterApi.assistantOpen();
            } else if (form.createMode === 'use-psd') {
              setPage('Edit Existing PSD');
            } else if (form.createMode === 'recreate-reference') {
              setPage('Recreate Reference');
            } else {
              setStep('content');
            }
          }}>Continue</button>
        </div>
      </div>
    </section>;
  };

  const renderContentStep = () => {
    const cat = category;
    if (!cat) return null;
    return <section className="page-scroll">
      <div className="workflow-card">
        <div className="section-heading">
          <div><span className="eyebrow">STEP 3</span><h2>Poster Content</h2><p>{cat.icon} {cat.name} — Fill in the details for your poster.</p></div>
          <div className="category-badge">{cat.icon} {cat.name}</div>
        </div>
        {profileSummary}
        <div className="form-dynamic">
          {cat.fields.filter(f => f.key !== 'prayerPhotos' && f.key !== 'birthdayPhotos' && f.key !== 'achievementPhotos').map(f => renderField(f))}
          {form.category === 'daily-prayer' && (
            <div className="programme-section">
              <h3>Programme Order</h3>
              <ProgrammeRows items={form.programmeItems} setItems={(items) => setForm({ ...form, programmeItems: items })} />
            </div>
          )}
          {form.category === 'custom' && (
            <div className="custom-description">
              <h3>Describe the poster you need</h3>
              <textarea
                value={form.userDescription}
                onChange={(e) => { setForm({ ...form, userDescription: e.target.value }); setShowInferred(true); }}
                placeholder="Describe the poster you need. The system will infer the category and design.&#10;&#10;Example: &quot;Create a poster informing parents that the school will remain closed tomorrow due to heavy rain and will reopen on Wednesday.&quot;"
                rows={5}
                className="description-input"
              />
              {showInferred && renderCustomInference()}
            </div>
          )}
        </div>
        <div className="step-footer">
          <button onClick={() => setStep('select-mode')}>Back</button>
          <button className="primary" onClick={() => setStep('assets')}>Continue to Photos & Branding</button>
        </div>
      </div>
    </section>;
  };

  const renderAssetsStep = () => {
    const cat = category;
    return <section className="page-scroll">
      <div className="workflow-card">
        <div className="section-heading"><div><span className="eyebrow">STEP 4</span><h2>Photos & Branding</h2><p>Upload photos and configure branding for your {cat?.name || 'poster'}.</p></div></div>
        {profile && <div className="asset-grid">
          {cat?.assetRoles?.includes('mainLogo') && <ProfileAsset profileId={profile.id} assetKey="mainLogo" asset={profile.assets.mainLogo} emptyText="No main school logo selected" reload={reloadProfiles} />}
          {cat?.assetRoles?.includes('leadLogo') && <ProfileAsset profileId={profile.id} assetKey="leadLogo" asset={profile.assets.leadLogo} emptyText="No LEAD logo selected" reload={reloadProfiles} />}
          {cat?.assetRoles?.includes('chairmanPhoto') && <ProfileAsset profileId={profile.id} assetKey="chairmanPhoto" asset={profile.assets.chairmanPhoto} emptyText="No chairman photo selected" reload={reloadProfiles} />}
          {cat?.assetRoles?.includes('principalPhoto') && <ProfileAsset profileId={profile.id} assetKey="principalPhoto" asset={profile.assets.principalPhoto} emptyText="No principal photo selected" reload={reloadProfiles} />}
          {cat?.assetRoles?.includes('studentPhoto') && <ProfileAsset profileId={profile.id} assetKey="studentPhoto" asset={profile.assets.studentPhoto} emptyText="No student hero photo selected" reload={reloadProfiles} />}
          {cat?.assetRoles?.includes('campusPhoto') && <ProfileAsset profileId={profile.id} assetKey="campusPhoto" asset={profile.assets.campusPhoto} emptyText="No campus photo selected" reload={reloadProfiles} />}
          {cat?.assetRoles?.includes('defaultBackground') && <ProfileAsset profileId={profile.id} assetKey="defaultBackground" asset={profile.assets.defaultBackground} emptyText="No optional background image selected" reload={reloadProfiles} />}
        </div>}
        <div className="management-toggles">
          <label><input type="checkbox" checked={formToggles.showSchoolLogo} onChange={(e) => setFormToggles({ ...formToggles, showSchoolLogo: e.target.checked })} /> Show school logo</label>
          <label><input type="checkbox" checked={formToggles.showChairman} onChange={(e) => setFormToggles({ ...formToggles, showChairman: e.target.checked })} /> Show chairman {profile?.management.chairman.name ? `(${profile.management.chairman.name})` : ''}</label>
          <label><input type="checkbox" checked={formToggles.showPrincipal} onChange={(e) => setFormToggles({ ...formToggles, showPrincipal: e.target.checked })} /> Show principal {profile?.management.principal.name ? `(${profile.management.principal.name})` : ''}</label>
          <label><input type="checkbox" checked={formToggles.showContact} onChange={(e) => setFormToggles({ ...formToggles, showContact: e.target.checked })} /> Show contact number ({profile?.phone1 || ''})</label>
          <label><input type="checkbox" checked={formToggles.showAddress} onChange={(e) => setFormToggles({ ...formToggles, showAddress: e.target.checked })} /> Show address</label>
          <label><input type="checkbox" checked={formToggles.showLead} onChange={(e) => setFormToggles({ ...formToggles, showLead: e.target.checked })} /> Show LEAD branding</label>
        </div>
        <PhotoAssets title="Poster photos" emptyText="No photos selected" photos={form.photos} setPhotos={(photos) => setForm({ ...form, photos })} max={16} />
        <div className="step-footer">
          <button onClick={() => setStep('content')}>Back</button>
          <button className="primary" onClick={() => setStep('review')}>Review & Generate</button>
        </div>
      </div>
    </section>;
  };

  const renderReviewStep = () => {
    const dims = getCanvasDims();
    const cat = category;
    return <section className="page-scroll">
      <div className="workflow-card review-card">
        <div className="section-heading"><div><span className="eyebrow">STEP 5</span><h2>Review & Generate</h2><p>Check the preview, then create the editable Photoshop document and exports.</p></div></div>
        <dl className="output-summary">
          <div><dt>Poster type</dt><dd>{cat?.icon} {cat?.name}</dd></div>
          <div><dt>Canvas size</dt><dd>{dims.w} × {dims.h} px</dd></div>
          <div><dt>Photos</dt><dd>{form.photos.length} selected</dd></div>
          <div><dt>Output</dt><dd>Editable PSD + PNG + JPG</dd></div>
        </dl>
        {issues.length > 0 && <div className="error-card"><b>Fix before generating</b>{issues.map((issue, index) => <span key={index}>{issue.message}</span>)}</div>}
        <ProgressBar stage={busy ? stage : null} />
        {status && <div className={/successfully|completed/i.test(status) ? 'status success' : /error|failed|PHOTOSHOP|PS_COM|VBS/i.test(status) ? 'status error' : 'status'}>{status}</div>}
        <Results result={result} outputFolder={outputFolder} regenerate={generate} />
        <div className="step-footer">
          <button onClick={() => setStep('assets')}>Back to Photos</button>
          <button className="primary generate" disabled={busy || !profile} onClick={generate}>{busy ? 'Generating in Photoshop…' : 'Generate in Photoshop'}</button>
        </div>
      </div>
    </section>;
  };

  const renderCreatePoster = () => {
    if (step === 'select-type') return renderSelectType();
    if (step === 'select-mode') return renderSelectMode();
    if (step === 'content') return <div className="poster-workspace"><div className="workflow-panel">{renderContentStep()}</div><PreviewPanel plan={null} result={result} zoom={zoom} setZoom={setZoom} fullscreen={fullscreen} setFullscreen={setFullscreen} categoryName={category?.name} /></div>;
    if (step === 'assets') return <div className="poster-workspace"><div className="workflow-panel">{renderAssetsStep()}</div><PreviewPanel plan={null} result={result} zoom={zoom} setZoom={setZoom} fullscreen={fullscreen} setFullscreen={setFullscreen} categoryName={category?.name} /></div>;
    if (step === 'review') return <div className="poster-workspace"><div className="workflow-panel">{renderReviewStep()}</div><PreviewPanel plan={form.category === 'daily-prayer' ? previewPlan : null} result={result} zoom={zoom} setZoom={setZoom} fullscreen={fullscreen} setFullscreen={setFullscreen} categoryName={category?.name} /></div>;
    return null;
  };

  const renderDashboard = () => <section className="dashboard">
    <div className="hero">
      <span className="eyebrow">SNHS SMART POSTER AGENT</span>
      <h2>Create professional school posters as editable Photoshop PSD files.</h2>
      <p>Generate, recreate, and edit posters for admissions, prayer, birthdays, achievements, notices, recruitment, festivals, sports, and more.</p>
      <div className="hero-actions">
        <button className="primary large" onClick={() => { setPage('Create Poster'); resetForm(); }}>Create New Poster</button>
        <button className="secondary" onClick={() => { setPage('Create Poster'); setForm({ ...initFormData(), createMode: 'recreate-reference' }); setStep('select-type'); }}>Recreate Reference Poster</button>
        <button className="secondary" onClick={() => setPage('Edit Existing PSD')}>Edit Existing PSD</button>
        <button className="secondary" onClick={() => setPage('Recent Edits')}>Browse Recent Edits</button>
        <button className="secondary" onClick={() => setPage('Brand Assets')}>Manage Brand Assets</button>
      </div>
    </div>
    <div className="dashboard-quick-categories">
      <h3>Popular Poster Types</h3>
      <div className="popular-grid large">
        {POPULAR_CATEGORIES.map(id => {
          const cat = POSTER_CATEGORIES[id];
          return <button key={id} className="popular-chip large" onClick={() => { setPage('Create Poster'); startCreatePoster(id); }}>
            <span className="chip-icon">{cat.icon}</span>
            <span className="chip-label">{cat.name}</span>
            <span className="chip-desc">{cat.description}</span>
          </button>;
        })}
      </div>
    </div>
    <RecentEdits selectedSchoolId={selectedId} onEdit={(job) => { setPage('Recent Edits'); }} onCreateNew={() => { setPage('Create Poster'); resetForm(); }} />
  </section>;

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><img src="app-icon.png" alt="SNHS" /><div><b>SNHS</b><span>SMART POSTER AGENT</span></div></div>
      <nav>{PAGES.map((item) => <button key={item} className={page === item ? 'active' : ''} onClick={() => { setPage(item); if (item !== 'Create Poster') resetForm(); }}>{item}</button>)}</nav>
      <div className="category-shortcuts">
        <span className="shortcuts-label">Quick Create</span>
        {CATEGORY_SHORTCUTS.map(s => (
          <button key={s.id} className="shortcut-chip" onClick={() => { setPage('Create Poster'); startCreatePoster(s.id); }} title={s.label}>
            <span>{s.icon}</span>
            <span>{s.label}</span>
          </button>
        ))}
      </div>
      <div className="school-chip"><b>{profile?.name || 'No school selected'}</b><span>{profile ? formatAddress(profile) : ''}</span></div>
    </aside>
    <main className="main-shell">
      <header className="topbar">
        <div><h1>{page === 'Create Poster' ? `${category?.icon || ''} ${category?.name || 'Create Poster'}` : page}</h1>
          <p>{
            page === 'Dashboard' ? 'Create professional school posters as editable Photoshop PSD files.' :
            page === 'Create Poster' ? (category?.description || 'Select a poster type and fill in the details.') :
            page === 'Recreate Reference' ? 'Upload a reference poster to analyse and rebuild with your branding.' :
            page === 'Edit Existing PSD' ? 'Analyse and edit any open Photoshop document.' :
            page === 'Recent Edits' ? 'Browse and continue working on your recent posters.' :
            page === 'Brand Assets' ? 'Manage school profiles, logos, and brand assets.' :
            page === 'Settings' ? 'Configure storage and application settings.' : ''
          }</p>
        </div>
        {profile && <label className="school-select"><span>School</span><select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>{profiles.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
      </header>
      {page === 'Dashboard' && renderDashboard()}
      {page === 'Create Poster' && (step === 'select-type' ? renderSelectType() : step === 'select-mode' ? renderSelectMode() : renderCreatePoster())}
      {page === 'Recreate Reference' && <section className="page-scroll"><div className="workflow-card"><h2>Recreate Reference Poster</h2><p>Upload a reference poster image. The system will analyse its layout and rebuild it with your school's branding and content.</p><div className="button-row"><button className="primary" onClick={async () => { const r = await window.posterApi.importReference(); if (r && !r.canceled) setStatus('Reference imported. Analysing layout...'); }}>Import Reference Poster</button></div>{status && <div className="status">{status}</div>}</div></section>}
      {page === 'Edit Existing PSD' && <section className="page-scroll"><div className="workflow-card"><h2>Analyse Current PSD</h2><p>Open a PSD in Photoshop, then inspect its layer hierarchy and proposed content roles without changing the original document.</p><div className="button-row"><button className="primary" disabled={busy} onClick={analyze}>{busy ? 'Analysing…' : 'Analyse Current PSD'}</button><button onClick={() => window.posterApi.assistantOpen()}>Open Design Assistant</button></div>{analysis && <PsdAnalysisPanel analysis={analysis} />}{status && <div className="status">{status}</div>}</div></section>}
      {page === 'Recent Edits' && <div className="page-scroll"><RecentEdits selectedSchoolId={selectedId} onEdit={(job) => {}} onCreateNew={() => { setPage('Create Poster'); resetForm(); }} /></div>}
      {page === 'Brand Assets' && <section className="page-scroll"><SchoolProfiles profiles={profiles} reload={reloadProfiles} selectedId={selectedId} onSelect={setSelectedId} /></section>}
      {page === 'Settings' && <SettingsPage base={base} />}
    </main>
  </div>;
}

createRoot(document.getElementById('root')!).render(<App />);
