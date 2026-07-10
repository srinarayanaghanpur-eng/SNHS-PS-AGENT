export function Notice({kind='info',children}:{kind?:'info'|'error'|'success';children:any}){return <div className={`notice ${kind}`}>{children}</div>}
