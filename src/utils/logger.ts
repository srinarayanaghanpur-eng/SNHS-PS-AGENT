export interface LogEntry { at:string; level:'info'|'warn'|'error'; operation:string; message:string }
const entries:LogEntry[]=[];
export function log(level:LogEntry['level'],operation:string,message:string){ entries.unshift({at:new Date().toISOString(),level,operation,message}); if(entries.length>300)entries.pop(); console[level==='error'?'error':level](operation,message); }
export function getLogs(){return [...entries]}
export function clearLogs(){entries.length=0}
