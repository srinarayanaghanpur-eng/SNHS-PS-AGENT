import{PluginError}from'../utils/errors';
export async function duplicateActiveDocument(name:string){const ps=require('photoshop');const doc=ps.app.activeDocument;if(!doc)throw new PluginError('NO_DOCUMENT','No document open.','Open the template PSD first.');return doc.duplicate(name,false)}
