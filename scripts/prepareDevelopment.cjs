const fs = require('node:fs');
const path = require('node:path');
const folder = path.join(__dirname, '..', '.probe-data', 'workspace');
fs.mkdirSync(folder, { recursive: true });
try {
  fs.writeFileSync(path.join(folder, 'test.md'), '# Image paste test\n\nPaste below.\n', { flag: 'wx' });
} catch (error) {
  if (error.code !== 'EEXIST') { throw error; }
}
