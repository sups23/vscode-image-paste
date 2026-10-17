const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const vm = require('node:vm');
const { resolveDestination } = require('../../out/configurationPolicy');
test('destination resolves only portable workspace-contained paths', () => {
  assert.equal(resolveDestination('/workspace', 'qa/screenshots'), path.resolve('/workspace/qa/screenshots'));
  for (const value of ['', ' ', '../outside', '/outside', 'C:/outside', 'file:///outside', 'qa\\images', null, 'qa\0images']) {
    assert.throws(() => resolveDestination('/workspace', value));
  }
});
test('actual read-only helper respects enabled includes and excludes', () => {
  const values = {};
  const vscode = { workspace: { getConfiguration: () => ({ get: key => values[key] ?? {} }) },
    RelativePattern: class { constructor(_folder, pattern) { this.pattern = pattern; } },
    languages: { match: selector => ['**/*.md', 'docs/**'].includes(selector.pattern.pattern) ? 10 : 0 } };
  const sandbox = { exports: {}, require: name => name === 'vscode' ? vscode
    : name === './probePolicy' ? require('../../out/probePolicy')
      : name === './configurationPolicy' ? require('../../out/configurationPolicy') : require('../../out/fileUtils') };
  vm.runInNewContext(fs.readFileSync('out/configuration.js', 'utf8'), sandbox);
  const check = () => sandbox.exports.isConfiguredReadOnly({ uri: {} }, {});
  assert.equal(check(), false);
  values.readonlyInclude = { '**/*.md': true };
  assert.equal(check(), true);
  values.readonlyExclude = { 'docs/**': true };
  assert.equal(check(), false);
  values.readonlyExclude = { 'docs/**': false };
  assert.equal(check(), true);
  values.readonlyInclude = { '**/*.md': false, '*.txt': true };
  assert.equal(check(), false);
});
