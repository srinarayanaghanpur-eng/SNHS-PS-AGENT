#target photoshop
(function(){
var out=new Folder("C:/Users/ADMIN/Desktop/SNHS-PS-AGENT-main/studio-output-collage2");if(!out.exists)out.create();
var resultFile=new File(out.fsName+'/'+"carousel-page2-layered-result.json");var doc=null;var warn=[];var previousRuler=null;var previousType=null;

function cTID(s){return charIDToTypeID(s);}function sTID(s){return stringIDToTypeID(s);}
function rgbDesc(r,g,b){var c=new ActionDescriptor();c.putDouble(cTID('Rd  '),r);c.putDouble(cTID('Grn '),g);c.putDouble(cTID('Bl  '),b);return c;}
function solid(r,g,b){var c=new SolidColor();c.rgb.red=r;c.rgb.green=g;c.rgb.blue=b;return c;}
function intoGroup(group,name){var layer=doc.activeLayer;layer.name=name;layer.move(group,ElementPlacement.INSIDE);return layer;}
function boundsDesc(l,t,r,b,radius){var d=new ActionDescriptor();d.putUnitDouble(cTID('Top '),cTID('#Pxl'),t);d.putUnitDouble(cTID('Left'),cTID('#Pxl'),l);d.putUnitDouble(cTID('Btom'),cTID('#Pxl'),b);d.putUnitDouble(cTID('Rght'),cTID('#Pxl'),r);if(radius&&radius>0){d.putUnitDouble(sTID('topLeft'),cTID('#Pxl'),radius);d.putUnitDouble(sTID('topRight'),cTID('#Pxl'),radius);d.putUnitDouble(sTID('bottomLeft'),cTID('#Pxl'),radius);d.putUnitDouble(sTID('bottomRight'),cTID('#Pxl'),radius);}return d;}
function shapeLayer(group,name,r,g,b,l,t,rr,bb,radius,ellipse){
  var d=new ActionDescriptor();var ref=new ActionReference();ref.putClass(sTID('contentLayer'));d.putReference(cTID('null'),ref);
  var use=new ActionDescriptor();var typ=new ActionDescriptor();typ.putObject(cTID('Clr '),cTID('RGBC'),rgbDesc(r,g,b));
  use.putObject(cTID('Type'),sTID('solidColorLayer'),typ);use.putObject(cTID('Shp '),ellipse?cTID('Elps'):cTID('Rctn'),boundsDesc(l,t,rr,bb,radius));
  d.putObject(cTID('Usng'),sTID('contentLayer'),use);executeAction(cTID('Mk  '),d,DialogModes.NO);return intoGroup(group,name);
}
function selRect(l,t,r,b,radius){var d=new ActionDescriptor();var ref=new ActionReference();ref.putProperty(cTID('Chnl'),cTID('fsel'));d.putReference(cTID('null'),ref);d.putObject(cTID('T   '),cTID('Rctn'),boundsDesc(l,t,r,b,radius));executeAction(cTID('setd'),d,DialogModes.NO);}
function selEllipse(l,t,r,b){var d=new ActionDescriptor();var ref=new ActionReference();ref.putProperty(cTID('Chnl'),cTID('fsel'));d.putReference(cTID('null'),ref);d.putObject(cTID('T   '),cTID('Elps'),boundsDesc(l,t,r,b,0));executeAction(cTID('setd'),d,DialogModes.NO);}
function maskFromSelection(){var d=new ActionDescriptor();d.putClass(cTID('Nw  '),cTID('Chnl'));var ref=new ActionReference();ref.putEnumerated(cTID('Chnl'),cTID('Chnl'),cTID('Msk '));d.putReference(cTID('At  '),ref);d.putEnumerated(cTID('Usng'),cTID('UsrM'),cTID('RvlS'));executeAction(cTID('Mk  '),d,DialogModes.NO);try{doc.selection.deselect();}catch(e){}}
function gradientLayer(group,name,stops,angle){
  var d=new ActionDescriptor();var ref=new ActionReference();ref.putClass(sTID('contentLayer'));d.putReference(cTID('null'),ref);
  var use=new ActionDescriptor();var typ=new ActionDescriptor();typ.putEnumerated(cTID('Type'),cTID('GrdT'),cTID('Lnr '));typ.putUnitDouble(cTID('Angl'),cTID('#Ang'),angle);
  var grad=new ActionDescriptor();grad.putString(cTID('Nm  '),'SNHS Studio');grad.putEnumerated(cTID('GrdF'),cTID('GrdF'),cTID('CstS'));grad.putDouble(cTID('Intr'),4096);
  var colours=new ActionList();var transparencies=new ActionList();
  for(var i=0;i<stops.length;i++){var colour=new ActionDescriptor();colour.putObject(cTID('Clr '),cTID('RGBC'),rgbDesc(stops[i][0],stops[i][1],stops[i][2]));colour.putEnumerated(cTID('Type'),cTID('Clry'),cTID('UsrS'));colour.putInteger(cTID('Lctn'),Math.round(stops[i][3]*40.96));colour.putInteger(cTID('Mdpn'),50);colours.putObject(cTID('Clrt'),colour);var alpha=new ActionDescriptor();alpha.putUnitDouble(cTID('Opct'),cTID('#Prc'),stops[i][4]);alpha.putInteger(cTID('Lctn'),Math.round(stops[i][3]*40.96));alpha.putInteger(cTID('Mdpn'),50);transparencies.putObject(cTID('TrnS'),alpha);}
  grad.putList(cTID('Clrs'),colours);grad.putList(cTID('Trns'),transparencies);typ.putObject(cTID('Grad'),cTID('Grdn'),grad);use.putObject(cTID('Type'),sTID('gradientLayer'),typ);d.putObject(cTID('Usng'),sTID('contentLayer'),use);executeAction(cTID('Mk  '),d,DialogModes.NO);return intoGroup(group,name);
}
function fxDesc(){var fx=new ActionDescriptor();fx.putUnitDouble(cTID('Scl '),cTID('#Prc'),100);return fx;}
function shadowDesc(opacity,distance,size){var d=new ActionDescriptor();d.putBoolean(cTID('enab'),true);d.putEnumerated(cTID('Md  '),cTID('BlnM'),cTID('Mltp'));d.putObject(cTID('Clr '),cTID('RGBC'),rgbDesc(0,0,0));d.putUnitDouble(cTID('Opct'),cTID('#Prc'),opacity);d.putBoolean(cTID('uglg'),false);d.putUnitDouble(cTID('lagl'),cTID('#Ang'),90);d.putUnitDouble(cTID('Dstn'),cTID('#Pxl'),distance);d.putUnitDouble(cTID('Ckmt'),cTID('#Pxl'),0);d.putUnitDouble(cTID('blur'),cTID('#Pxl'),size);d.putUnitDouble(cTID('Nose'),cTID('#Prc'),0);d.putBoolean(sTID('layerConceals'),true);return d;}
function strokeDesc(r,g,b,size){var d=new ActionDescriptor();d.putBoolean(cTID('enab'),true);d.putEnumerated(cTID('Styl'),cTID('FStl'),cTID('OutF'));d.putEnumerated(cTID('PntT'),cTID('FrFl'),cTID('SClr'));d.putEnumerated(cTID('Md  '),cTID('BlnM'),cTID('Nrml'));d.putUnitDouble(cTID('Opct'),cTID('#Prc'),100);d.putUnitDouble(cTID('Sz  '),cTID('#Pxl'),size);d.putObject(cTID('Clr '),cTID('RGBC'),rgbDesc(r,g,b));return d;}
function applyFx(fx){var d=new ActionDescriptor();var ref=new ActionReference();ref.putProperty(cTID('Prpr'),cTID('Lefx'));ref.putEnumerated(cTID('Lyr '),cTID('Ordn'),cTID('Trgt'));d.putReference(cTID('null'),ref);d.putObject(cTID('T   '),cTID('Lefx'),fx);executeAction(cTID('setd'),d,DialogModes.NO);}
function applyShadow(layer,opacity,distance,size){doc.activeLayer=layer;var fx=fxDesc();fx.putObject(cTID('DrSh'),cTID('DrSh'),shadowDesc(opacity,distance,size));applyFx(fx);}
function applyStroke(layer,r,g,b,size){doc.activeLayer=layer;var fx=fxDesc();fx.putObject(cTID('FrFX'),cTID('FrFX'),strokeDesc(r,g,b,size));applyFx(fx);}
function placeFile(path){var file=new File(path);if(!file.exists)throw new Error('Asset not found: '+path);var d=new ActionDescriptor();d.putPath(cTID('null'),file);d.putEnumerated(cTID('FTcs'),cTID('QCSt'),cTID('Qcsa'));executeAction(cTID('Plc '),d,DialogModes.NO);return doc.activeLayer;}
function setFont(ti,names){for(var i=0;i<names.length;i++){try{ti.font=names[i];if(ti.font==names[i])return names[i];}catch(e){}}return ti.font;}
function addText(group,name,content,fonts,size,minSize,r,g,b,x,y,w,h,align,tracking,leadingFactor,bold,italic){
  var layer=group.artLayers.add();layer.kind=LayerKind.TEXT;layer.name=name;var ti=layer.textItem;ti.kind=TextType.POINTTEXT;
  var actual=setFont(ti,fonts);ti.size=new UnitValue(size,'px');try{ti.useAutoLeading=false;ti.leading=new UnitValue(Math.round(size*leadingFactor),'px');}catch(eLead){}
  try{ti.tracking=tracking;}catch(eTrack){}try{ti.antiAliasMethod=AntiAlias.SMOOTH;}catch(eAA){}ti.color=solid(r,g,b);ti.contents=content;
  try{ti.justification=align=='center'?Justification.CENTER:align=='right'?Justification.RIGHT:Justification.LEFT;}catch(eJust){}
  var actualLower=String(actual).toLowerCase();if(bold&&actualLower.indexOf('bold')<0&&actualLower.indexOf('black')<0)try{ti.fauxBold=true;}catch(eBold){}if(italic&&actualLower.indexOf('italic')<0)try{ti.fauxItalic=true;}catch(eItalic){}
  var anchorX=align=='center'?x+w/2:align=='right'?x+w:x;ti.position=[new UnitValue(anchorX,'px'),new UnitValue(y+size,'px')];var guard=0;
  while(guard++<32){var bnds=layer.bounds;var tw=bnds[2].value-bnds[0].value;var th=bnds[3].value-bnds[1].value;if((tw<=w*1.015&&th<=h*1.08)||ti.size.value<=minSize)break;var next=Math.max(minSize,Math.floor(ti.size.value*0.95));ti.size=new UnitValue(next,'px');try{ti.leading=new UnitValue(Math.round(next*leadingFactor),'px');}catch(eLead2){}}
  var fb=layer.bounds;var dy=y-fb[1].value;if(Math.abs(dy)>0.25)layer.translate(new UnitValue(0,'px'),new UnitValue(dy,'px'));return layer;
}
function rotateLayer(layer,degrees){if(!degrees)return;try{layer.rotate(degrees,AnchorPosition.MIDDLECENTER);}catch(eRot){warn.push('ROTATE_FAILED:'+layer.name+':'+eRot.message);}}
function jsonEscape(value){return String(value).replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/\r/g,'\\r').replace(/\n/g,'\\n');}
function documentStats(container){var stats={groups:0,layers:0,smartObjects:0,textLayers:0,shapeLayers:0};function walk(parent){for(var i=0;i<parent.layers.length;i++){var layer=parent.layers[i];if(layer.typename=='LayerSet'){stats.groups++;walk(layer);}else{stats.layers++;try{if(layer.kind==LayerKind.SMARTOBJECT)stats.smartObjects++;else if(layer.kind==LayerKind.TEXT)stats.textLayers++;else if(layer.kind==LayerKind.SOLIDFILL||layer.kind==LayerKind.GRADIENTFILL)stats.shapeLayers++;}catch(eKind){}}}}walk(container);return stats;}

function writeResult(ok,detail,psd,jpg,png){var stats=doc?documentStats(doc):{groups:0,layers:0,smartObjects:0,textLayers:0,shapeLayers:0};resultFile.encoding='UTF8';resultFile.open('w');resultFile.write('{"success":'+(ok?'true':'false')+',"details":"'+jsonEscape(detail)+'","psdPath":"'+jsonEscape(psd||'')+'","jpgPath":"'+jsonEscape(jpg||'')+'","pngPath":"'+jsonEscape(png||'')+'","groupCount":'+stats.groups+',"layerCount":'+stats.layers+',"smartObjectCount":'+stats.smartObjects+',"textLayerCount":'+stats.textLayers+',"shapeLayerCount":'+stats.shapeLayers+',"expectedGroupCount":5,"expectedLayerCount":51,"warnings":"'+jsonEscape(warn.join('|'))+'"}');resultFile.close();}
try{
app.displayDialogs=DialogModes.NO;previousRuler=app.preferences.rulerUnits;previousType=app.preferences.typeUnits;app.preferences.rulerUnits=Units.PIXELS;app.preferences.typeUnits=TypeUnits.PIXELS;
doc=app.documents.add(1080,1350,72,"SNHS_Daily_Prayer_Carousel_Page_2",NewDocumentMode.RGB,DocumentFill.TRANSPARENT);var bootstrapLayer=doc.activeLayer;
var group1=doc.layerSets.add();group1.name="00_BACKGROUND";
var layer1=shapeLayer(group1,"SHAPE_01",246,243,236,0,0,1080,1350,0,false);
var group2=doc.layerSets.add();group2.name="01_HEADER_IDENTITY";
var layer2=shapeLayer(group2,"SHAPE_01",255,255,255,0,0,1080,176,0,false);
var layer3=shapeLayer(group2,"SHAPE_02",224,168,59,0,170,1080,176,0,false);
try{
var layer4=placeFile("E:/AI AGENTS/PS AGENT/ASSETS/school logo.png");layer4.name="LOGO_03_school logo";
var bounds4=layer4.bounds;var pw4=bounds4[2].value-bounds4[0].value;var ph4=bounds4[3].value-bounds4[1].value;
var scale4=Math.min(105/pw4,105/ph4)*100;layer4.resize(scale4,scale4,AnchorPosition.MIDDLECENTER);
bounds4=layer4.bounds;pw4=bounds4[2].value-bounds4[0].value;ph4=bounds4[3].value-bounds4[1].value;layer4.translate(new UnitValue(43+(105-pw4)/2-bounds4[0].value,'px'),new UnitValue(31+(105-ph4)/2-bounds4[1].value,'px'));
layer4.move(group2,ElementPlacement.INSIDE);
}catch(eAsset4){warn.push('ASSET_FAILED:'+"LOGO_03_school logo"+':'+eAsset4.message);}
var layer5=addText(group2,"TEXT_04_SRI NARAYANA HIGH SCHOOL","SRI NARAYANA HIGH SCHOOL",["SegoeUI-Bold","SegoeUI","Segoe UI","Arial-BoldMT"],45,27,30,58,95,170,23,747,58,"left",0,1.15,true,false);
var layer6=addText(group2,"TEXT_05_DAILY PRAYER \u2022 PROCEEDINGS","DAILY PRAYER  \u2022  PROCEEDINGS",["SegoeUI-Bold","SegoeUI","Segoe UI","Arial-BoldMT"],21,13,27,34,46,170,83,747,26,"left",67,1.15,true,false);
var layer7=addText(group2,"TEXT_06_13 July 2026 \u2022 Monday","13 July 2026  \u2022  Monday",["Arial","ArialMT"],18,11,74,84,100,170,117,747,22,"left",0,1.15,false,false);
var layer8=shapeLayer(group2,"SHAPE_07",30,58,95,945,46,1037,100,27,false);
var layer9=addText(group2,"TEXT_08_2 / 2","2 / 2",["Arial","Arial-BoldMT"],20,12,255,255,255,945,59,92,28,"center",0,1.15,true,false);
var group3=doc.layerSets.add();group3.name="02_VERIFIED_ACTIVITY_PHOTOS";
var layer10=addText(group3,"TEXT_01_VERIFIED MOMENTS FROM THE MORNING","VERIFIED MOMENTS FROM THE MORNING",["SegoeUI-Bold","SegoeUI","Segoe UI","Arial-BoldMT"],19,11,30,58,95,43,197,994,26,"left",105,1.15,true,false);
try{
var layer11=placeFile("C:/Users/ADMIN/Desktop/SNHS-PS-AGENT-main/acceptance-assets/assembly.jpg");layer11.name="PHOTO_02_assembly";
var bounds11=layer11.bounds;var pw11=bounds11[2].value-bounds11[0].value;var ph11=bounds11[3].value-bounds11[1].value;
var scale11=Math.max(518/pw11,462/ph11)*100;layer11.resize(scale11,scale11,AnchorPosition.MIDDLECENTER);
bounds11=layer11.bounds;pw11=bounds11[2].value-bounds11[0].value;ph11=bounds11[3].value-bounds11[1].value;layer11.translate(new UnitValue(43-(pw11-518)*0.5-bounds11[0].value,'px'),new UnitValue(242-(ph11-462)*0.48-bounds11[1].value,'px'));
selRect(43,242,561,704,18);maskFromSelection();
layer11.move(group3,ElementPlacement.INSIDE);
applyShadow(layer11,24,7,14);
rotateLayer(layer11,-0.25);
var frame11=shapeLayer(group3,"PHOTO_02_assembly_FRAME",255,255,255,43,242,561,704,18,false);frame11.fillOpacity=0;applyStroke(frame11,255,255,255,6);
rotateLayer(frame11,-0.25);
}catch(eAsset11){warn.push('ASSET_FAILED:'+"PHOTO_02_assembly"+':'+eAsset11.message);}
var layer12=shapeLayer(group3,"SHAPE_03",20,38,62,43,666,561,704,0,false);
layer12.opacity=92;
rotateLayer(layer12,-0.25);
var layer13=addText(group3,"TEXT_04_PRAYER SONG","PRAYER SONG",["SegoeUI-Bold","SegoeUI","Segoe UI","Arial-BoldMT"],19,11,255,255,255,52,674,500,26,"center",0,1.15,true,false);
rotateLayer(layer13,-0.25);
try{
var layer14=placeFile("C:/Users/ADMIN/Desktop/SNHS-PS-AGENT-main/acceptance-assets/student.jpg");layer14.name="PHOTO_05_student";
var bounds14=layer14.bounds;var pw14=bounds14[2].value-bounds14[0].value;var ph14=bounds14[3].value-bounds14[1].value;
var scale14=Math.max(460/pw14,480/ph14)*100;layer14.resize(scale14,scale14,AnchorPosition.MIDDLECENTER);
bounds14=layer14.bounds;pw14=bounds14[2].value-bounds14[0].value;ph14=bounds14[3].value-bounds14[1].value;layer14.translate(new UnitValue(577-(pw14-460)*0.5-bounds14[0].value,'px'),new UnitValue(233-(ph14-480)*0.38-bounds14[1].value,'px'));
selRect(577,233,1037,713,18);maskFromSelection();
layer14.move(group3,ElementPlacement.INSIDE);
applyShadow(layer14,24,7,14);
rotateLayer(layer14,0.2);
var frame14=shapeLayer(group3,"PHOTO_05_student_FRAME",255,255,255,577,233,1037,713,18,false);frame14.fillOpacity=0;applyStroke(frame14,255,255,255,6);
rotateLayer(frame14,0.2);
}catch(eAsset14){warn.push('ASSET_FAILED:'+"PHOTO_05_student"+':'+eAsset14.message);}
var layer15=shapeLayer(group3,"SHAPE_06",20,38,62,577,675,1037,713,0,false);
layer15.opacity=92;
rotateLayer(layer15,0.2);
var layer16=addText(group3,"TEXT_07_NEWS HEADLINES","NEWS HEADLINES",["SegoeUI-Bold","SegoeUI","Segoe UI","Arial-BoldMT"],19,11,255,255,255,586,683,442,26,"center",0,1.15,true,false);
rotateLayer(layer16,0.2);
var group4=doc.layerSets.add();group4.name="03_TODAYS_PROCEEDINGS_RAIL";
var layer17=addText(group4,"TEXT_01_TODAY'S COMPLETE PROCEEDINGS","TODAY'S COMPLETE PROCEEDINGS",["SegoeUI-Bold","SegoeUI","Segoe UI","Arial-BoldMT"],23,14,30,58,95,43,753,360,32,"left",57,1.15,true,false);
var layer18=shapeLayer(group4,"RULE_02",216,199,158,518,767,1037,769,0,false);
var layer19=addText(group4,"TEXT_03_01","01",["Arial","Arial-BoldMT"],17,10,224,168,59,43,798,36,29,"left",0,1.15,true,false);
var layer20=addText(group4,"TEXT_04_Prayer Song","Prayer Song",["Arial","Arial-BoldMT"],22,13,30,58,95,84,798,320,31,"left",0,1.15,true,false);
var layer21=addText(group4,"TEXT_05_PHOTO","PHOTO",["SegoeUI-Bold","SegoeUI","Segoe UI","Arial-BoldMT"],11,8,30,58,95,411,802,72,20,"center",82,1.15,true,false);
var layer22=addText(group4,"TEXT_06_02","02",["Arial","Arial-BoldMT"],17,10,224,168,59,43,846,36,29,"left",0,1.15,true,false);
var layer23=addText(group4,"TEXT_07_Pledge","Pledge",["Arial","ArialMT"],22,13,27,34,46,84,846,320,31,"left",0,1.15,false,false);
var layer24=addText(group4,"TEXT_08_03","03",["Arial","Arial-BoldMT"],17,10,224,168,59,43,894,36,29,"left",0,1.15,true,false);
var layer25=addText(group4,"TEXT_09_News Headlines","News Headlines",["Arial","Arial-BoldMT"],22,13,30,58,95,84,894,320,31,"left",0,1.15,true,false);
var layer26=addText(group4,"TEXT_10_PHOTO","PHOTO",["SegoeUI-Bold","SegoeUI","Segoe UI","Arial-BoldMT"],11,8,30,58,95,411,898,72,20,"center",82,1.15,true,false);
var layer27=addText(group4,"TEXT_11_04","04",["Arial","Arial-BoldMT"],17,10,224,168,59,43,942,36,29,"left",0,1.15,true,false);
var layer28=addText(group4,"TEXT_12_Thought of the Day","Thought of the Day",["Arial","ArialMT"],22,13,27,34,46,84,942,320,31,"left",0,1.15,false,false);
var layer29=addText(group4,"TEXT_13_05","05",["Arial","Arial-BoldMT"],17,10,224,168,59,43,990,36,29,"left",0,1.15,true,false);
var layer30=addText(group4,"TEXT_14_Word of the Day","Word of the Day",["Arial","ArialMT"],22,13,27,34,46,84,990,320,31,"left",0,1.15,false,false);
var layer31=addText(group4,"TEXT_15_06","06",["Arial","Arial-BoldMT"],17,10,224,168,59,554,798,36,29,"left",0,1.15,true,false);
var layer32=addText(group4,"TEXT_16_Quiz Question","Quiz Question",["Arial","ArialMT"],22,13,27,34,46,595,798,320,31,"left",0,1.15,false,false);
var layer33=addText(group4,"TEXT_17_07","07",["Arial","Arial-BoldMT"],17,10,224,168,59,554,846,36,29,"left",0,1.15,true,false);
var layer34=addText(group4,"TEXT_18_Birthday Wishes","Birthday Wishes",["Arial","ArialMT"],22,13,27,34,46,595,846,320,31,"left",0,1.15,false,false);
var layer35=addText(group4,"TEXT_19_08","08",["Arial","Arial-BoldMT"],17,10,224,168,59,554,894,36,29,"left",0,1.15,true,false);
var layer36=addText(group4,"TEXT_20_Principal's Message","Principal's Message",["Arial","ArialMT"],22,13,27,34,46,595,894,320,31,"left",0,1.15,false,false);
var layer37=addText(group4,"TEXT_21_09","09",["Arial","Arial-BoldMT"],17,10,224,168,59,554,942,36,29,"left",0,1.15,true,false);
var layer38=addText(group4,"TEXT_22_National Anthem","National Anthem",["Arial","ArialMT"],22,13,27,34,46,595,942,320,31,"left",0,1.15,false,false);
var group5=doc.layerSets.add();group5.name="04_FOOTER_BRANDING";
var layer39=shapeLayer(group5,"SHAPE_01",20,38,62,0,1190,1080,1350,0,false);
var layer40=shapeLayer(group5,"SHAPE_02",224,168,59,0,1190,1080,1196,0,false);
var layer41=shapeLayer(group5,"SHAPE_03",255,255,255,43,1218,125,1300,14,false);
try{
var layer42=placeFile("E:/AI AGENTS/PS AGENT/ASSETS/school logo.png");layer42.name="LOGO_04_school logo";
var bounds42=layer42.bounds;var pw42=bounds42[2].value-bounds42[0].value;var ph42=bounds42[3].value-bounds42[1].value;
var scale42=Math.min(64/pw42,64/ph42)*100;layer42.resize(scale42,scale42,AnchorPosition.MIDDLECENTER);
bounds42=layer42.bounds;pw42=bounds42[2].value-bounds42[0].value;ph42=bounds42[3].value-bounds42[1].value;layer42.translate(new UnitValue(52+(64-pw42)/2-bounds42[0].value,'px'),new UnitValue(1227+(64-ph42)/2-bounds42[1].value,'px'));
layer42.move(group5,ElementPlacement.INSIDE);
}catch(eAsset42){warn.push('ASSET_FAILED:'+"LOGO_04_school logo"+':'+eAsset42.message);}
var layer43=addText(group5,"TEXT_05_SRI ADARSHAVANI GROUP OF SCHOOLS","SRI ADARSHAVANI GROUP OF SCHOOLS",["SegoeUI-Bold","SegoeUI","Segoe UI","Arial-BoldMT"],27,16,255,255,255,147,1215,610,32,"left",0,1.15,true,false);
var layer44=addText(group5,"TEXT_06_Ghanpur | Duggondi | Nallabelly","Ghanpur   |   Duggondi   |   Nallabelly",["Arial","ArialMT"],18,11,224,168,59,147,1255,610,23,"left",0,1.15,false,false);
var layer45=addText(group5,"TEXT_07_TEL 6300038389 | 8121063032 | 9032480165","TEL  6300038389   |   8121063032   |   9032480165",["Arial","Arial-BoldMT"],21,13,255,255,255,147,1286,675,25,"left",0,1.15,true,false);
var layer46=addText(group5,"TEXT_08_\u201cEducation is not the learning of facts, but the training of the mind ","\u201cEducation is not the learning of facts, but the training of the mind to think.\u201d",["Arial","Arial-ItalicMT"],15,9,199,209,224,147,1320,690,19,"left",0,1.15,false,true);
var layer47=shapeLayer(group5,"SHAPE_09",255,255,255,893,1221,1037,1285,11,false);
try{
var layer48=placeFile("C:/Users/ADMIN/Desktop/SNHS-PS-AGENT-main/studio-output-collage2/lead-keyed.png");layer48.name="LOGO_10_lead-keyed";
var bounds48=layer48.bounds;var pw48=bounds48[2].value-bounds48[0].value;var ph48=bounds48[3].value-bounds48[1].value;
var scale48=Math.min(116/pw48,42/ph48)*100;layer48.resize(scale48,scale48,AnchorPosition.MIDDLECENTER);
bounds48=layer48.bounds;pw48=bounds48[2].value-bounds48[0].value;ph48=bounds48[3].value-bounds48[1].value;layer48.translate(new UnitValue(907+(116-pw48)/2-bounds48[0].value,'px'),new UnitValue(1232+(42-ph48)/2-bounds48[1].value,'px'));
layer48.move(group5,ElementPlacement.INSIDE);
}catch(eAsset48){warn.push('ASSET_FAILED:'+"LOGO_10_lead-keyed"+':'+eAsset48.message);}
var layer49=addText(group5,"TEXT_11_Powered by LEAD","Powered by LEAD",["Arial","ArialMT"],15,9,212,221,234,872,1295,165,20,"right",0,1.15,false,false);
try{bootstrapLayer.remove();}catch(eBootstrap){warn.push('BOOTSTRAP_LAYER_REMOVE_FAILED:'+eBootstrap.message);}
var builtStats=documentStats(doc);if(builtStats.groups!=5)warn.push('GROUP_COUNT_MISMATCH:'+builtStats.groups+':5');if(builtStats.layers!=51)warn.push('LAYER_COUNT_MISMATCH:'+builtStats.layers+':51');if(builtStats.smartObjects!=5)warn.push('SMART_OBJECT_COUNT_MISMATCH:'+builtStats.smartObjects+':5');if(builtStats.textLayers!=33)warn.push('TEXT_LAYER_COUNT_MISMATCH:'+builtStats.textLayers+':33');
var psd=new File(out.fsName+'/'+"carousel-page2-layered.psd");var psdOptions=new PhotoshopSaveOptions();psdOptions.layers=true;psdOptions.embedColorProfile=true;doc.saveAs(psd,psdOptions,true,Extension.LOWERCASE);
var jpg=new File(out.fsName+'/'+"carousel-page2-layered.jpg");var jpgOptions=new JPEGSaveOptions();jpgOptions.quality=12;jpgOptions.embedColorProfile=true;doc.saveAs(jpg,jpgOptions,true,Extension.LOWERCASE);
var png=new File(out.fsName+'/'+"carousel-page2-layered.png");var pngOptions=new PNGSaveOptions();pngOptions.compression=6;var pngDoc=doc.duplicate();pngDoc.flatten();pngDoc.saveAs(png,pngOptions,true,Extension.LOWERCASE);pngDoc.close(SaveOptions.DONOTSAVECHANGES);app.activeDocument=doc;
writeResult(true,'Layered Studio poster created.',psd.fsName,jpg.fsName,png.fsName);
}catch(error){writeResult(false,error&&error.message?error.message:String(error),'','','');}
finally{try{if(previousRuler!==null)app.preferences.rulerUnits=previousRuler;if(previousType!==null)app.preferences.typeUnits=previousType;}catch(eUnits){}if(doc){try{doc.close(SaveOptions.DONOTSAVECHANGES);}catch(eClose){}}}
}());