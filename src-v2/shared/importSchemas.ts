import { z } from 'zod';

export const supportedReferenceExtensions = ['jpg', 'jpeg', 'png', 'webp', 'psd', 'pdf'] as const;
export type SupportedReferenceExtension = typeof supportedReferenceExtensions[number];

export const importRequestSchema = z.object({
  sourcePath: z.string().min(1).max(32_767),
}).strict();

export const importedFileSchema = z.object({
  jobId: z.string().regex(/^import-[a-f0-9-]+$/),
  path: z.string().min(1),
  filename: z.string().min(1),
  extension: z.enum(supportedReferenceExtensions),
  size: z.number().int().positive(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
}).strict();

export type ImportedFile = z.infer<typeof importedFileSchema>;

export function assertPlainSerializable(value: unknown): void {
  const seen = new Set<object>();
  const visit = (item: unknown, path: string): void => {
    if (item === null || ['string', 'number', 'boolean', 'undefined'].includes(typeof item)) return;
    if (typeof item !== 'object') throw new Error(`IPC_NON_SERIALIZABLE at ${path}`);
    if (Buffer.isBuffer(item) || item instanceof ArrayBuffer || ArrayBuffer.isView(item)) {
      throw new Error(`IPC_BINARY_REJECTED at ${path}`);
    }
    const object = item as object;
    if (seen.has(object)) throw new Error(`IPC_CIRCULAR_REJECTED at ${path}`);
    const prototype = Object.getPrototypeOf(object);
    if (prototype !== Object.prototype && prototype !== Array.prototype && prototype !== null) {
      throw new Error(`IPC_NATIVE_OBJECT_REJECTED at ${path}`);
    }
    seen.add(object);
    if (Array.isArray(object)) object.forEach((child, index) => visit(child, `${path}[${index}]`));
    else Object.entries(object).forEach(([key, child]) => visit(child, `${path}.${key}`));
    seen.delete(object);
  };
  visit(value, '$');
}
