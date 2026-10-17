const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { saveImageExclusive, validateDestinationRoute, ImageSaveError } = require('../../out/fileUtils');

async function fixture(t) {
  await fs.mkdir('.probe-data', { recursive: true });
  const root = await fs.mkdtemp(path.resolve('.probe-data/image-paste-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return { root, destination: path.join(root, 'qa/images'), stem: 'photo.jpg',
    extension: '.png', bytes: new Uint8Array([1, 2, 3]), isCurrent: () => true };
}
test('exclusive collisions and concurrent saves never overwrite entries', async t => {
  const input = await fixture(t);
  const first = await saveImageExclusive(input);
  await fs.mkdir(path.join(input.destination, 'photo.jpg-1.png'));
  await fs.symlink(first.path, path.join(input.destination, 'photo.jpg-2.png'));
  const results = await Promise.all([saveImageExclusive(input), saveImageExclusive(input)]);
  assert.equal(new Set(results.map(x => x.path)).size, 2);
  assert.deepEqual(results.map(x => path.basename(x.path)).sort(), ['photo.jpg-3.png', 'photo.jpg-4.png']);
  assert.deepEqual([...await fs.readFile(first.path)], [1, 2, 3]);
});
test('destination symlinks and escaping routes are rejected without writes', async t => {
  const input = await fixture(t);
  await fs.symlink(input.root, path.join(input.root, 'link'));
  await assert.rejects(validateDestinationRoute(input.root, path.join(input.root, 'link/images')));
  await assert.rejects(validateDestinationRoute(input.root, path.join(input.root, '../outside')));
});
test('cancelled operation creates no directory', async t => {
  const input = await fixture(t);
  await assert.rejects(saveImageExclusive({ ...input, isCurrent: () => false }));
  await assert.rejects(fs.stat(input.destination), { code: 'ENOENT' });
});
test('failed write or close retains identified artifact and closes handle', async t => {
  const input = await fixture(t);
  for (const failClose of [false, true]) {
    let closed = false;
    const open = async (...args) => {
      const real = await fs.open(...args);
      return { writeFile: async bytes => {
        await real.writeFile(bytes.subarray(0, 1));
        if (!failClose) { throw Error('injected write failure'); }
      }, close: async () => {
        closed = true; await real.close(); if (failClose) { throw Error('injected close failure'); }
      } };
    };
    let failure;
    try { await saveImageExclusive(input, open); } catch (error) { failure = error; }
    assert.ok(failure instanceof ImageSaveError);
    assert.ok(closed);
    assert.equal((await fs.readFile(failure.artifactPath)).length, 1);
  }
});
