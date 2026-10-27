import { createHash, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { errors } from '../lib.js';

const DEFAULT_MAX_BYTES = 25 * 1024 * 1024;
const MAX_UPLOAD_CEILING_BYTES = 200 * 1024 * 1024;
const BLOCKED_EXTENSIONS = new Set(['.app', '.bat', '.cmd', '.dll', '.exe', '.js', '.msi', '.php', '.ps1', '.sh', '.vbs']);

export function maxUploadBytes() {
  const configured = Number(process.env.FILE_UPLOAD_MAX_BYTES || DEFAULT_MAX_BYTES);
  return Number.isInteger(configured) && configured > 0 ? Math.min(configured, MAX_UPLOAD_CEILING_BYTES) : DEFAULT_MAX_BYTES;
}

export function maxUploadCeilingBytes() {
  return MAX_UPLOAD_CEILING_BYTES;
}

export function allowedUploadExtensions() {
  return ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.mp3', '.wav', '.ogg', '.mp4', '.webm', '.pdf', '.txt', '.srt', '.zip', '.pptx', '.docx', '.xlsx'];
}

export function uploadRoot() {
  return path.resolve(process.env.FILE_UPLOAD_ROOT || path.join(process.cwd(), 'var', 'uploads'));
}

function parseDisposition(value) {
  const fileNameMatch = String(value || '').match(/filename="([^"]*)"/i);
  const nameMatch = String(value || '').match(/\bname="([^"]*)"/i);
  return { name: nameMatch?.[1] || '', fileName: fileNameMatch?.[1] };
}

export function parseMultipartFormData(body, contentType) {
  const boundaryMatch = String(contentType || '').match(/boundary=(?:"([^"]+)"|([^;\s]+))/i);
  const boundary = boundaryMatch?.[1] || boundaryMatch?.[2];
  if (!boundary || boundary.length > 200 || /[\0-\x20\x7f]/.test(boundary)) throw errors.badRequest('multipart boundary 无效', 'INVALID_MULTIPART');
  const marker = Buffer.from(`--${boundary}`);
  const result = { fields: {}, file: null };
  let cursor = 0;
  let parts = 0;
  while (cursor < body.length) {
    const start = body.indexOf(marker, cursor);
    if (start < 0) break;
    const after = start + marker.length;
    if (body[after] === 0x2d && body[after + 1] === 0x2d) break;
    if (body[after] !== 0x0d || body[after + 1] !== 0x0a) throw errors.badRequest('multipart 分段格式错误', 'INVALID_MULTIPART');
    const headerStart = after + 2;
    const headerEnd = body.indexOf(Buffer.from('\r\n\r\n'), headerStart);
    if (headerEnd < 0) throw errors.badRequest('multipart 分段格式错误', 'INVALID_MULTIPART');
    const bodyStart = headerEnd + 4;
    const next = body.indexOf(marker, bodyStart);
    if (next < 0) throw errors.badRequest('multipart 结束边界缺失', 'INVALID_MULTIPART');
    const headers = body.subarray(headerStart, headerEnd).toString('latin1');
    const disposition = headers.match(/^content-disposition:\s*([^\r\n]+)/im)?.[1];
    const { name, fileName } = parseDisposition(disposition || '');
    if (!name) throw errors.badRequest('multipart 字段名缺失', 'INVALID_MULTIPART');
    const value = body.subarray(bodyStart, Math.max(bodyStart, next - 2));
    parts += 1;
    if (parts > 20) throw errors.badRequest('multipart 字段过多', 'TOO_MANY_UPLOAD_PARTS');
    if (fileName !== undefined) {
      if (result.file) throw errors.badRequest('一次只能上传一个文件', 'TOO_MANY_FILES');
      const partMime = headers.match(/^content-type:\s*([^\r\n]+)/im)?.[1]?.trim() || '';
      result.file = { fieldName: name, fileName, mimeType: partMime, buffer: value };
    } else {
      result.fields[name] = value.toString('utf8').trim();
    }
    cursor = next;
  }
  if (!result.file || !result.file.buffer.length) throw errors.badRequest('必须选择文件', 'FILE_REQUIRED');
  return result;
}

export async function scanUploadBuffers() {
  return { scanner: 'disabled', status: 'SCANNER_DISABLED', scanned: 0 };
}

export async function persistSecureUpload({ fileName, mimeType, buffer }) {
  if (!Buffer.isBuffer(buffer)) throw errors.badRequest('文件内容无效', 'INVALID_FILE_CONTENT');
  if (!buffer.length) throw errors.badRequest('不能上传空文件', 'EMPTY_FILE');
  if (buffer.length > maxUploadBytes()) throw errors.badRequest('文件过大', 'FILE_TOO_LARGE');
  const safeName = path.basename(String(fileName || 'upload.bin')).replace(/[^\w.\-()\u4e00-\u9fff]/g, '_');
  const extension = path.extname(safeName).toLowerCase();
  if (BLOCKED_EXTENSIONS.has(extension)) throw errors.badRequest('不允许上传该文件类型', 'FILE_TYPE_BLOCKED');
  const now = new Date();
  const relative = path.join(String(now.getUTCFullYear()), String(now.getUTCMonth() + 1).padStart(2, '0'), `${randomUUID()}${extension}`);
  const root = uploadRoot();
  const absolute = path.resolve(root, relative);
  if (!absolute.startsWith(root + path.sep)) throw errors.badRequest('存储路径无效', 'INVALID_STORAGE_PATH');
  await mkdir(path.dirname(absolute), { recursive: true, mode: 0o750 });
  await writeFile(absolute, buffer, { flag: 'wx', mode: 0o640 });
  return {
    storageKey: relative.replaceAll(path.sep, '/'),
    storageBackend: 'local',
    storagePath: absolute,
    fileName: safeName,
    mimeType: String(mimeType || 'application/octet-stream'),
    fileSize: buffer.length,
    checksum: createHash('sha256').update(buffer).digest('hex'),
    security: { signature: 'mock-bypass', scanner: 'disabled', status: 'SCANNER_DISABLED' },
  };
}