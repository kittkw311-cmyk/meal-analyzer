import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

const DEFAULT_DRIVE_TIMEOUT_MS = 15000;

function getDriveTimeoutMs() {
  const parsed = Number(process.env.GOOGLE_DRIVE_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_DRIVE_TIMEOUT_MS;
}

function withTimeout(promise, label, timeoutMs = getDriveTimeoutMs()) {
  let timerId;
  const timeoutPromise = new Promise((_, reject) => {
    timerId = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([
    Promise.resolve(promise).finally(() => clearTimeout(timerId)),
    timeoutPromise,
  ]);
}

function cloneValue(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function ensureParentDirectory(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function ensureJsonFile(filePath, defaultValue) {
  ensureParentDirectory(filePath);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
  }
}

export function ensureTextFile(filePath, defaultText = '') {
  ensureParentDirectory(filePath);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, defaultText);
  }
}

export function readJsonFile(filePath, fallbackValue, normalize = value => value) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw || JSON.stringify(fallbackValue));
    return normalize(parsed);
  } catch {
    return normalize(cloneValue(fallbackValue));
  }
}

export function writeJsonFile(filePath, value) {
  ensureParentDirectory(filePath);
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

export function readTextFile(filePath, fallbackText = '', normalize = value => value) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return normalize(raw);
  } catch {
    return normalize(fallbackText);
  }
}

export function writeTextFile(filePath, text) {
  ensureParentDirectory(filePath);
  fs.writeFileSync(filePath, text);
}

function escapeDriveQueryValue(value) {
  return String(value).replace(/'/g, "\\'");
}

function toReadableBody(content) {
  if (content instanceof Readable) return content;
  if (Buffer.isBuffer(content)) return Readable.from([content]);
  return Readable.from([String(content)]);
}

export async function findDriveFileByName({ drive, folderId, fileName }) {
  if (!drive || !folderId) return null;
  const result = await withTimeout(drive.files.list({
    q: `name = '${escapeDriveQueryValue(fileName)}' and '${folderId}' in parents and trashed = false`,
    fields: 'files(id)',
    spaces: 'drive',
  }), `Drive lookup for ${fileName}`);
  return result.data.files?.[0]?.id || null;
}

export async function createDriveFile({ drive, folderId, fileName, mimeType, body }) {
  const result = await withTimeout(drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
      mimeType,
    },
    media: {
      mimeType,
      body: toReadableBody(body),
    },
    fields: 'id',
  }), `Drive create for ${fileName}`);
  return result.data.id;
}

export async function ensureDriveFileByName({ drive, folderId, fileName, mimeType, body }) {
  const fileId = await findDriveFileByName({ drive, folderId, fileName });
  if (fileId) {
    return { fileId, created: false };
  }
  const createdFileId = await createDriveFile({ drive, folderId, fileName, mimeType, body });
  return { fileId: createdFileId, created: true };
}

export async function readDriveTextFile({ drive, fileId }) {
  const result = await withTimeout(drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'text' }
  ), `Drive read for ${fileId}`);
  return typeof result.data === 'string' ? result.data : String(result.data || '');
}

export async function writeDriveTextFile({ drive, fileId, mimeType, body }) {
  await withTimeout(drive.files.update({
    fileId,
    media: {
      mimeType,
      body: toReadableBody(body),
    },
  }), `Drive write for ${fileId}`);
}

export function getMimeTypeFromFilePath(filePath, fallback = 'image/jpeg') {
  const ext = path.extname(filePath || '').toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.webp') return 'image/webp';
  return fallback;
}

export async function readStoredImage({ drive, imageSource, imageId, localDir }) {
  if (!imageSource || !imageId) return null;

  if (imageSource === 'drive' && drive) {
    const meta = await withTimeout(drive.files.get({ fileId: imageId, fields: 'mimeType' }), `Drive image meta for ${imageId}`);
    const mimeType = meta.data.mimeType || 'image/jpeg';
    const driveResponse = await withTimeout(drive.files.get(
      { fileId: imageId, alt: 'media' },
      { responseType: 'stream' }
    ), `Drive image read for ${imageId}`);
    const chunks = [];
    for await (const chunk of driveResponse.data) {
      chunks.push(chunk);
    }
    return {
      buffer: Buffer.concat(chunks),
      mimeType,
    };
  }

  if (imageSource === 'local') {
    const filePath = path.join(localDir, imageId);
    if (!fs.existsSync(filePath)) return null;
    return {
      buffer: fs.readFileSync(filePath),
      mimeType: getMimeTypeFromFilePath(filePath),
    };
  }

  return null;
}

export async function saveBinaryFileToDriveOrLocal({
  drive,
  folderId,
  localDir,
  fileName,
  buffer,
  mimeType,
}) {
  let driveError = null;
  const driveAttempted = Boolean(drive && folderId);

  if (drive && folderId) {
    try {
      const fileId = await createDriveFile({
        drive,
        folderId,
        fileName,
        mimeType,
        body: buffer,
      });
      return { imageSource: 'drive', imageId: fileId, driveAttempted, driveError };
    } catch (err) {
      driveError = err;
      // Fall back to local storage below.
    }
  }

  ensureParentDirectory(path.join(localDir, fileName));
  const localPath = path.join(localDir, fileName);
  fs.writeFileSync(localPath, buffer);
  return { imageSource: 'local', imageId: fileName, driveAttempted, driveError };
}

export async function deleteStoredFile({
  drive,
  imageSource,
  imageId,
  localDir,
}) {
  if (!imageSource || !imageId) return false;

  if (imageSource === 'drive' && drive) {
    await withTimeout(drive.files.delete({ fileId: imageId }), `Drive delete for ${imageId}`);
    return true;
  }

  if (imageSource === 'local') {
    const filePath = path.join(localDir, imageId);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
  }

  return false;
}
