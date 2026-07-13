import { useEffect, useState } from 'react';
import type { AssetRecord, FileRef, GenerationResult, PosterData, TemplateManifest } from '../types';
import { analyzeCurrentPsd } from '../core/manifestBuilder';
import { deleteManifest, listManifests, saveManifest, updateManifest } from '../core/templateStorage';
import { tagLayers } from '../core/smartTagger';
import { chooseAssetFolder, loadAssets } from '../assets/assetLibrary';
import { generatePoster } from '../core/posterGenerator';
import { explainError } from '../utils/errors';
import { log } from '../utils/logger';
import { Progress } from './components/Progress';
import { Notice } from './components/Notice';
import { Analyze, Assets, Dashboard, Details, Generate, Logs, Preview, Review, Settings, Students, Templates } from './screens/Screens';
import { Models, Profile, UploadPoster } from './screens/Phase1Screens';
import type { ModelRecord, ProfileMediaRole, ReferenceProject, SchoolProfile } from '../types';
import { addProfileMedia, DEFAULT_PROFILE, loadProfile, removeProfileMedia, saveProfile } from '../profile/schoolProfile';
import { deleteProject, listProjects } from '../project/projectStore';
import { reopenReference, uploadReferencePoster } from '../ingest/posterUpload';
import { allRequiredReady, deleteModel, downloadModel, importOfflineModelPack, scanModels } from '../models/modelManager';
import { analyzeProjectText } from '../ocr/ocrPipeline';
import { generateFromReference } from '../generate/posterRebuilder';
import { uploadAnalyzeGenerate } from '../generate/oneClick';
import type { ExportFormat } from '../types';
import { selectFile, selectFolder } from '../bridge/apiClient';

const nav: [string, string][] = [
  ['dashboard', 'Dashboard'], ['upload', 'Reference Posters'], ['profile', 'School Profile'],
  ['models', 'AI Models'], ['analyze', 'Analyze Template'], ['review', 'Review Layers'],
  ['details', 'Poster Details'], ['students', 'Students & Images'], ['assets', 'Asset Library'],
  ['preview', 'Preview & Quality'], ['generate', 'Generate & Export'], ['templates', 'Templates'],
  ['settings', 'Settings'], ['logs', 'Error Logs']
];

const initial: PosterData = { mode: 'custom', values: {}, students: [], files: {}, exportFormats: ['png'] };

async function pickFile(): Promise<{ name: string; path: string } | null> {
  return selectFile('.png,.jpg,.jpeg,.webp');
}

async function pickFolderPath(): Promise<string | null> {
  const result = await selectFolder();
  return result;
}

export default function App() {
  const [screen, setScreen] = useState('dashboard');
  const [manifest, setManifest] = useState<TemplateManifest>();
  const [templates, setTemplates] = useState<TemplateManifest[]>([]);
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [data, setData] = useState<PosterData>(initial);
  const [progress, setProgress] = useState({ message: 'Ready', percent: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<GenerationResult>();
  const [profile, setProfile] = useState<SchoolProfile>({ ...DEFAULT_PROFILE });
  const [projects, setProjects] = useState<ReferenceProject[]>([]);
  const [models, setModels] = useState<ModelRecord[]>([]);
  const [busyModelId, setBusyModelId] = useState<string>();
  const [refExportFolder, setRefExportFolder] = useState<string>('');
  const [refFormats, setRefFormats] = useState<ExportFormat[]>(['psd', 'png', 'jpeg', 'pdf']);
  const [refResult, setRefResult] = useState<{ projectId: string; mode: string; overall: number; pass: boolean; exports: string[]; issues: { severity: string; message: string }[] }>();

  useEffect(() => {
    listManifests().then(setTemplates);
    loadAssets().then(setAssets);
    loadProfile().then(setProfile);
    listProjects().then(setProjects);
    scanModels().then(setModels);
  }, []);

  const run = async <T,>(op: string, fn: () => Promise<T>) => {
    setBusy(true); setError('');
    try { return await fn(); }
    catch (e) {
      const x = explainError(e, op);
      setError(`${x.message} ${x.solution}`);
      log('error', op, x.message);
    } finally { setBusy(false); }
  };

  const analyze = () => void run('Analyze PSD', async () => {
    const r = await analyzeCurrentPsd((message, percent) => setProgress({ message, percent }));
    setManifest(r.manifest);
    setTemplates(await listManifests());
    setScreen(r.manifest.reviewLayerIds.length ? 'review' : 'details');
  });

  const pick = async (role: string) => {
    const file = await pickFile();
    if (file) setData({ ...data, files: { ...data.files, [role]: { name: file.name, path: file.path } } });
  };

  const pickStudent = async (i: number) => {
    const file = await pickFile();
    if (file) setData({
      ...data,
      students: data.students.map((s, n) => n === i ? { ...s, photo: { name: file.name, path: file.path } } : s)
    });
  };

  const chooseExport = async () => {
    const folder = await pickFolderPath();
    if (folder) setData({ ...data, exportFolder: folder });
  };

  const generate = () => manifest && void run('Generate poster', async () => {
    const r = await generatePoster(manifest, data, (message, percent) => setProgress({ message, percent }));
    setResult(r);
    setScreen('generate');
  });

  const saveProf = () => void run('Save profile', async () => { setProfile(await saveProfile(profile)); });
  const addMedia = (role: ProfileMediaRole) => void run('Add profile media', async () => { setProfile(await addProfileMedia(profile, role)); });
  const removeMedia = (role: ProfileMediaRole, name: string) => void run('Remove profile media', async () => { setProfile(await removeProfileMedia(profile, role, name)); });
  const upload = () => void run('Upload reference poster', async () => { const p = await uploadReferencePoster(profile, (message, percent) => setProgress({ message, percent })); if (p) setProjects(await listProjects()); });
  const reopenProj = (p: ReferenceProject) => void run('Reopen reference', async () => { await reopenReference(p); setProjects(await listProjects()); });
  const analyzeProj = (p: ReferenceProject) => void run('Analyze poster text', async () => { await analyzeProjectText(p, (message, percent) => setProgress({ message, percent })); setProjects(await listProjects()); });

  const chooseRefExport = () => void run('Choose export folder', async () => {
    const f = await pickFolderPath();
    if (f) setRefExportFolder(f);
  });

  const toggleRefFormat = (f: ExportFormat) => setRefFormats(refFormats.includes(f) ? refFormats.filter(x => x !== f) : [...refFormats, f]);

  const oneClickRef = () => void run('One-click generate', async () => {
    const out = await uploadAnalyzeGenerate(profile, refExportFolder, (message, percent) => setProgress({ message, percent }), refFormats);
    if (out?.result) setRefResult({
      projectId: out.project.projectId, mode: out.result.mode, overall: out.result.qc.overall,
      pass: out.result.qc.pass, exports: out.result.exports,
      issues: out.result.qc.issues.map(x => ({ severity: x.severity, message: x.message }))
    });
    setProjects(await listProjects());
  });

  const generateRef = (p: ReferenceProject) => void run('Generate poster', async () => {
    const r = await generateFromReference(p, refExportFolder, (message, percent) => setProgress({ message, percent }), refFormats);
    setRefResult({
      projectId: p.projectId, mode: r.mode, overall: r.qc.overall, pass: r.qc.pass,
      exports: r.exports, issues: r.qc.issues.map(x => ({ severity: x.severity, message: x.message }))
    });
    setProjects(await listProjects());
  });

  const removeProj = (pid: string) => void run('Delete project', async () => { await deleteProject(pid); setProjects(await listProjects()); });

  const doDownload = (r: ModelRecord) => void run('Download model', async () => {
    setBusyModelId(r.descriptor.id);
    try { await downloadModel(r.descriptor, (status, percent) => setProgress({ message: `${r.descriptor.label}: ${status}`, percent })); }
    finally { setBusyModelId(undefined); }
    setModels(await scanModels());
  });

  const doImportPack = () => void run('Import model pack', async () => {
    await importOfflineModelPack((message, percent) => setProgress({ message, percent }));
    setModels(await scanModels());
  });

  const doDeleteModel = (r: ModelRecord) => void run('Delete model', async () => { await deleteModel(r.descriptor); setModels(await scanModels()); });

  const content = () => {
    if (!manifest && ['review', 'details', 'students', 'preview'].includes(screen))
      return <Notice>Analyze or open a saved template first.</Notice>;
    switch (screen) {
      case 'upload':
        return <UploadPoster projects={projects} upload={upload} reopen={reopenProj} remove={removeProj}
          analyze={analyzeProj} generate={generateRef} chooseExport={chooseRefExport}
          exportFolderName={refExportFolder || undefined} lastResult={refResult}
          oneClick={oneClickRef} formats={refFormats} toggleFormat={toggleRefFormat} />;
      case 'profile':
        return <Profile profile={profile} setProfile={setProfile} save={saveProf} addMedia={addMedia} removeMedia={removeMedia} />;
      case 'models':
        return <Models records={models} ready={allRequiredReady(models)} download={doDownload} importPack={doImportPack} remove={doDeleteModel} busyId={busyModelId} />;
      case 'analyze': return <Analyze manifest={manifest} onAnalyze={analyze} go={setScreen} />;
      case 'review':
        return <Review manifest={manifest!} setManifest={setManifest} save={() => void saveManifest(manifest!)} go={setScreen} />;
      case 'details':
        return <Details manifest={manifest!} data={data} setData={setData} pickFile={r => void pick(r)} go={setScreen} />;
      case 'students':
        return <Students data={data} setData={setData} pickStudent={i => void pickStudent(i)} go={setScreen} />;
      case 'assets':
        return <Assets assets={assets} choose={() => void run('Index assets', async () => setAssets(await chooseAssetFolder()))} />;
      case 'preview':
        return <Preview manifest={manifest!} data={data} setData={setData} result={result}
          chooseExport={() => void chooseExport()} generate={generate} go={setScreen} />;
      case 'generate': return <Generate result={result} />;
      case 'templates':
        return <Templates items={templates} open={m => { setManifest(m); setScreen('details'); }}
          remove={id => void run('Delete template', async () => { await deleteManifest(id); setTemplates(await listManifests()); })} />;
      case 'settings':
        return <Settings manifest={manifest}
          tag={() => manifest && void run('Tag layers', async () => { await tagLayers(manifest); await updateManifest(manifest); setManifest({ ...manifest }); })} />;
      case 'logs': return <Logs />;
      default: return <Dashboard go={setScreen} analyze={analyze} />;
    }
  };

  return (
    <div className="shell">
      <header>
        <img className="logo" src="app-icon.png" alt="SNHS Smart Poster Agent" />
        <div><h1>SNHS SMART POSTER AGENT</h1><small>Intelligent Photoshop template automation</small></div>
      </header>
      <nav>{nav.map(([id, label]) => (
        <button className={screen === id ? 'active' : ''} key={id} onClick={() => setScreen(id)}>{label}</button>
      ))}</nav>
      <main>
        {error && <Notice kind="error">{error}</Notice>}
        {busy && <Progress message={progress.message} percent={progress.percent} />}
        {content()}
      </main>
    </div>
  );
}
