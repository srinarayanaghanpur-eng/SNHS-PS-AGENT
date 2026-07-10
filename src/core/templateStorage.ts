import type{TemplateManifest}from'../types';
const fs=require('uxp').storage.localFileSystem;
async function folder(){const root=await fs.getDataFolder();return await root.getEntry('templates').catch(()=>root.createFolder('templates'))}
export async function saveManifest(m:TemplateManifest){const f=await folder();const file=await f.getEntry(`${m.templateId}.json`).catch(()=>f.createFile(`${m.templateId}.json`,{overwrite:true}));await file.write(JSON.stringify(m,null,2));}
export async function listManifests():Promise<TemplateManifest[]>{const f=await folder();const out:TemplateManifest[]=[];for(const e of await f.getEntries())if(e.isFile&&e.name.endsWith('.json'))try{out.push(JSON.parse(await e.read()))}catch{}return out.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))}
export async function findByFingerprint(fp:string){return(await listManifests()).find(m=>m.fingerprint===fp)}
export async function deleteManifest(id:string){const f=await folder();const e=await f.getEntry(`${id}.json`);await e.delete();}
export async function updateManifest(m:TemplateManifest){m.updatedAt=new Date().toISOString();await saveManifest(m);return m}
