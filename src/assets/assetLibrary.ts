import type{AssetRecord}from'../types';import{indexFolder}from'./assetIndexer';
const fs=require('uxp').storage.localFileSystem;const key='asset-folder.token';
async function settings(){const d=await fs.getDataFolder();return d.getEntry(key).catch(()=>d.createFile(key,{overwrite:true}))}
export async function chooseAssetFolder(){const folder=await fs.getFolder();if(!folder)return[];const token=await fs.createPersistentToken(folder);await(await settings()).write(token);return indexFolder(folder)}
export async function loadAssets():Promise<AssetRecord[]>{try{const token=await(await settings()).read();if(!token)return[];const folder=await fs.getEntryForPersistentToken(token);return indexFolder(folder)}catch{return[]}}
export async function importAssets(){return chooseAssetFolder()}
