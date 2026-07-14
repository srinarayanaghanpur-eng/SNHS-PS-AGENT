import { IncomingMessage, ServerResponse } from 'node:http';
import { dataDir, readText, writeText, readBinary, writeBinary, listDir, deleteEntry, copyEntry, ensureDir, join } from '../storage/fileSystemBridge';
import { existsSync } from 'node:fs';
import { join as pathJoin, dirname } from 'node:path';

async function parseBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: Buffer) => body += chunk.toString());
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

async function parseFormData(req: IncomingMessage): Promise<{ fields: Record<string, string>; files: Record<string, { name: string; data: Buffer }> }> {
  const contentType = req.headers['content-type'] || '';
  if (!contentType.includes('multipart/form-data')) {
    const body = await parseBody(req);
    return { fields: body, files: {} };
  }
  return new Promise((resolve, reject) => {
    const boundary = contentType.split('boundary=')[1];
    if (!boundary) { reject(new Error('No boundary')); return; }
    const Busboy = require('busboy');
    const bb = Busboy({ headers: { 'content-type': contentType } });
    const fields: Record<string, string> = {};
    const files: Record<string, { name: string; data: Buffer }> = {};
    bb.on('field', (name: string, val: string) => fields[name] = val);
    bb.on('file', (name: string, stream: any, info: any) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => files[name] = { name: info.filename, data: Buffer.concat(chunks) });
    });
    bb.on('finish', () => resolve({ fields, files }));
    req.pipe(bb);
  });
}

function json(res: ServerResponse, data: any, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

export async function handleStorageApi(req: IncomingMessage, res: ServerResponse, path: string): Promise<boolean> {
  if (!path.startsWith('/api/fs/')) return false;
  const endpoint = path.slice('/api/fs/'.length);

  if (endpoint === 'upload' && req.method === 'POST') {
    const { fields, files } = await parseFormData(req);
    const targetDir = fields.dir || dataDir();
    const results: any[] = [];
    for (const [key, file] of Object.entries(files)) {
      const dstPath = pathJoin(targetDir, file.name);
      writeBinary(dstPath, new Uint8Array(file.data));
      results.push({ field: key, name: file.name, size: file.data.length, path: dstPath });
    }
    json(res, { files: results });
    return true;
  }

  const body = await parseBody(req);

  switch (endpoint) {
    case 'data-dir': {
      json(res, { path: dataDir() });
      return true;
    }
    case 'read-text': {
      const { path } = body;
      if (!existsSync(path)) { json(res, { error: 'File not found' }, 404); return true; }
      json(res, { content: readText(path) });
      return true;
    }
    case 'write-text': {
      const { path, content } = body;
      if (!path) { json(res, { error: 'path required' }, 400); return true; }
      writeText(path, content);
      json(res, { success: true });
      return true;
    }
    case 'read-binary': {
      const { path } = body;
      if (!existsSync(path)) { json(res, { error: 'File not found' }, 404); return true; }
      const data = readBinary(path);
      res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': data.length });
      res.end(Buffer.from(data));
      return true;
    }
    case 'write-binary': {
      const { path, data } = body;
      if (!path) { json(res, { error: 'path required' }, 400); return true; }
      const bytes = new Uint8Array(Buffer.from(data, 'base64'));
      writeBinary(path, bytes);
      json(res, { success: true, bytes: bytes.length });
      return true;
    }
    case 'list': {
      const { path } = body;
      const entries = listDir(path || dataDir());
      json(res, { entries });
      return true;
    }
    case 'delete': {
      const { path } = body;
      deleteEntry(path);
      json(res, { success: true });
      return true;
    }
    case 'copy': {
      const { src, dst } = body;
      copyEntry(src, dst);
      json(res, { success: true });
      return true;
    }
    case 'exists': {
      const { path } = body;
      json(res, { exists: existsSync(path) });
      return true;
    }
    default:
      return false;
  }
}
