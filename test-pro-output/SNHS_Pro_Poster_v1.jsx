#target photoshop
(function(){
var out=new Folder("C:/Users/ADMIN/Desktop/SNHS-PS-AGENT-main/test-pro-output");if(!out.exists)out.create();
var resultFile=new File(out.fsName+'/result.json');var doc=null;var warn=[];
function esc(s){return String(s).replace(/\\\\/g,'\\\\').replace(/"/g,'\\"').replace(/\r/g,'\\r').replace(/\n/g,'\\n');}
function writeResult(ok,detail,psd,jpg,png){resultFile.encoding='UTF8';resultFile.open('w');resultFile.write('{"success":'+(ok?'true':'false')+',"details":"'+esc(detail)+'","psdPath":"'+esc(psd||'')+'","jpgPath":"'+esc(jpg||'')+'","pngPath":"'+esc(png||'')+'","warnings":"'+esc(warn.join('|'))+'"}');resultFile.close();}

function cTID(s){return charIDToTypeID(s);}
function sTID(s){return stringIDToTypeID(s);}
function rgbDesc(r,g,b){var c=new ActionDescriptor();c.putDouble(cTID('Rd  '),r);c.putDouble(cTID('Grn '),g);c.putDouble(cTID('Bl  '),b);return c;}
function solid(r,g,b){var c=new SolidColor();c.rgb.red=r;c.rgb.green=g;c.rgb.blue=b;return c;}
function intoGroup(group,name){var l=doc.activeLayer;l.name=name;l.move(group,ElementPlacement.INSIDE);return l;}
function boundsDesc(l,t,r,b,radius){var d=new ActionDescriptor();d.putUnitDouble(cTID('Top '),cTID('#Pxl'),t);d.putUnitDouble(cTID('Left'),cTID('#Pxl'),l);d.putUnitDouble(cTID('Btom'),cTID('#Pxl'),b);d.putUnitDouble(cTID('Rght'),cTID('#Pxl'),r);if(radius&&radius>0){d.putUnitDouble(sTID('topLeft'),cTID('#Pxl'),radius);d.putUnitDouble(sTID('topRight'),cTID('#Pxl'),radius);d.putUnitDouble(sTID('bottomLeft'),cTID('#Pxl'),radius);d.putUnitDouble(sTID('bottomRight'),cTID('#Pxl'),radius);}return d;}
function shapeLayer(group,name,r,g,b,l,t,rr,bb,radius,ellipse){var d=new ActionDescriptor();var ref=new ActionReference();ref.putClass(sTID('contentLayer'));d.putReference(cTID('null'),ref);var use=new ActionDescriptor();var typ=new ActionDescriptor();typ.putObject(cTID('Clr '),cTID('RGBC'),rgbDesc(r,g,b));use.putObject(cTID('Type'),sTID('solidColorLayer'),typ);use.putObject(cTID('Shp '),ellipse?cTID('Elps'):cTID('Rctn'),boundsDesc(l,t,rr,bb,radius));d.putObject(cTID('Usng'),sTID('contentLayer'),use);executeAction(cTID('Mk  '),d,DialogModes.NO);return intoGroup(group,name);}
function selRect(l,t,r,b,radius){var d=new ActionDescriptor();var ref=new ActionReference();ref.putProperty(cTID('Chnl'),cTID('fsel'));d.putReference(cTID('null'),ref);d.putObject(cTID('T   '),radius&&radius>0?cTID('Rctn'):cTID('Rctn'),boundsDesc(l,t,r,b,radius));executeAction(cTID('setd'),d,DialogModes.NO);}
function selEllipse(l,t,r,b){var d=new ActionDescriptor();var ref=new ActionReference();ref.putProperty(cTID('Chnl'),cTID('fsel'));d.putReference(cTID('null'),ref);d.putObject(cTID('T   '),cTID('Elps'),boundsDesc(l,t,r,b,0));executeAction(cTID('setd'),d,DialogModes.NO);}
function maskFromSelection(){var d=new ActionDescriptor();d.putClass(cTID('Nw  '),cTID('Chnl'));var ref=new ActionReference();ref.putEnumerated(cTID('Chnl'),cTID('Chnl'),cTID('Msk '));d.putReference(cTID('At  '),ref);d.putEnumerated(cTID('Usng'),cTID('UsrM'),cTID('RvlS'));executeAction(cTID('Mk  '),d,DialogModes.NO);}
function gradientLayer(group,name,stops,angle){var d=new ActionDescriptor();var ref=new ActionReference();ref.putClass(sTID('contentLayer'));d.putReference(cTID('null'),ref);var use=new ActionDescriptor();var typ=new ActionDescriptor();typ.putEnumerated(cTID('Type'),cTID('GrdT'),cTID('Lnr '));typ.putUnitDouble(cTID('Angl'),cTID('#Ang'),angle);var grad=new ActionDescriptor();grad.putString(cTID('Nm  '),'SNHS');grad.putEnumerated(cTID('GrdF'),cTID('GrdF'),cTID('CstS'));grad.putDouble(cTID('Intr'),4096);var clrs=new ActionList();for(var i=0;i<stops.length;i++){var s=new ActionDescriptor();s.putObject(cTID('Clr '),cTID('RGBC'),rgbDesc(stops[i][0],stops[i][1],stops[i][2]));s.putEnumerated(cTID('Type'),cTID('Clry'),cTID('UsrS'));s.putInteger(cTID('Lctn'),Math.round(stops[i][3]*40.96));s.putInteger(cTID('Mdpn'),50);clrs.putObject(cTID('Clrt'),s);}grad.putList(cTID('Clrs'),clrs);var trns=new ActionList();for(var j=0;j<2;j++){var o=new ActionDescriptor();o.putUnitDouble(cTID('Opct'),cTID('#Prc'),100);o.putInteger(cTID('Lctn'),j*4096);o.putInteger(cTID('Mdpn'),50);trns.putObject(cTID('TrnS'),o);}grad.putList(cTID('Trns'),trns);typ.putObject(cTID('Grad'),cTID('Grdn'),grad);use.putObject(cTID('Type'),sTID('gradientLayer'),typ);d.putObject(cTID('Usng'),sTID('contentLayer'),use);executeAction(cTID('Mk  '),d,DialogModes.NO);return intoGroup(group,name);}
function setFont(ti,names){var fell=null;for(var i=0;i<names.length;i++){try{ti.font=names[i];if(ti.font==names[i])return names[i];if(!fell)fell=ti.font;}catch(e){}}return fell||ti.font;}
function addPointText(group,name,content,fonts,size,minSize,r,g,b,x,y,w,align,tracking,leadingFactor){var layer=group.artLayers.add();layer.kind=LayerKind.TEXT;layer.name=name;var ti=layer.textItem;ti.kind=TextType.POINTTEXT;setFont(ti,fonts);ti.size=new UnitValue(size,'px');try{ti.useAutoLeading=false;ti.leading=new UnitValue(Math.round(size*leadingFactor),'px');}catch(eL){}if(tracking)try{ti.tracking=tracking;}catch(eT){}ti.color=solid(r,g,b);ti.contents=content;ti.position=[new UnitValue(x,'px'),new UnitValue(y+size,'px')];var guard=0;while(guard++<30){var bnds=layer.bounds;var tw=bnds[2].value-bnds[0].value;if(tw<=w*1.02||ti.size.value<=minSize)break;var next=Math.max(minSize,Math.floor(ti.size.value*0.94));ti.size=new UnitValue(next,'px');try{ti.leading=new UnitValue(Math.round(next*leadingFactor),'px');}catch(eL2){}}var fb=layer.bounds;var fw=fb[2].value-fb[0].value;var dx=0;if(align==='center')dx=(x+(w-fw)/2)-fb[0].value;else if(align==='right')dx=(x+w-fw)-fb[0].value;else dx=x-fb[0].value;if(Math.abs(dx)>0.5)layer.translate(new UnitValue(dx,'px'),new UnitValue(0,'px'));return layer;}

try{
app.displayDialogs=DialogModes.NO;
var prevRuler=app.preferences.rulerUnits;var prevType=app.preferences.typeUnits;
app.preferences.rulerUnits=Units.PIXELS;app.preferences.typeUnits=TypeUnits.PIXELS;
doc=app.documents.add(1080,1350,72,"SNHS_Pro_Poster_v1",NewDocumentMode.RGB,DocumentFill.WHITE);
var grp_n_1=doc.layerSets.add();grp_n_1.name="00_BACKGROUND";
var ly=shapeLayer(grp_n_1,"BG_LEFT",30,58,95,0,0,454,1350,0,false);
ly.opacity=100;
var ly=shapeLayer(grp_n_1,"BG_RIGHT",0,0,0,454,0,1080,1350,0,false);
ly.opacity=100;
var ly=shapeLayer(grp_n_1,"BG_SPLIT_STRIPE",42,114,211,450,0,458,1350,0,false);
ly.opacity=100;
var grp_n_5=doc.layerSets.add();grp_n_5.name="01_STRUCTURAL_GRAPHICS";
var ly=shapeLayer(grp_n_5,"EDGE_LINE_TOP",42,114,211,43,41.5,205,44.5,0,false);
ly.rotate(0,AnchorPosition.MIDDLECENTER);
var ly=shapeLayer(grp_n_5,"EDGE_LINE_BOTTOM",42,114,211,875,1305.5,1037,1308.5,0,false);
ly.rotate(0,AnchorPosition.MIDDLECENTER);
var grp_n_8=doc.layerSets.add();grp_n_8.name="02_HEADER";
var ly=addPointText(grp_n_8,"SCHOOL_NAME","SRI NARAYANA HIGH SCHOOL",["georgia","georgia","ArialMT"],38,20,255,255,255,138,47,596,"left",50,1.1);
ly.opacity=100;
var grp_n_10=doc.layerSets.add();grp_n_10.name="03_TITLE_DATE";
var ly=shapeLayer(grp_n_10,"DATE_BADGE",42,114,211,518,338,674,379,20,false);
ly.opacity=100;
var ly=addPointText(grp_n_10,"DATE_LABEL","Monday, 21 July 2026",["georgia","georgia","ArialMT"],21,12,255,255,255,532,343,134,"left",20,1.1);
ly.opacity=100;
var ly=addPointText(grp_n_10,"MAIN_TITLE","Morning Prayer Assembly",["georgia","georgia","ArialMT"],70,32,255,255,255,518,392,447,"center",-10,1.02);
ly.opacity=100;
var ly=addPointText(grp_n_10,"SUBTITLE","A meaningful start to every day",["georgia","georgia","ArialMT"],28,16,209,213,219,518,581,358,"left",0,1.25);
ly.opacity=100;
var grp_n_15=doc.layerSets.add();grp_n_15.name="04_MANAGEMENT";
var grp_n_16=doc.layerSets.add();grp_n_16.name="05_STUDENT_PHOTOS";
var grp_n_17=doc.layerSets.add();grp_n_17.name="06_PROGRAMME";
var ly=addPointText(grp_n_17,"PROG_HEADING","SCHEDULE",["georgia","georgia","ArialMT"],24,14,255,255,255,540,743,348,"left",80,1.15);
ly.opacity=100;
var ly=addPointText(grp_n_17,"PROG_1","1. Prayer Song",["ALGER.TTF","ALGER.TTF","ArialMT"],21,13,255,255,255,540,804,398,"left",0,1.4);
ly.opacity=100;
var ly=addPointText(grp_n_17,"PROG_2","2. Pledge",["ALGER.TTF","ALGER.TTF","ArialMT"],21,13,255,255,255,540,842,398,"left",0,1.4);
ly.opacity=100;
var ly=addPointText(grp_n_17,"PROG_3","3. Thought for the Day",["ALGER.TTF","ALGER.TTF","ArialMT"],21,13,255,255,255,540,880,398,"left",0,1.4);
ly.opacity=100;
var ly=addPointText(grp_n_17,"PROG_4","4. News Headlines",["ALGER.TTF","ALGER.TTF","ArialMT"],21,13,255,255,255,540,918,398,"left",0,1.4);
ly.opacity=100;
var ly=addPointText(grp_n_17,"PROG_5","5. Word of the Day",["ALGER.TTF","ALGER.TTF","ArialMT"],21,13,255,255,255,540,956,398,"left",0,1.4);
ly.opacity=100;
var ly=addPointText(grp_n_17,"PROG_6","6. Quiz Question",["ALGER.TTF","ALGER.TTF","ArialMT"],21,13,255,255,255,540,994,398,"left",0,1.4);
ly.opacity=100;
var ly=addPointText(grp_n_17,"PROG_7","7. Birthday Wishes",["ALGER.TTF","ALGER.TTF","ArialMT"],21,13,255,255,255,540,1032,398,"left",0,1.4);
ly.opacity=100;
var ly=addPointText(grp_n_17,"PROG_8","8. Principal\u2019s Message",["ALGER.TTF","ALGER.TTF","ArialMT"],21,13,255,255,255,540,1070,398,"left",0,1.4);
ly.opacity=100;
var ly=addPointText(grp_n_17,"PROG_9","9. National Anthem",["ALGER.TTF","ALGER.TTF","ArialMT"],21,13,255,255,255,540,1108,398,"left",0,1.4);
ly.opacity=100;
var grp_n_28=doc.layerSets.add();grp_n_28.name="07_MESSAGE";
var ly=addPointText(grp_n_28,"MESSAGE","Students gathered for prayer, reflection and a positive beginning.",["ALGER.TTF","ALGER.TTF","ArialMT"],24,14,209,213,219,43,1148,398,"left",0,1.5);
ly.opacity=100;
var grp_n_30=doc.layerSets.add();grp_n_30.name="08_FOOTER";
var ly=shapeLayer(grp_n_30,"FOOTER_BAR",30,58,95,0,1242,1080,1350,0,false);
ly.opacity=100;
var ly=addPointText(grp_n_30,"FOOTER_PHONE","6300038389",["ALGER.TTF","ALGER.TTF","ArialMT"],18,11,255,255,255,43,1262,398,"left",0,1.2);
ly.opacity=100;
var ly=addPointText(grp_n_30,"FOOTER_ADDRESS","Ghanpur (M), Jayashankar Bhupalpally District",["ALGER.TTF","ALGER.TTF","ArialMT"],18,11,255,255,255,594,1262,398,"right",0,1.2);
ly.opacity=100;
var grp_n_34=doc.layerSets.add();grp_n_34.name="09_EFFECTS";
var psd=new File(out.fsName+'/poster.psd');doc.saveAs(psd,new PhotoshopSaveOptions(),true,Extension.LOWERCASE);
var jpg=new File(out.fsName+'/poster.jpg');var jo=new JPEGSaveOptions();jo.quality=12;jo.embedColorProfile=true;doc.saveAs(jpg,jo,true,Extension.LOWERCASE);
var png=new File(out.fsName+'/poster.png');var po=new PNGSaveOptions();po.compression=6;doc.saveAs(png,po,true,Extension.LOWERCASE);
writeResult(true,'Poster composed with '+doc.layers.length+' top groups.',psd.fsName,jpg.fsName,png.fsName);
}catch(e){writeResult(false,(e&&e.message)?e.message:String(e),'','','');}
finally{try{app.preferences.rulerUnits=prevRuler;app.preferences.typeUnits=prevType;}catch(eU){}if(doc){try{doc.close(SaveOptions.DONOTSAVECHANGES);}catch(eC){}}}
}());