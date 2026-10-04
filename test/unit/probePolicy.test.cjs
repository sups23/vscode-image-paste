const { test } = require('node:test');
const assert = require('node:assert/strict');
const { preferredMime, eligibleDocument } = require('../../out/probePolicy');

test('representations prefer PNG, then JPEG, then WebP', () => {
  assert.equal(preferredMime(['image/webp', 'image/jpeg', 'image/png']), 'image/png');
  assert.equal(preferredMime(['image/webp', 'image/jpeg']), 'image/jpeg');
  assert.equal(preferredMime(['image/webp']), 'image/webp');
  assert.equal(preferredMime(['text/plain', 'image/gif']), undefined);
});
test('output documents cannot trigger recursive logging', () => {
  assert.equal(eligibleDocument({ language: 'Log', scheme: 'output',
    filename: 'Markdown Image Paste Probe', untitled: false,
    localWorkspace: false, remote: false }), false);
});
test('only saved local workspace Markdown .md documents qualify', () => {
  const valid = { language: 'markdown', scheme: 'file', filename: 'TEST.MD',
    untitled: false, localWorkspace: true, remote: false };
  assert.equal(eligibleDocument(valid), true);
  for (const change of [{ language: 'text' }, { scheme: 'vscode-remote' },
    { filename: 'test.txt' }, { untitled: true }, { localWorkspace: false }, { remote: true }]) {
    assert.equal(eligibleDocument({ ...valid, ...change }), false);
  }
});
