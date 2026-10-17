import * as path from 'node:path';

export function resolveDestination(root: string, value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) { throw new Error('Destination must be a nonempty relative folder.'); }
  if (value.includes('\\') || /^[a-z][a-z0-9+.-]*:/i.test(value)
    || path.posix.isAbsolute(value) || path.win32.isAbsolute(value)
    || /[\x00-\x1f<>:"|?*]/.test(value)) {
    throw new Error('Use a workspace-relative folder with / separators, not an absolute path or URI.');
  }
  const target = path.resolve(root, value);
  const relative = path.relative(root, target);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error('Destination must stay inside the workspace folder.');
  }
  return target;
}
