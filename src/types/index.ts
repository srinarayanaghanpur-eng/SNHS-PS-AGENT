export type SemanticRole =
  | 'school_logo' | 'school_name' | 'school_address' | 'school_phone' | 'poster_title'
  | 'poster_subtitle' | 'event_name' | 'event_date' | 'event_description' | 'academic_year'
  | 'student_name' | 'student_class' | 'student_photo' | 'birthday_photo' | 'birthday_name'
  | 'achievement_photo' | 'achievement_name' | 'teacher_photo' | 'chairman_photo'
  | 'principal_photo' | 'background' | 'decorative_element' | 'icon' | 'footer'
  | 'powered_by_lead' | 'contact_information' | 'social_media' | 'event_image'
  | 'optional_section' | 'repeated_student_card' | 'unknown';
export type LayerType = 'group'|'text'|'pixel'|'smartObject'|'shape'|'adjustment'|'background'|'other';
export interface Rect { left:number; top:number; right:number; bottom:number; width:number; height:number }
export interface TextMetadata { contents:string; font?:string; size?:number; alignment?:string; color?:string; leading?:number; pointText?:boolean }
export interface LayerSnapshot {
  layerId:number; name:string; path:string; parentPath:string|null; parentGroup:string|null; depth:number;
  type:LayerType; bounds:Rect; boundsNoEffects:Rect; visible:boolean; opacity:number; blendMode:string;
  locked:boolean; locks:{all:boolean;pixels:boolean;position:boolean;transparent:boolean}; clipping:boolean;
  masks:{pixel:boolean;vector:boolean;filter:boolean}; smartObject:boolean; text?:TextMetadata;
  children:LayerSnapshot[]; childIds:number[]; siblingIds:number[]; zIndex:number;
}
export interface ClassifiedLayer extends LayerSnapshot { semanticRole:SemanticRole; confidence:number; reasons:string[]; optional:boolean; repeatable:boolean; conflict?:boolean }
export interface TemplateManifest {
  schemaVersion:1; templateId:string; templateName:string; sourceFilename:string; documentWidth:number;
  documentHeight:number; resolution:number; createdAt:string; updatedAt:string; fingerprint:string;
  layers:ClassifiedLayer[]; hierarchy:ClassifiedLayer[]; reviewLayerIds:number[]; tagged:boolean;
}
export interface AnalysisResult { manifest:TemplateManifest; reused:boolean; warnings:string[] }
export interface StudentRecord { name:string; className:string; photo?:FileRef }
export interface FileRef { name:string; entry:any }
export type EventMode='prayer'|'birthday'|'achievement'|'dance'|'karate'|'sports'|'examination'|'holiday'|'festival'|'admissions'|'notice'|'teacher'|'special'|'custom';
export interface PosterData { mode:EventMode; values:Record<string,string>; students:StudentRecord[]; files:Record<string,FileRef|undefined>; exportFormats:ExportFormat[]; exportFolder?:any }
export type ExportFormat='png'|'jpeg'|'psd'|'square'|'portrait'|'display'|'a4';
export interface OperationWarning { operation:string; message:string; solution:string; layerId?:number }
export interface QualityIssue { code:string; severity:'error'|'warning'; message:string; layerId?:number }
export interface QualityReport { score:number; label:'Excellent'|'Good'|'Needs Review'; issues:QualityIssue[] }
export interface GenerationResult { documentName:string; exports:string[]; quality:QualityReport; warnings:OperationWarning[] }
export interface AssetRecord { id:string; name:string; category:string; path:string; extension:string; license?:string; source?:string; entry:any }
