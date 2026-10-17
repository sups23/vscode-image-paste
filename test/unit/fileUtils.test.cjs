const { test } = require('node:test');
const assert = require('node:assert/strict');
const { extensionForMime, validateFilenameStem, validateGeneratedPath, buildNumberedFilename, buildMarkdownReference } = require('../../out/fileUtils');
test('portable stems and literal format suffixes', () => {
  assert.equal(validateFilenameStem(' photo.jpg '), 'photo.jpg');
  assert.equal(buildNumberedFilename('photo.jpg', extensionForMime('image/png'), 1), 'photo.jpg-1.png');
  assert.equal(extensionForMime('image/jpeg'), '.jpg');
  assert.equal(extensionForMime('image/webp'), '.webp');
  assert.throws(() => extensionForMime('image/gif'));
  for (const stem of ['', '..', '../x', 'a\\b', 'CON', 'nul.jpg', 'COM¹', 'a.', 'a?', 'a\0']) {
    assert.throws(() => validateFilenameStem(stem));
  }
});
test('candidate limits include suffixes and UTF8 bytes', () => {
  validateGeneratedPath('/images/' + 'a'.repeat(251) + '.png');
  assert.throws(() => validateGeneratedPath('/images/' + 'a'.repeat(251) + '-1.png'));
  assert.throws(() => validateGeneratedPath('/images/' + '🙂'.repeat(64) + '.png'));
});
test('relative links encode raw path segments once', () => {
  assert.equal(buildMarkdownReference('/project/docs/test.md', '/project/qa/a #%(图).png'),
    '![](../qa/a%20%23%25%28%E5%9B%BE%29.png)');
});
