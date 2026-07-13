export class PluginError extends Error {
  constructor(public code:string, message:string, public solution:string, public cause?:unknown) { super(message); this.name='PluginError'; }
}
export function explainError(error:unknown, operation:string):PluginError {
  if (error instanceof PluginError) return error;
  const message=error instanceof Error?error.message:String(error);
  return new PluginError('OPERATION_FAILED',`${operation}: ${message}`,'Check that the document and target layer are available, unlocked, and supported.',error);
}
