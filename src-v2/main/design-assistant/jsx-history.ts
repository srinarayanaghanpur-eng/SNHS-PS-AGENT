// ES3 emitters for history/version operations used by the assistant.
// Revert-to-named-snapshot (undo/redo/restore) and save-as-new-version. These
// run through the same transport and write result.json.

const j = (v: string) => JSON.stringify(v);

function wrapper(out: string, body: string): string {
  const outEsc = out.replace(/\\/g, '/');
  return `#target photoshop
(function(){
var out=new Folder(${j(outEsc)});if(!out.exists)out.create();
var resultFile=new File(out.fsName+'/result.json');
function esc(s){return String(s).replace(/\\\\/g,'\\\\\\\\').replace(/"/g,'\\\\"');}
function writeResult(ok,detail,path){resultFile.encoding='UTF8';resultFile.open('w');resultFile.write('{"success":'+(ok?'true':'false')+',"details":"'+esc(detail)+'","path":"'+esc(path||'')+'"}');resultFile.close();}
try{
if(app.documents.length===0)throw new Error('NO_DOCUMENT_OPEN');
var doc=app.activeDocument;app.displayDialogs=DialogModes.NO;
${body}
}catch(e){writeResult(false,(e&&e.message)?e.message:String(e),'');}
}());`;
}

// Revert the active document to a named history snapshot (e.g. a checkpoint).
export function emitRevertToSnapshot(outputDir: string, snapshotName: string): string {
  return wrapper(outputDir, `
var target=null;
for(var i=0;i<doc.historyStates.length;i++){if(doc.historyStates[i].name==${j(snapshotName)})target=doc.historyStates[i];}
if(!target)throw new Error('SNAPSHOT_NOT_FOUND:'+${j(snapshotName)});
doc.activeHistoryState=target;
writeResult(true,'reverted to '+${j(snapshotName)},'');`);
}

// Save the active document as a new PSD version (never overwrites unless path is
// the original AND caller explicitly allowed it — enforced in TS).
export function emitSaveVersion(outputDir: string, destPsdPath: string): string {
  return wrapper(outputDir, `
var f=new File(${j(destPsdPath.replace(/\\/g, '/'))});
doc.saveAs(f,new PhotoshopSaveOptions(),true,Extension.LOWERCASE);
writeResult(true,'saved version',f.fsName);`);
}
