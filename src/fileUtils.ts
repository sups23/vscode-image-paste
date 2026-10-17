import * as path from 'node:path';
import * as fs from 'node:fs/promises';

export function extensionForMime(mime: string): string {
  const extension = ({ 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp' } as Record<string, string>)[mime];
  if (!extension) { throw new Error('Unsupported image format.'); }
  return extension;
}

export function validateFilenameStem(input: string): string {
  const stem = input.trim();
  if (!stem || /[\x00-\x1f\x7f<>:"/\\|?*]/.test(stem) || stem === '.' || stem === '..'
    || stem.endsWith('.') || /^(con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i.test(stem)) {
    throw new Error('Enter a filename without separators, reserved names, control characters, or a trailing dot.');
  }
  return stem;
}

export function validateGeneratedPath(candidate: string): void {
  const filename = path.basename(candidate);
  if (Buffer.byteLength(filename, 'utf8') > 255 || filename.length > 255) {
    throw new Error('Filename is too long including its extension or collision suffix. Enter a shorter stem.');
  }
  // Conservative supported budgets, not claims about every filesystem's maximum.
  const overLimit = process.platform === 'win32' ? candidate.length > 240
    : Buffer.byteLength(candidate, 'utf8') > (process.platform === 'darwin' ? 1023 : 4095);
  if (overLimit) { throw new Error('Full image path is too long. Use a shorter stem or destination.'); }
}

export function buildNumberedFilename(stem: string, extension: string, index: number): string {
  return `${stem}${index ? `-${index}` : ''}${extension}`;
}

export function buildMarkdownReference(documentPath: string, imagePath: string): string {
  const relative = path.relative(path.dirname(documentPath), imagePath);
  if (path.isAbsolute(relative)) { throw new Error('Cannot generate a relative image reference.'); }
  const encoded = relative.split(path.sep).map(segment => segment === '..' ? segment
    : encodeURIComponent(segment).replace(/[!'()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)).join('/');
  return `![](${encoded})`;
}

function hasCode(error: unknown, code: string): boolean {
  return !!error && typeof error === 'object' && 'code' in error && error.code === code;
}

export async function validateDestinationRoute(root: string, destination: string): Promise<string> {
  const relative = path.relative(root, destination);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error('Destination escapes the workspace.');
  }
  const actualRoot = await fs.realpath(root);
  let current = actualRoot;
  for (const component of relative.split(path.sep).filter(Boolean)) {
    validateFilenameStem(component);
    current = path.join(current, component);
    try {
      const stat = await fs.lstat(current);
      if (stat.isSymbolicLink() || !stat.isDirectory()) {
        throw new Error('Destination components must be directories, not symlinks or junctions.');
      }
    } catch (error) {
      if (!hasCode(error, 'ENOENT')) { throw error; }
      // Descendants cannot yet exist; do not create them during validation.
    }
  }
  return current;
}

export class ImageSaveError extends Error {
  constructor(message: string, public readonly artifactPath?: string) { super(message); }
}

export interface ImageSaveResult { path: string; }

export async function saveImageExclusive(input: {
  root: string; destination: string; stem: string; extension: string; bytes: Uint8Array;
  isCurrent: () => boolean;
}, openFile: typeof fs.open = fs.open): Promise<ImageSaveResult> {
  const stem = validateFilenameStem(input.stem);
  if (!input.bytes.byteLength) { throw new ImageSaveError('Clipboard image is empty.'); }
  const assertCurrent = (): void => {
    if (!input.isCurrent()) { throw new ImageSaveError('Paste cancelled or original document changed.'); }
  };
  assertCurrent();
  const destination = await validateDestinationRoute(input.root, input.destination);
  validateGeneratedPath(path.join(destination, buildNumberedFilename(stem, input.extension, 0)));
  assertCurrent();
  await fs.mkdir(destination, { recursive: true });
  await validateDestinationRoute(input.root, input.destination);
  for (let index = 0; index < Number.MAX_SAFE_INTEGER; index++) {
    assertCurrent();
    const candidate = path.join(destination, buildNumberedFilename(stem, input.extension, index));
    validateGeneratedPath(candidate);
    await validateDestinationRoute(input.root, input.destination);
    assertCurrent();
    let handle: fs.FileHandle;
    try { handle = await openFile(candidate, 'wx'); }
    catch (error) {
      if (hasCode(error, 'EEXIST')) { continue; }
      // Some platforms report directories differently; inspect without following links.
      try { await fs.lstat(candidate); continue; }
      catch (inspection) { if (!hasCode(inspection, 'ENOENT')) { throw error; } }
      throw error;
    }
    let failure: unknown;
    try { await handle.writeFile(input.bytes); }
    catch (error) { failure = error; }
    try { await handle.close(); }
    catch (error) { failure ??= error; }
    if (failure) {
      throw new ImageSaveError('Image write failed; an incomplete artifact was retained.', candidate);
    }
    return { path: candidate };
  }
  throw new ImageSaveError('No available numbered filename.');
}
