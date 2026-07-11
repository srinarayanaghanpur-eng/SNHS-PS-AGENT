import type { ExportFormat, ModelRecord, ProfileMediaRole, ReferenceProject, SchoolProfile } from '../../types';

export const REF_FORMATS: ExportFormat[] = ['psd', 'png', 'jpeg', 'pdf', 'square', 'portrait', 'display', 'a4'];

const MEDIA_ROLES: { role: ProfileMediaRole; label: string }[] = [
  { role: 'logo', label: 'School Logo' }, { role: 'campus', label: 'Campus Photos' },
  { role: 'students', label: 'Student Photos' }, { role: 'staff', label: 'Staff Photos' },
  { role: 'uniform', label: 'Uniform Reference' }, { role: 'chairman', label: 'Chairman Photo' },
  { role: 'principal', label: 'Principal Photo' }
];

export function Profile({ profile, setProfile, save, addMedia, removeMedia }: {
  profile: SchoolProfile; setProfile: (p: SchoolProfile) => void; save: () => void;
  addMedia: (role: ProfileMediaRole) => void; removeMedia: (role: ProfileMediaRole, name: string) => void;
}) {
  const set = (k: keyof SchoolProfile, v: string) => setProfile({ ...profile, [k]: v });
  const setList = (k: 'altPhones' | 'brandColors' | 'preferredFonts' | 'preferredLanguages', v: string) =>
    setProfile({ ...profile, [k]: v.split(',').map(s => s.trim()).filter(Boolean) });
  const text = (label: string, k: keyof SchoolProfile) =>
    <label key={k}>{label}<input value={String(profile[k] ?? '')} onChange={e => set(k, e.target.value)} /></label>;
  return <section><h2>School Profile</h2>
    <p className="lead">Configured once, applied to every generated poster.</p>
    <div className="form-grid">
      {text('School name', 'schoolName')}{text('Short name', 'shortName')}{text('Address / location', 'location')}
      {text('Phone', 'phone')}{text('Email', 'email')}{text('Website', 'website')}
      {text('Academic year', 'academicYear')}{text('Group name', 'groupName')}{text('Branch name', 'branchName')}
      {text('Curriculum branding', 'curriculum')}{text('Footer style', 'footerStyle')}
      <label>Alternate phones (comma-separated)<input value={profile.altPhones.join(', ')} onChange={e => setList('altPhones', e.target.value)} /></label>
      <label>Brand colours (hex, comma-separated)<input value={profile.brandColors.join(', ')} onChange={e => setList('brandColors', e.target.value)} /></label>
      <label>Preferred fonts (comma-separated)<input value={profile.preferredFonts.join(', ')} onChange={e => setList('preferredFonts', e.target.value)} /></label>
      <label>Languages (comma-separated)<input value={profile.preferredLanguages.join(', ')} onChange={e => setList('preferredLanguages', e.target.value)} /></label>
    </div>
    <h3>Brand media</h3>
    {MEDIA_ROLES.map(({ role, label }) => <div className="card" key={role}><b>{label}</b>
      {(profile.media[role] ?? []).map(name => <div className="file" key={name}>{name}
        <button className="danger" onClick={() => removeMedia(role, name)}>Remove</button></div>)}
      <button onClick={() => addMedia(role)}>Add image…</button>
    </div>)}
    <button className="primary" onClick={save}>Save Profile</button>
  </section>;
}

export function UploadPoster({ projects, upload, reopen, remove, analyze, generate, chooseExport, exportFolderName, lastResult, oneClick, formats, toggleFormat }: {
  projects: ReferenceProject[]; upload: (...args:any[])=>void;
  reopen: (...args:any[])=>void; remove: (...args:any[])=>void;
  analyze: (...args:any[])=>void; generate: (p: ReferenceProject) => void;
  chooseExport: () => void; exportFolderName?: string;
  lastResult?: { projectId: string; mode: string; overall: number; pass: boolean; exports: string[]; issues: { severity: string; message: string }[] };
  oneClick: () => void; formats: ExportFormat[]; toggleFormat: (f: ExportFormat) => void;
}) {
  return <section><h2>Reference Posters</h2>
    <p className="lead">Upload any school poster (JPG, JPEG, PNG, WEBP, or the first page of a PDF). A permanent copy is stored so the project can be reopened and re-analysed at any time.</p>
    <div className="row">
      <button className="primary" onClick={oneClick}>One-Click: Upload → Analyze → Generate</button>
    </div>
    <div className="row">
      <button onClick={upload}>Upload Only…</button>
      <button onClick={chooseExport}>{exportFolderName ?? 'Choose Export Folder…'}</button>
    </div>
    <div className="checks">{REF_FORMATS.map(f => <label key={f}><input type="checkbox" checked={formats.includes(f)} onChange={() => toggleFormat(f)} />{f}</label>)}</div>
    {projects.length === 0 && <p>No reference projects yet.</p>}
    {projects.map(p => <div className="template" key={p.projectId}><div>
      <b>{p.name}</b>
      <small>{p.reference.width}×{p.reference.height}px · {p.reference.ext.toUpperCase()} · {p.status} · mode: {p.mode}{p.overallConfidence ? ` · confidence ${p.overallConfidence}%` : ''}</small>
    </div>
      <button onClick={() => reopen(p)}>Open in Photoshop</button>
      <button className="primary" onClick={() => analyze(p)}>Analyze Text (OCR)</button>
      {(p.status === 'analyzed' || p.status === 'generated' || p.status === 'failed') &&
        <button className="primary" onClick={() => generate(p)}>Generate Poster</button>}
      <button className="danger" onClick={() => remove(p.projectId)}>Delete</button>
      {lastResult?.projectId === p.projectId && <div className={'notice ' + (lastResult.pass ? 'success' : 'error')}>
        <b>{lastResult.pass ? 'Generated' : 'Completed with issues'} · mode {lastResult.mode} · quality {lastResult.overall}/100</b>
        {lastResult.exports.map(e => <div className="file" key={e}>{e}</div>)}
        {lastResult.issues.map((x, i) => <div className={'issue-' + (x.severity === 'critical' ? 'error' : 'warning')} key={i}>{x.message}</div>)}
      </div>}
      {p.regions.filter(r => r.kind === 'text').length > 0 && <div className="card">
        <b>{p.regions.filter(r => r.kind === 'text').length} text regions · {p.regions.filter(r => r.replace).length} flagged for replacement</b>
        {p.regions.filter(r => r.kind === 'text').slice(0, 12).map(r =>
          <div className={r.replace ? 'issue-warning' : 'file'} key={r.id}>
            {r.replace ? '⟳ ' : '✓ '}{r.text}<small> · {r.semanticRole} · {r.confidence}%{r.language ? ` · ${r.language}` : ''}</small>
          </div>)}
      </div>}
    </div>)}
    <div className="card"><b>Analysis</b><p>Analyze Text runs local English + Telugu OCR (multiple preprocessing variants, whole-poster and per-region passes) and classifies which text must be replaced. Requires the models on the AI Models screen — nothing downloads during analysis.</p></div>
  </section>;
}

export function Models({ records, ready, download, importPack, remove, busyId }: {
  records: ModelRecord[]; ready: boolean;
  download: (r: ModelRecord) => void; importPack: () => void;
  remove: (r: ModelRecord) => void; busyId?: string;
}) {
  return <section><h2>AI Models</h2>
    <div className={'notice ' + (ready ? 'success' : 'error')}>
      {ready ? 'All required models installed. OCR can run fully offline.' : 'Required models missing — install by download or import an offline model pack (USB).'}
    </div>
    {records.map(r => <div className="template" key={r.descriptor.id}><div>
      <b>{r.descriptor.label}</b>
      <small>{r.descriptor.fileName} · {r.status}{r.bytes ? ` · ${(r.bytes / 1048576).toFixed(1)} MB` : ''}{r.sha256 ? ` · sha256 ${r.sha256.slice(0, 12)}…` : ''}</small>
      {r.error && <small className="issue-error">{r.error}</small>}
    </div>
      {r.status !== 'ready' && <button disabled={busyId === r.descriptor.id} onClick={() => download(r)}>{busyId === r.descriptor.id ? 'Downloading…' : 'Download'}</button>}
      {r.status === 'ready' && <button className="danger" onClick={() => remove(r)}>Delete</button>}
    </div>)}
    <div className="row">
      <button className="primary" onClick={importPack}>Import Offline Model Pack…</button>
    </div>
    <div className="card"><b>Offline pack</b><p>Copy the listed file names onto a USB drive, then import the folder here. Files are size- and SHA-256-verified; models are never downloaded silently during poster generation.</p></div>
  </section>;
}
