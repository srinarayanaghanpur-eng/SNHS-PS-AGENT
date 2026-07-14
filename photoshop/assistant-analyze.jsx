#target photoshop
// Live Design Assistant — non-destructive document analyzer.
// Reads the active document into a structured scene graph. NEVER modifies the
// document. Writes __SNHS_OUTPUT__/analysis-result.json.
(function(){
var outputFolder=new Folder("__SNHS_OUTPUT__"),resultFile=new File(outputFolder.fsName+'/analysis-result.json');
if(!outputFolder.exists)outputFolder.create();
function esc(v){return String(v).replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/\r/g,'\\r').replace(/\n/g,'\\n');}
function scalar(fn,fallback){try{var v=fn();return typeof v==='undefined'?fallback:v;}catch(e){return fallback;}}
function bounds(layer){var b=scalar(function(){return layer.bounds;},null);if(!b)return null;return{left:Number(b[0]),top:Number(b[1]),right:Number(b[2]),bottom:Number(b[3])};}
function two(n){n=Math.round(n).toString(16);return n.length<2?'0'+n:n;}
function textColorHex(layer){return scalar(function(){var c=layer.textItem.color.rgb;return two(c.red)+two(c.green)+two(c.blue);},null);}
function kind(layer){if(layer.typename==='LayerSet')return'group';return scalar(function(){
  if(layer.kind===LayerKind.TEXT)return'text';
  if(layer.kind===LayerKind.SMARTOBJECT)return'smartObject';
  if(layer.kind===LayerKind.SOLIDFILL)return'shape';
  if(layer.kind===LayerKind.NORMAL)return'pixel';
  if(layer.kind===LayerKind.BRIGHTNESSCONTRAST||layer.kind===LayerKind.HUESATURATION||layer.kind===LayerKind.LEVELS||layer.kind===LayerKind.CURVES)return'adjustment';
  return'other';},'other');}
var activeId=scalar(function(){return app.activeDocument.activeLayer.id;},-1);
function walk(container,parent,pid,depth,seen){var rows=[],i;if(depth>25)return rows;
  for(i=0;i<container.layers.length;i++){var layer=container.layers[i],id=scalar(function(){return layer.id;},-1);
    if(id>=0&&seen[id])continue;if(id>=0)seen[id]=true;
    var type=kind(layer);
    var row={id:id,name:scalar(function(){return layer.name;},'Unnamed'),type:type,
      parentPath:parent,parentId:pid,depth:depth,bounds:bounds(layer),
      visible:scalar(function(){return layer.visible;},false),
      locked:scalar(function(){return layer.allLocked;},false),
      opacity:scalar(function(){return Number(layer.opacity);},100),
      blendMode:scalar(function(){return String(layer.blendMode);},'normal'),
      text:type==='text'?scalar(function(){return layer.textItem.contents;},''):null,
      fontName:type==='text'?scalar(function(){return String(layer.textItem.font);},null):null,
      fontSize:type==='text'?scalar(function(){return Number(layer.textItem.size);},null):null,
      textColorHex:type==='text'?textColorHex(layer):null,
      smartObject:type==='smartObject',
      linkedSmartObject:scalar(function(){return type==='smartObject'&&!!layer.linkedFile;},false),
      clipping:scalar(function(){return layer.grouped;},false),
      mask:false,
      adjustmentType:type==='adjustment'?scalar(function(){return String(layer.kind);},null):null,
      active:id===activeId,
      children:[]};
    if(type==='group')row.children=walk(layer,parent?parent+'/'+row.name:row.name,id,depth+1,seen);
    rows.push(row);}
  return rows;}
function json(v){var i,parts;if(v===null)return'null';if(typeof v==='string')return'"'+esc(v)+'"';if(typeof v==='number'||typeof v==='boolean')return String(v);if(v instanceof Array){parts=[];for(i=0;i<v.length;i++)parts.push(json(v[i]));return'['+parts.join(',')+']';}parts=[];for(i in v)if(v.hasOwnProperty(i)&&typeof v[i]!=='undefined')parts.push(json(i)+':'+json(v[i]));return'{'+parts.join(',')+'}';}
function write(obj){resultFile.encoding='UTF8';resultFile.open('w');resultFile.write(json(obj));resultFile.close();}
try{
  if(app.documents.length===0)throw new Error('NO_DOCUMENT_OPEN');
  var doc=app.activeDocument;
  write({success:true,stage:'completed',
    document:{name:doc.name,
      path:scalar(function(){return doc.fullName.fsName;},''),
      saved:scalar(function(){return !!doc.saved;},false),
      width:Number(doc.width),height:Number(doc.height),resolution:Number(doc.resolution)},
    activeLayerId:activeId,
    layers:walk(doc,'',null,0,{})});
}catch(e){write({success:false,stage:'layer-analysis',code:e.message==='NO_DOCUMENT_OPEN'?'NO_DOCUMENT_OPEN':'LAYER_ANALYSIS_FAILED',details:e.message||String(e)});}
}());
