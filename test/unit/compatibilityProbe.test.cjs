const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const policy = require('../../out/probePolicy');

async function runProbe({ accept = true, data = async () => new Uint8Array([1]), invalidate = false, cancelDuringRead = false } = {}) {
  let provider;
  let reads = 0;
  let prompts = 0;
  const logs = [];
  const disposable = () => ({ dispose() {} });
  const document = { languageId: 'markdown', uri: { scheme: 'file' },
    fileName: 'test.md', isUntitled: false, version: 1, isClosed: false };
  const token = { isCancellationRequested: false, onCancellationRequested: disposable };
  const vscode = {
    version: 'test', env: {},
    DocumentDropOrPasteEditKind: { Empty: { append: () => ({}) } },
    DocumentPasteEdit: class { constructor(insertText) { this.insertText = insertText; } },
    window: {
      createOutputChannel: () => ({ appendLine: line => logs.push(JSON.parse(line)), dispose() {} }),
      showWarningMessage: () => { throw Error('Offering must not show notifications'); },
      createInputBox: () => {
        prompts++;
        let accepted, hidden;
        return { value: 'name', dispose() {},
          onDidAccept: callback => { accepted = callback; return disposable(); },
          onDidHide: callback => { hidden = callback; return disposable(); },
          show: () => queueMicrotask(() => accept ? accepted() : hidden()),
        };
      },
    },
    workspace: { getWorkspaceFolder: () => ({ uri: { scheme: 'file' } }),
      onDidChangeTextDocument: disposable, onDidCloseTextDocument: disposable },
    languages: { registerDocumentPasteEditProvider: (_selector, value) => {
      provider = value; return disposable();
    } },
  };
  const sandbox = { exports: {}, process, require: name => name === 'vscode' ? vscode : policy };
  vm.runInNewContext(fs.readFileSync('out/compatibilityProbe.js', 'utf8'), sandbox);
  sandbox.exports.registerCompatibilityProbe({ subscriptions: [] });
  const file = { data: async () => {
    reads++;
    const result = await data();
    if (invalidate) { document.version++; }
    if (cancelDuringRead) { token.isCancellationRequested = true; }
    return result;
  } };
  const item = { asFile: () => file };
  const transfer = new Map([['image/png', item]]);
  const edits = await provider.provideDocumentPasteEdits(document, [{}], transfer, { triggerKind: 0 }, token);
  assert.equal(reads, 1, 'bytes must be read before the provider returns');
  assert.equal(prompts, 0, 'offering never prompts');
  if (!edits) { return { edit: undefined, reads, logs, prompts }; }
  // Model VS Code releasing clipboard access before edit resolution.
  file.data = async () => { throw Error('clipboard cache released'); };
  const edit = await provider.resolveDocumentPasteEdit(edits[0], token);
  return { edit, reads, logs, prompts };
}

test('accepted probe reads bytes once and retains marker', async () => {
  const result = await runProbe();
  assert.equal(result.reads, 1);
  assert.equal(result.edit.insertText, '[image paste compatibility probe]');
  assert.equal(result.logs.find(x => x.event === 'image-bytes-read').byteLength, 1);
});
test('cancelled prompt inserts no marker and does not reread clipboard', async () => {
  const result = await runProbe({ accept: false });
  assert.equal(result.reads, 1);
  assert.equal(result.edit.insertText, '');
});
test('empty, rejected and invalidated reads never insert marker', async () => {
  for (const options of [{ data: async () => new Uint8Array() },
    { data: async () => { throw Error('read failure'); } }, { invalidate: true }, { cancelDuringRead: true }]) {
    const result = await runProbe(options);
    assert.equal(result.reads, 1);
    assert.equal(result.edit, undefined);
    assert.equal(result.prompts, 0);
  }
});
