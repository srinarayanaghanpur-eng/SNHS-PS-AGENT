import type { AssetRecord, EventMode, ExportFormat, GenerationResult, PosterData, SemanticRole, TemplateManifest, OnlineAssetRequirement, OnlineAssetResult, AssetRole } from '../../types';
import type { PlannedOnlineAsset } from '../../generate/brandingPlan';
import { fieldsForManifest } from '../../core/dynamicForm';
import { getLogs, clearLogs } from '../../utils/logger';
import { scoutAsset, determineAssetRequirements, downloadAndCacheAsset, buildOnlineLayerName } from '../../assets/onlineAssetScout';
import { checkAssetQuality } from '../../assets/assetQuality';
import { setOnlineAssets } from '../App';
import { loadProfile } from '../../profile/schoolProfile';
import { log } from '../../utils/logger';
import { useState, useEffect } from 'react';

export const Dashboard = ({ go, analyze }: { go: (s: string) => void; analyze: () => void }) => (
  <section>
    <h2>Smart Poster Workspace</h2>
    <p className="lead">Open any PSD. The agent understands its layers and builds the form automatically.</p>
    <div className="hero-actions">
      <button className="primary" onClick={analyze}>Analyze Current PSD</button>
      <button onClick={() => go('details')}>Create Poster</button>
      <button onClick={() => go('templates')}>Open Saved Template</button>
      <button onClick={() => go('assets')}>Manage Assets</button>
      <button onClick={() => go('settings')}>Settings</button>
    </div>
    <div className="card">
      <b>Non-destructive by design</b>
      <p>The original PSD is never edited. Generation always starts from a duplicate.</p>
    </div>
  </section>
);

export function Analyze({ manifest, onAnalyze, go }: { manifest?: TemplateManifest; onAnalyze: () => void; go: (s: string) => void }) {
  return (
    <section>
      <h2>Analyze Template</h2>
      <p>Recursively scans visible, hidden, locked, nested, masked, clipped, text, pixel, shape, adjustment, and Smart Object layers.</p>
      <button className="primary" onClick={onAnalyze}>Analyze Current PSD</button>
      {manifest && (
        <div className="card stats">
          <span><b>{manifest.layers.length}</b> layers</span>
          <span><b>{manifest.reviewLayerIds.length}</b> need review</span>
          <span><b>{manifest.fingerprint}</b> fingerprint</span>
          <button onClick={() => go(manifest.reviewLayerIds.length ? 'review' : 'details')}>Continue</button>
        </div>
      )}
    </section>
  );
}

export function Review({ manifest, setManifest, save, go }: { manifest: TemplateManifest; setManifest: (m: TemplateManifest) => void; save: () => void; go: (s: string) => void }) {
  const uncertain = manifest.layers.filter(l => manifest.reviewLayerIds.includes(l.layerId));
  const roles: SemanticRole[] = ['school_logo', 'school_name', 'poster_title', 'event_name', 'event_date', 'event_description', 'student_name', 'student_class', 'student_photo', 'birthday_photo', 'birthday_name', 'achievement_photo', 'achievement_name', 'teacher_photo', 'chairman_photo', 'principal_photo', 'background', 'decorative_element', 'footer', 'powered_by_lead', 'event_image', 'optional_section', 'repeated_student_card', 'unknown'];
  const update = (id: number, role: SemanticRole) => setManifest({ ...manifest, layers: manifest.layers.map(l => l.layerId === id ? { ...l, semanticRole: role, confidence: 100, conflict: false } : l), reviewLayerIds: manifest.reviewLayerIds.filter(x => x !== id) });
  return (
    <section>
      <h2>Review Uncertain Layers</h2>
      <p>Only low-confidence or conflicting matches appear here.</p>
      <button onClick={() => setManifest({ ...manifest, reviewLayerIds: [] })}>Accept All High-Confidence Matches</button>
      {uncertain.map(l => (
        <div className="review" key={l.layerId}>
          <div><b>{l.path}</b><small>{l.type} · confidence {l.confidence}%</small></div>
          <select value={l.semanticRole} onChange={e => update(l.layerId, e.target.value as SemanticRole)}>{roles.map(r => <option key={r}>{r}</option>)}</select>
          <button onClick={() => update(l.layerId, 'decorative_element')}>Ignore Decorative Layer</button>
          <button onClick={() => update(l.layerId, 'repeated_student_card')}>Mark as Repeated Card</button>
        </div>
      ))}
      <div className="row"><button className="primary" onClick={() => { save(); go('details'); }}>Save Template</button></div>
    </section>
  );
}

export function Details({ manifest, data, setData, pickFile, go }: { manifest: TemplateManifest; data: PosterData; setData: (d: PosterData) => void; pickFile: (role: string) => void; go: (s: string) => void }) {
  const fields = fieldsForManifest(manifest);
  const modes: EventMode[] = ['prayer', 'birthday', 'achievement', 'dance', 'karate', 'sports', 'examination', 'holiday', 'festival', 'admissions', 'notice', 'teacher', 'special', 'custom'];
  const setValue = (role: string, value: string) => setData({ ...data, values: { ...data.values, [role]: value } });
  return (
    <section>
      <h2>Poster Details</h2>
      <label>Event mode
        <select value={data.mode} onChange={e => setData({ ...data, mode: e.target.value as EventMode })}>
          {modes.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </label>
      <div className="form-grid">
        {fields.filter(f => !f.repeatable).map(f => (
          <label key={f.role}>{f.label}
            {f.kind === 'image'
              ? <button onClick={() => pickFile(f.role)}>{data.files[f.role]?.name ?? 'Choose image…'}</button>
              : f.kind === 'textarea'
                ? <textarea value={data.values[f.role] ?? ''} onChange={e => setValue(f.role, e.target.value)} />
                : <input type={f.kind === 'date' ? 'date' : 'text'} value={data.values[f.role] ?? ''} onChange={e => setValue(f.role, e.target.value)} />
            }
          </label>
        ))}
      </div>
      <button className="primary" onClick={() => go('students')}>Student &amp; Image Manager</button>
    </section>
  );
}

export function Students({ data, setData, pickStudent, go }: { data: PosterData; setData: (d: PosterData) => void; pickStudent: (i: number) => void; go: (s: string) => void }) {
  const add = () => setData({ ...data, students: [...data.students, { name: '', className: '' }] });
  const update = (i: number, k: 'name' | 'className', v: string) => setData({ ...data, students: data.students.map((s, n) => n === i ? { ...s, [k]: v } : s) });
  return (
    <section>
      <h2>Student & Image Manager</h2>
      {data.students.map((s, i) => (
        <div className="student" key={i}>
          <b>Student {i + 1}</b>
          <input placeholder="Student name" value={s.name} onChange={e => update(i, 'name', e.target.value)} />
          <input placeholder="Class" value={s.className} onChange={e => update(i, 'className', e.target.value)} />
          <button onClick={() => pickStudent(i)}>{s.photo?.name ?? 'Choose photo'}</button>
          <button className="danger" onClick={() => setData({ ...data, students: data.students.filter((_, n) => n !== i) })}>Remove</button>
        </div>
      ))}
      <div className="row">
        <button onClick={add}>Add Student</button>
        <button className="primary" onClick={() => go('preview')}>Preview & Quality Check</button>
      </div>
    </section>
  );
}

export function Assets({ assets, choose }: { assets: AssetRecord[]; choose: () => void }) {
  return (
    <section>
      <h2>Asset Library</h2>
      <p>Select one local library folder; subfolders become categories and are indexed automatically.</p>
      <button className="primary" onClick={choose}>{assets.length ? 'Rescan / Change Folder' : 'Select Asset Library Folder'}</button>
      <div className="asset-grid">
        {assets.map(a => (
          <div className="asset" key={a.id}>
            <b>{a.name}</b>
            <small>{a.category} · {a.extension.toUpperCase()}</small>
            {a.license && <small>{a.license}</small>}
          </div>
        ))}
      </div>
    </section>
  );
}

function OnlineAssetPanel({ manifest, data }: { manifest: TemplateManifest; data: PosterData }) {
  const [reqs, setReqs] = useState<OnlineAssetRequirement[]>([]);
  const [searchResults, setSearchResults] = useState<Record<string, OnlineAssetResult[]>>({});
  const [searching, setSearching] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<Record<string, OnlineAssetResult>>({});
  const [plannedAssets, setPlannedAssets] = useState<PlannedOnlineAsset[]>([]);
  const W = manifest.documentWidth, H = manifest.documentHeight;

  useEffect(() => {
    const existingRoles: AssetRole[] = [];
    for (const l of manifest.layers) {
      if (l.semanticRole === 'background') existingRoles.push('heroBackground');
      if (l.semanticRole === 'decorative_element') existingRoles.push('decorativeOverlay');
    }
    const r = determineAssetRequirements(data.mode, W, H, existingRoles);
    setReqs(r);
  }, [data.mode, manifest]);

  const doSearch = async (req: OnlineAssetRequirement) => {
    setSearching(s => ({ ...s, [req.role]: true }));
    try {
      const profile = await loadProfile();
      const { results } = await scoutAsset(req, data.mode, profile, W, H, { maxResults: 8 });
      setSearchResults(s => ({ ...s, [req.role]: results }));
      if (results.length > 0) setSelected(s => ({ ...s, [req.role]: results[0] }));
    } catch (err) {
      log('error', 'OnlineAssetPanel', `Search failed: ${err}`);
    } finally {
      setSearching(s => ({ ...s, [req.role]: false }));
    }
  };

  const doSelect = (req: OnlineAssetRequirement, asset: OnlineAssetResult) => {
    setSelected(s => ({ ...s, [req.role]: asset }));
  };

  const doUseSelected = async (req: OnlineAssetRequirement) => {
    const asset = selected[req.role];
    if (!asset) return;
    const localPath = await downloadAndCacheAsset(asset, req.role);
    if (!localPath) return;
    const planned: PlannedOnlineAsset = {
      role: req.role,
      group: req.role === 'heroBackground' ? '01_ONLINE_BACKGROUND' :
        req.role === 'lightEffect' || req.role === 'confetti' || req.role === 'decorativeOverlay' ? '03_ONLINE_OVERLAYS' :
        req.role === 'academicIcon' || req.role === 'scheduleIcons' ? '08_ONLINE_ICONS' : '04_ONLINE_DECORATIONS',
      name: buildOnlineLayerName(req.role, asset.tags.slice(0, 3).join('_') || req.role),
      localPath,
      sourceUrl: asset.sourceUrl,
      box: { left: Math.round(W * 0.05), top: Math.round(H * 0.05), width: Math.round(W * 0.9), height: Math.round(H * 0.9) },
      opacity: req.role === 'heroBackground' ? 1 : req.role === 'lightEffect' ? 0.4 : req.role === 'confetti' ? 0.8 : 0.7,
      blendMode: req.role === 'lightEffect' ? 'screen' : req.role === 'confetti' ? 'normal' : 'overlay',
      licence: asset.licence
    };
    const updated = [...plannedAssets.filter(p => p.role !== req.role), planned];
    setPlannedAssets(updated);
    setOnlineAssets(updated);
  };

  const doSkip = (req: OnlineAssetRequirement) => {
    setSelected(s => ({ ...s, [req.role + '__skip']: '' as any }));
  };

  const roleLabels: Record<string, string> = {
    heroBackground: 'Hero Background', decorativeOverlay: 'Decorative Overlay',
    lightEffect: 'Light Effect', confetti: 'Confetti', academicIcon: 'Academic Icon',
    texture: 'Texture', cornerDecoration: 'Corner Decoration', festivalIllustration: 'Festival Illustration',
    frame: 'Frame', sectionDivider: 'Section Divider', scheduleIcons: 'Schedule Icons',
    patternBackground: 'Pattern Background', floralDecoration: 'Floral Decoration',
    abstractShape: 'Abstract Shape', transparentOverlay: 'Transparent Overlay'
  };

  if (reqs.length === 0) return null;

  return (
    <div className="online-assets">
      <h3>Online Design Assets</h3>
      <p className="note">Search for supporting design assets from the internet.</p>
      {reqs.map(req => {
        const isSearched = searchResults[req.role] !== undefined;
        const isSearching = searching[req.role];
        const sel = selected[req.role];
        const skip = selected[req.role + '__skip'];
        const isUsed = plannedAssets.some(p => p.role === req.role);
        return (
          <div className="asset-req card" key={req.role}>
            <div className="req-header"><b>{roleLabels[req.role] || req.role}</b><small>{req.searchQuery}</small></div>
            {!isSearched && !isSearching && <button onClick={() => doSearch(req)} disabled={isSearching}>Search Online</button>}
            {isSearching && <span>Searching...</span>}
            {isSearched && !isSearching && (
              <div className="search-results">
                <div className="thumbnails">
                  {(searchResults[req.role] || []).slice(0, 8).map(asset => {
                    const qc = checkAssetQuality(asset);
                    return (
                      <div key={asset.id}
                        className={'thumb' + (sel?.id === asset.id ? ' selected' : '') + (qc.passed ? '' : ' rejected')}
                        onClick={() => doSelect(req, asset)}
                        title={`${asset.width}x${asset.height} | ${asset.licence} | Score: ${qc.score}`}>
                        <img src={asset.thumbnailUrl} alt={asset.id} loading="lazy" />
                        <span className="thumb-info">{asset.width}x{asset.height}</span>
                      </div>
                    );
                  })}
                </div>
                {sel && !skip && (
                  <div className="row">
                    <button className="primary" onClick={() => doUseSelected(req)} disabled={isUsed}>
                      {isUsed ? 'Added ✓' : 'Use This Asset'}
                    </button>
                    <button onClick={() => doSearch(req)}>Search Again</button>
                    <button onClick={() => doSkip(req)}>Skip</button>
                  </div>
                )}
                {skip && <span>Skipped</span>}
              </div>
            )}
          </div>
        );
      })}
      {plannedAssets.length > 0 && (
        <div className="card planned-summary">
          <b>{plannedAssets.length} online asset(s) selected</b>
          <div>{plannedAssets.map(p => <div key={p.role}>{p.name} → {p.group}</div>)}</div>
        </div>
      )}
    </div>
  );
}

export function Preview({ manifest, data, setData, result, chooseExport, generate, go }: { manifest: TemplateManifest; data: PosterData; setData: (d: PosterData) => void; result?: GenerationResult; chooseExport: () => void; generate: () => void; go: (s: string) => void }) {
  const formats: ExportFormat[] = ['png', 'jpeg', 'psd', 'square', 'portrait', 'display', 'a4'];
  const toggle = (f: ExportFormat) => setData({ ...data, exportFormats: data.exportFormats.includes(f) ? data.exportFormats.filter(v => v !== f) : [...data.exportFormats, f] });
  const lv = result?.layoutValidation;
  const blocked = lv !== undefined && (lv.criticalIssueCount > 0 || !lv.valid);
  const qLabel = lv ? lv.score >= 90 ? 'Excellent' : lv.score >= 75 ? 'Good' : lv.score >= 50 ? 'Needs Review' : 'Invalid' : 'Not generated';
  const qClass = qLabel.toLowerCase().replace(' ', '-');
  return (
    <section>
      <h2>Preview &amp; Quality Check</h2>
      <div className="card">
        <b>{manifest.templateName}</b>
        <p>{manifest.layers.filter(l => l.confidence >= 65).length} mapped placeholders · {data.students.length} students</p>
      </div>
      <OnlineAssetPanel manifest={manifest} data={data} />
      <h3>Quality Status</h3>
      <div className={'quality q-' + qClass}>
        {lv ? (<><div className="quality-score">{lv.score}/100</div><div className="quality-label">{qLabel}</div><div>{lv.issues.length} issue(s), {lv.criticalIssueCount} critical</div><div>{lv.fixesApplied.length} auto-fix(es) applied</div></>) : <p>Not yet generated. Fill in poster details and click Generate.</p>}
      </div>
      {lv && lv.issues.length > 0 && (<><h3>Issues</h3>{lv.issues.map((x, i) => <div className={'issue-' + x.severity} key={i}><b>[{x.severity.toUpperCase()}]</b> {x.message}</div>)}</>)}
      {lv && lv.fixesApplied.length > 0 && (<><h3>Auto Fixes Applied</h3>{lv.fixesApplied.map((f, i) => <div className="fix-applied" key={i}>&#10003; {f.description}</div>)}</>)}
      <h3>Export options</h3>
      <div className="checks">{formats.map(f => <label key={f}><input type="checkbox" checked={data.exportFormats.includes(f)} onChange={() => toggle(f)} />{f}</label>)}</div>
      <button onClick={chooseExport}>{data.exportFolder ?? 'Choose Export Folder'}</button>
      {blocked && <div className="export-blocked">Export blocked: {lv!.criticalIssueCount} critical layout issue(s) remain. Use Auto Fix or fix manually in Photoshop.</div>}
      <button className="primary" disabled={blocked} onClick={generate}>Generate &amp; Export</button>
      <button onClick={() => go('generate')}>Generation Details</button>
    </section>
  );
}

export function Generate({ result }: { result?: GenerationResult }) {
  return (
    <section>
      <h2>Generate & Export</h2>
      {result ? (
        <>
          <div className={'notice ' + (result.exports.length ? 'success' : 'error')}>{result.exports.length ? 'Completed: ' + result.documentName : 'Export blocked - layout issues remain'}</div>
          {result.layoutValidation && (
            <div className="card">
              <b>Layout Validation: {result.quality.label} ({result.quality.score}/100)</b>
              <p>Critical issues: {result.layoutValidation.criticalIssueCount}</p>
              <p>{result.layoutValidation.fixesApplied.length} auto-fix(es) applied</p>
              <p>{result.layoutValidation.issues.length} remaining issue(s)</p>
            </div>
          )}
          <h3>Quality Issues</h3>
          {result.quality.issues.length ? result.quality.issues.map((x, i) => <div className={'issue-' + x.severity} key={i}><b>[{x.severity.toUpperCase()}]</b> {x.message}</div>) : <p>No quality issues.</p>}
          <h3>Exports</h3>
          {result.exports.length ? result.exports.map(x => <div className="file" key={x}>{x}</div>) : <p>No files exported (layout was invalid).</p>}
          <h3>Warnings</h3>
          {result.warnings.length ? result.warnings.map((w, i) => <div className="notice" key={i}><b>{w.operation}</b><p>{w.message}</p><small>{w.solution}</small></div>) : <p>No operation warnings.</p>}
        </>
      ) : <p>Complete Poster Details and Preview first.</p>}
    </section>
  );
}

export function Templates({ items, open, remove }: { items: TemplateManifest[]; open: (m: TemplateManifest) => void; remove: (id: string) => void }) {
  return (
    <section>
      <h2>Template Manager</h2>
      {items.map(m => (
        <div className="template" key={m.templateId}>
          <div><b>{m.templateName}</b><small>{m.documentWidth}×{m.documentHeight} · {m.layers.length} layers</small></div>
          <button onClick={() => open(m)}>Open</button>
          <button className="danger" onClick={() => remove(m.templateId)}>Delete</button>
        </div>
      ))}
    </section>
  );
}

export const Settings = ({ tag, manifest }: { tag: () => void; manifest?: TemplateManifest }) => (
  <section>
    <h2>Settings</h2>
    <div className="card">
      <b>Safe semantic tags</b>
      <p>Append tags such as [SNHS:student_photo] while preserving every original layer name.</p>
      <button disabled={!manifest || manifest.tagged} onClick={tag}>{manifest?.tagged ? 'Already tagged' : 'Tag Current Template'}</button>
    </div>
    <div className="card">
      <b>Automation limits</b>
      <p>Complex perspective warps, arbitrary face-aware cropping, and fully adaptive redesign across radically different aspect ratios require manual visual review.</p>
    </div>
  </section>
);

export const Logs = () => {
  const logs = getLogs();
  return (
    <section>
      <h2>Error Logs</h2>
      <button onClick={() => { clearLogs(); location.reload(); }}>Clear</button>
      {logs.map((l, i) => (
        <div className={'log ' + l.level} key={i}>
          <small>{l.at}</small>
          <b>{l.operation}</b>
          <span>{l.message}</span>
        </div>
      ))}
    </section>
  );
};
