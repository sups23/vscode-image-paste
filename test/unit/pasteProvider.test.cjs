const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

async function scenario({ cancel = false, invalidate = false, fail = false, noWorkspace = false, readOnly = false, restrictDuringPrompt = false, staleAfterSave = false } = {}) {
  let saves = 0, prompts = 0, reads = 0, changed;
  const notifications = [];
  const disposable = () => ({ dispose() {} });
  const document = { uri: { fsPath: '/root/docs/test.md', toString: () => 'file:///root/docs/test.md' },
    version: 1, isClosed: false, languageId: 'markdown', fileName: '/root/docs/test.md' };
  document.uri.scheme = 'file';
  const token = { isCancellationRequested: false, onCancellationRequested: disposable };
  const vscode = {
    env: {},
    DocumentPasteEdit: class { constructor(insertText) { this.insertText = insertText; } },
    WorkspaceEdit: class { set(uri, edits) { this.uri = uri; this.edits = edits; } },
    SnippetTextEdit: { replace: (range, snippet) => ({ range, snippet }) },
    SnippetString: class {
      value = '';
      appendText(text) { this.value += text.replace(/[\\$}]/g, '\\$&'); return this; }
      appendTabstop(index) { this.value += `$${index}`; return this; }
    },
    DocumentDropOrPasteEditKind: { Empty: { append: () => ({}) } },
    window: {
      showErrorMessage: text => notifications.push(text),
      showInformationMessage: text => notifications.push(text),
      showWarningMessage: text => notifications.push(text),
      createInputBox: () => {
        prompts++;
        let accept, hide;
        return { value: 'photo', dispose() {}, onDidChangeValue: disposable,
          onDidAccept: fn => { accept = fn; return disposable(); },
          onDidHide: fn => { hide = fn; return disposable(); },
          show: () => queueMicrotask(() => {
            if (restrictDuringPrompt) { readOnly = true; }
            if (invalidate) { document.version++; changed({ document }); }
            else if (cancel) { hide(); } else { accept(); }
          }) };
      },
    },
    workspace: { getWorkspaceFolder: () => undefined, onDidChangeTextDocument: fn => { changed = fn; return disposable(); },
      onDidCloseTextDocument: disposable, onDidRenameFiles: disposable },
  };
  const utilities = { ...require('../../out/fileUtils'), validateDestinationRoute: async () => '/root/qa',
    saveImageExclusive: async input => {
      saves++;
      assert.ok(input.isCurrent());
      if (fail) { throw Error('injected write failure'); }
      return { path: '/root/qa/photo.png' };
    } };
  const configuration = { getEligibleWorkspace: () => noWorkspace ? undefined : ({ uri: { fsPath: '/root' } }),
    isConfiguredReadOnly: () => readOnly,
    readDestination: () => '/root/qa' };
  const mockFs = { access: async () => undefined,
    lstat: async () => { throw Object.assign(Error(), { code: 'ENOENT' }); } };
  const sandbox = { exports: {}, require: name => name === 'vscode' ? vscode
    : name === './configuration' ? configuration : name === './fileUtils' ? utilities
      : name === './probePolicy' ? require('../../out/probePolicy')
        : name === 'node:fs/promises' ? mockFs : require(name) };
  vm.runInNewContext(fs.readFileSync('out/pasteProvider.js', 'utf8'), sandbox);
  const provider = new sandbox.exports.MarkdownImagePasteProvider();
  const transfer = new Map([['image/png', { asFile: () => ({ data: async () => { reads++; return new Uint8Array([1]); } }) }]]);
  const edits = await provider.provideDocumentPasteEdits(document, [{}, {}], transfer, {}, token);
  if (noWorkspace || readOnly) { return { edits, saves, prompts, reads, notifications }; }
  assert.equal(reads, 1);
  assert.equal(prompts, 0);
  assert.equal(saves, 0);
  const first = provider.resolveDocumentPasteEdit(edits[0], token);
  const second = provider.resolveDocumentPasteEdit(edits[0], token);
  assert.equal(first, second);
  const edit = await first;
  if (staleAfterSave) {
    document.version++;
    const stale = await provider.resolveDocumentPasteEdit(edits[0], token);
    assert.notEqual(stale, edit);
    assert.equal(stale.insertText, '');
    assert.equal(edit.additionalEdit.edits[0].snippet.value, '![$0](../qa/photo.png)');
    assert.equal(stale.additionalEdit, undefined);
  }
  return { edit, saves, prompts, notifications };
}
test('selected paste prompts/saves once and returns actual relative link', async () => {
  const result = await scenario();
  assert.equal(result.saves, 1);
  assert.equal(result.prompts, 1);
  assert.equal(result.edit.insertText, '');
  assert.equal(result.edit.additionalEdit.edits.length, 2);
  assert.equal(result.edit.additionalEdit.edits[0].snippet.value, '![$0](../qa/photo.png)');
  assert.ok(result.notifications.some(text => text.includes('not confirmed')));
});
test('stale completed edits do not prompt/save again or mutate original edit', async () => {
  const result = await scenario({ staleAfterSave: true });
  assert.equal(result.saves, 1);
  assert.equal(result.prompts, 1);
});
test('restrictions activated during prompt prevent saving', async () => {
  const result = await scenario({ restrictDuringPrompt: true });
  assert.equal(result.saves, 0);
  assert.equal(result.edit.insertText, '');
});
test('cancellation and document invalidation never save or return a link', async () => {
  for (const options of [{ cancel: true }, { invalidate: true }]) {
    const result = await scenario(options);
    assert.equal(result.saves, 0);
    assert.equal(result.edit.insertText, '');
  }
});
test('save failure returns no link and reports error', async () => {
  const result = await scenario({ fail: true });
  assert.equal(result.edit.insertText, '');
  assert.ok(result.notifications.some(text => text.includes('Unable to save')));
});
test('supported no-workspace paste explains decline without reading or saving', async () => {
  const result = await scenario({ noWorkspace: true });
  assert.equal(result.edits, undefined);
  assert.equal(result.reads, 0);
  assert.equal(result.saves, 0);
  assert.ok(result.notifications.some(text => text.includes('not part of a workspace')));
});
test('configured editor-read-only documents decline before prompting or saving', async () => {
  const result = await scenario({ readOnly: true });
  assert.equal(result.edits, undefined);
  assert.equal(result.reads, 0);
  assert.equal(result.prompts, 0);
  assert.equal(result.saves, 0);
  assert.ok(result.notifications.some(text => text.includes('read-only')));
});
