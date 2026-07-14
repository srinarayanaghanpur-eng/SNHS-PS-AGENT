#target photoshop
(function(){
var out=new Folder("C:/Users/ADMIN/Desktop/SNHS-PS-AGENT-main/studio-output-collage2");if(!out.exists)out.create();
var resultFile=new File(out.fsName+'/'+"carousel-page1-layered-result.json");var doc=null;var warn=[];var previousRuler=null;var previousType=null;

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

function writeResult(ok,detail,psd,jpg,png){var stats=doc?documentStats(doc):{groups:0,layers:0,smartObjects:0,textLayers:0,shapeLayers:0};resultFile.encoding='UTF8';resultFile.open('w');resultFile.write('{"success":'+(ok?'true':'false')+',"details":"'+jsonEscape(detail)+'","psdPath":"'+jsonEscape(psd||'')+'","jpgPath":"'+jsonEscape(jpg||'')+'","pngPath":"'+jsonEscape(png||'')+'","groupCount":'+stats.groups+',"layerCount":'+stats.layers+',"smartObjectCount":'+stats.smartObjects+',"textLayerCount":'+stats.textLayers+',"shapeLayerCount":'+stats.shapeLayers+',"expectedGroupCount":7,"expectedLayerCount":48,"warnings":"'+jsonEscape(warn.join('|'))+'"}');resultFile.close();}
try{
app.displayDialogs=DialogModes.NO;previousRuler=app.preferences.rulerUnits;previousType=app.preferences.typeUnits;app.preferences.rulerUnits=Units.PIXELS;app.preferences.typeUnits=TypeUnits.PIXELS;
doc=app.documents.add(1080,1350,72,"SNHS_Daily_Prayer_Carousel_Page_1",NewDocumentMode.RGB,DocumentFill.TRANSPARENT);var bootstrapLayer=doc.activeLayer;
var group1=doc.layerSets.add();group1.name="00_BACKGROUND";
var layer1=shapeLayer(group1,"SHAPE_01",246,243,236,0,0,1080,1350,0,false);
var group2=doc.layerSets.add();group2.name="01_DECORATIVE_PATTERN";
var layer2=shapeLayer(group2,"SHAPE_01",93,113,140,-65,-92,85,58,75,false);
layer2.opacity=4;
var layer3=shapeLayer(group2,"SHAPE_02",93,113,140,125,-92,275,58,75,false);
layer3.opacity=4;
var layer4=shapeLayer(group2,"SHAPE_03",93,113,140,315,-92,465,58,75,false);
layer4.opacity=4;
var layer5=shapeLayer(group2,"SHAPE_04",93,113,140,505,-92,655,58,75,false);
layer5.opacity=4;
var layer6=shapeLayer(group2,"SHAPE_05",93,113,140,695,-92,845,58,75,false);
layer6.opacity=4;
var layer7=shapeLayer(group2,"SHAPE_06",93,113,140,885,-92,1035,58,75,false);
layer7.opacity=4;
var layer8=shapeLayer(group2,"SHAPE_07",93,113,140,1075,-92,1225,58,75,false);
layer8.opacity=4;
var group3=doc.layerSets.add();group3.name="02_HEADER_IDENTITY";
var layer9=shapeLayer(group3,"SHAPE_01",255,255,255,0,0,1080,230,0,false);
var layer10=shapeLayer(group3,"SHAPE_02",224,168,59,0,224,1080,230,0,false);
try{
var layer11=placeFile("E:/AI AGENTS/PS AGENT/ASSETS/school logo.png");layer11.name="LOGO_03_school logo";
var bounds11=layer11.bounds;var pw11=bounds11[2].value-bounds11[0].value;var ph11=bounds11[3].value-bounds11[1].value;
var scale11=Math.min(131/pw11,131/ph11)*100;layer11.resize(scale11,scale11,AnchorPosition.MIDDLECENTER);
bounds11=layer11.bounds;pw11=bounds11[2].value-bounds11[0].value;ph11=bounds11[3].value-bounds11[1].value;layer11.translate(new UnitValue(51+(131-pw11)/2-bounds11[0].value,'px'),new UnitValue(46+(131-ph11)/2-bounds11[1].value,'px'));
layer11.move(group3,ElementPlacement.INSIDE);
}catch(eAsset11){warn.push('ASSET_FAILED:'+"LOGO_03_school logo"+':'+eAsset11.message);}
var layer12=addText(group3,"TEXT_04_Recognised by the Government of Telangana","Recognised by the Government of Telangana",["Arial","ArialMT"],18,11,74,84,100,206,24,643,24,"center",39,1.15,false,false);
var layer13=addText(group3,"TEXT_05_SRI NARAYANA HIGH SCHOOL","SRI NARAYANA HIGH\rSCHOOL",["SegoeUI-Bold","SegoeUI","Segoe UI","Arial-BoldMT"],50,31,30,58,95,206,54,643,100,"center",0,0.96,true,false);
var layer14=addText(group3,"TEXT_06_Ghanpur (M), Jayashankar Bhupalpally District","Ghanpur (M), Jayashankar Bhupalpally District",["Arial","ArialMT"],19,11,27,34,46,206,164,643,25,"center",0,1.15,false,false);
var layer15=shapeLayer(group3,"SHAPE_07",246,243,236,871,20,1037,212,18,false);
try{
var layer16=placeFile("E:/AI AGENTS/PS AGENT/ASSETS/chairman.png");layer16.name="PHOTO_08_chairman";
var bounds16=layer16.bounds;var pw16=bounds16[2].value-bounds16[0].value;var ph16=bounds16[3].value-bounds16[1].value;
var scale16=Math.max(108/pw16,108/ph16)*100;layer16.resize(scale16,scale16,AnchorPosition.MIDDLECENTER);
bounds16=layer16.bounds;pw16=bounds16[2].value-bounds16[0].value;ph16=bounds16[3].value-bounds16[1].value;layer16.translate(new UnitValue(900-(pw16-108)*0.5-bounds16[0].value,'px'),new UnitValue(27-(ph16-108)*0.48-bounds16[1].value,'px'));
selEllipse(900,27,1008,135);maskFromSelection();
layer16.move(group3,ElementPlacement.INSIDE);
var frame16=shapeLayer(group3,"PHOTO_08_chairman_FRAME",224,168,59,900,27,1008,135,18,true);frame16.fillOpacity=0;applyStroke(frame16,224,168,59,5);
}catch(eAsset16){warn.push('ASSET_FAILED:'+"PHOTO_08_chairman"+':'+eAsset16.message);}
var layer17=addText(group3,"TEXT_09_N. Ravi","N. Ravi",["Arial","Arial-BoldMT"],19,11,27,34,46,879,142,150,23,"center",0,1.15,true,false);
var layer18=addText(group3,"TEXT_10_Chairman","Chairman",["Arial","ArialMT"],14,8,74,84,100,879,166,150,18,"center",36,1.15,false,false);
var group4=doc.layerSets.add();group4.name="03_EVENT_TITLE_DATE";
selRect(43,242,1037,314,13);
var layer19=gradientLayer(group4,"GRADIENT_01",[[30,58,95,0,100],[20,38,62,100,100]],0);
try{doc.selection.deselect();}catch(eD){}
var layer20=addText(group4,"TEXT_02_DAILY PRAYER PROCEEDINGS","DAILY PRAYER PROCEEDINGS",["SegoeUI-Bold","SegoeUI","Segoe UI","Arial-BoldMT"],41,25,255,255,255,70,256,644,48,"left",6,1.15,true,false);
var layer21=addText(group4,"TEXT_03_13 JULY 2026 \u00b7 MONDAY","13 JULY 2026  \u00b7  MONDAY",["SegoeUI-Semibold","SegoeUI","Segoe UI","Arial-BoldMT"],21,13,224,168,59,717,266,292,29,"right",33,1.15,true,false);
var group5=doc.layerSets.add();group5.name="04_HERO_PHOTO";
try{
var layer22=placeFile("C:/Users/ADMIN/Desktop/SNHS-PS-AGENT-main/studio-output-collage2/hero-enhanced-1784013580972.jpg");layer22.name="PHOTO_01_hero-enhanced-1784013580972";
var bounds22=layer22.bounds;var pw22=bounds22[2].value-bounds22[0].value;var ph22=bounds22[3].value-bounds22[1].value;
var scale22=Math.max(994/pw22,734/ph22)*100;layer22.resize(scale22,scale22,AnchorPosition.MIDDLECENTER);
bounds22=layer22.bounds;pw22=bounds22[2].value-bounds22[0].value;ph22=bounds22[3].value-bounds22[1].value;layer22.translate(new UnitValue(43-(pw22-994)*0.46-bounds22[0].value,'px'),new UnitValue(330-(ph22-734)*0.56-bounds22[1].value,'px'));
selRect(43,330,1037,1064,24);maskFromSelection();
layer22.move(group5,ElementPlacement.INSIDE);
applyShadow(layer22,24,7,14);
var frame22=shapeLayer(group5,"PHOTO_01_hero-enhanced-1784013580972_FRAME",255,255,255,43,330,1037,1064,24,false);frame22.fillOpacity=0;applyStroke(frame22,255,255,255,8);
}catch(eAsset22){warn.push('ASSET_FAILED:'+"PHOTO_01_hero-enhanced-1784013580972"+':'+eAsset22.message);}
var layer23=shapeLayer(group5,"SHAPE_02",20,38,62,43,998,1037,1064,0,false);
layer23.opacity=91;
var layer24=addText(group5,"TEXT_03_MORNING ASSEMBLY","MORNING ASSEMBLY",["SegoeUI-Bold","SegoeUI","Segoe UI","Arial-BoldMT"],20,12,255,255,255,50,1020,980,59,"center",13,1.15,true,false);
var group6=doc.layerSets.add();group6.name="06_QUOTE_DIVIDER";
var layer25=shapeLayer(group6,"RULE_01",224,168,59,43,1081,107,1085,0,false);
var layer26=shapeLayer(group6,"RULE_02",224,168,59,973,1109,1037,1113,0,false);
var layer27=addText(group6,"TEXT_03_\u201cEducation turns today\u2019s dreams into tomorrow\u2019s achievements.\u201d","\u201cEducation turns today\u2019s dreams into tomorrow\u2019s achievements.\u201d",["SegoeUI-SemiboldItalic","SegoeUI-Italic","Segoe UI","Arial-BoldItalicMT"],23,14,30,58,95,98,1085.58,884,44,"center",0,1.06,true,true);
var group7=doc.layerSets.add();group7.name="09_FOOTER_BRANDING";
selRect(0,1150,1080,1350,0);
var layer28=gradientLayer(group7,"GRADIENT_01",[[30,58,95,0,100],[20,38,62,100,100]],90);
try{doc.selection.deselect();}catch(eD){}
var layer29=shapeLayer(group7,"SHAPE_02",224,168,59,0,1150,1080,1156,0,false);
var layer30=shapeLayer(group7,"SHAPE_03",255,255,255,-20,1155,100,1239,42,false);
layer30.opacity=3;
var layer31=shapeLayer(group7,"SHAPE_04",255,255,255,155,1155,275,1239,42,false);
layer31.opacity=3;
var layer32=shapeLayer(group7,"SHAPE_05",255,255,255,330,1155,450,1239,42,false);
layer32.opacity=3;
var layer33=shapeLayer(group7,"SHAPE_06",255,255,255,505,1155,625,1239,42,false);
layer33.opacity=3;
var layer34=shapeLayer(group7,"SHAPE_07",255,255,255,680,1155,800,1239,42,false);
layer34.opacity=3;
var layer35=shapeLayer(group7,"SHAPE_08",255,255,255,855,1155,975,1239,42,false);
layer35.opacity=3;
var layer36=shapeLayer(group7,"SHAPE_09",255,255,255,1030,1155,1150,1239,42,false);
layer36.opacity=3;
var layer37=shapeLayer(group7,"SHAPE_10",255,255,255,43,1179,139,1275,17,false);
layer37.opacity=94;
try{
var layer38=placeFile("E:/AI AGENTS/PS AGENT/ASSETS/school logo.png");layer38.name="LOGO_11_school logo";
var bounds38=layer38.bounds;var pw38=bounds38[2].value-bounds38[0].value;var ph38=bounds38[3].value-bounds38[1].value;
var scale38=Math.min(78/pw38,78/ph38)*100;layer38.resize(scale38,scale38,AnchorPosition.MIDDLECENTER);
bounds38=layer38.bounds;pw38=bounds38[2].value-bounds38[0].value;ph38=bounds38[3].value-bounds38[1].value;layer38.translate(new UnitValue(52+(78-pw38)/2-bounds38[0].value,'px'),new UnitValue(1188+(78-ph38)/2-bounds38[1].value,'px'));
layer38.move(group7,ElementPlacement.INSIDE);
}catch(eAsset38){warn.push('ASSET_FAILED:'+"LOGO_11_school logo"+':'+eAsset38.message);}
var layer39=addText(group7,"TEXT_12_A Unit of","A Unit of",["Arial","ArialMT"],17,10,212,221,234,163,1172,590,20,"left",0,1.15,false,false);
var layer40=addText(group7,"TEXT_13_SRI ADARSHAVANI GROUP OF SCHOOLS","SRI ADARSHAVANI GROUP OF SCHOOLS",["SegoeUI-Bold","SegoeUI","Segoe UI","Arial-BoldMT"],29,17,255,255,255,163,1193,590,31,"left",7,1.15,true,false);
var layer41=addText(group7,"TEXT_14_Ghanpur | Duggondi | Nallabelly","Ghanpur   |   Duggondi   |   Nallabelly",["Arial","ArialMT"],20,12,224,168,59,163,1229,590,24,"left",0,1.15,false,false);
var layer42=addText(group7,"TEXT_15_TEL 6300038389 | 8121063032 | 9032480165","TEL  6300038389   |   8121063032   |   9032480165",["Arial","Arial-BoldMT"],23,14,255,255,255,163,1258,650,27,"left",0,1.15,true,false);
var layer43=addText(group7,"TEXT_16_\u201cEducation is not the learning of facts, but the training of the mind ","\u201cEducation is not the learning of facts, but the training of the mind to think.\u201d",["Arial","Arial-ItalicMT"],15,9,199,209,224,163,1321,655,18,"left",0,1.15,false,true);
var layer44=shapeLayer(group7,"SHAPE_17",255,255,255,883,1182,1037,1252,12,false);
try{
var layer45=placeFile("C:/Users/ADMIN/Desktop/SNHS-PS-AGENT-main/studio-output-collage2/lead-keyed.png");layer45.name="LOGO_18_lead-keyed";
var bounds45=layer45.bounds;var pw45=bounds45[2].value-bounds45[0].value;var ph45=bounds45[3].value-bounds45[1].value;
var scale45=Math.min(126/pw45,46/ph45)*100;layer45.resize(scale45,scale45,AnchorPosition.MIDDLECENTER);
bounds45=layer45.bounds;pw45=bounds45[2].value-bounds45[0].value;ph45=bounds45[3].value-bounds45[1].value;layer45.translate(new UnitValue(897+(126-pw45)/2-bounds45[0].value,'px'),new UnitValue(1194+(46-ph45)/2-bounds45[1].value,'px'));
layer45.move(group7,ElementPlacement.INSIDE);
}catch(eAsset45){warn.push('ASSET_FAILED:'+"LOGO_18_lead-keyed"+':'+eAsset45.message);}
var layer46=addText(group7,"TEXT_19_Powered by LEAD Curriculum","Powered by LEAD Curriculum",["Arial","ArialMT"],15,9,212,221,234,865,1262,172,18,"right",0,1.15,false,false);
try{bootstrapLayer.remove();}catch(eBootstrap){warn.push('BOOTSTRAP_LAYER_REMOVE_FAILED:'+eBootstrap.message);}
var builtStats=documentStats(doc);if(builtStats.groups!=7)warn.push('GROUP_COUNT_MISMATCH:'+builtStats.groups+':7');if(builtStats.layers!=48)warn.push('LAYER_COUNT_MISMATCH:'+builtStats.layers+':48');if(builtStats.smartObjects!=5)warn.push('SMART_OBJECT_COUNT_MISMATCH:'+builtStats.smartObjects+':5');if(builtStats.textLayers!=15)warn.push('TEXT_LAYER_COUNT_MISMATCH:'+builtStats.textLayers+':15');
var psd=new File(out.fsName+'/'+"carousel-page1-layered.psd");var psdOptions=new PhotoshopSaveOptions();psdOptions.layers=true;psdOptions.embedColorProfile=true;doc.saveAs(psd,psdOptions,true,Extension.LOWERCASE);
var jpg=new File(out.fsName+'/'+"carousel-page1-layered.jpg");var jpgOptions=new JPEGSaveOptions();jpgOptions.quality=12;jpgOptions.embedColorProfile=true;doc.saveAs(jpg,jpgOptions,true,Extension.LOWERCASE);
var png=new File(out.fsName+'/'+"carousel-page1-layered.png");var pngOptions=new PNGSaveOptions();pngOptions.compression=6;var pngDoc=doc.duplicate();pngDoc.flatten();pngDoc.saveAs(png,pngOptions,true,Extension.LOWERCASE);pngDoc.close(SaveOptions.DONOTSAVECHANGES);app.activeDocument=doc;
writeResult(true,'Layered Studio poster created.',psd.fsName,jpg.fsName,png.fsName);
}catch(error){writeResult(false,error&&error.message?error.message:String(error),'','','');}
finally{try{if(previousRuler!==null)app.preferences.rulerUnits=previousRuler;if(previousType!==null)app.preferences.typeUnits=previousType;}catch(eUnits){}if(doc){try{doc.close(SaveOptions.DONOTSAVECHANGES);}catch(eClose){}}}
}());