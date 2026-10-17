const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('diagnostics are opt-in, exclude Output, omit contents, and dispose listeners', () => {
  let toggle, change, close;
  let disposed = 0;
  const lines = [];
  const disposable = () => ({ dispose: () => disposed++ });
  const vscode = {
    version: 'test', TextDocumentChangeReason: { Undo: 1, Redo: 2 },
    Disposable: { from: (...items) => ({ dispose: () => items.forEach(item => item.dispose()) }) },
    commands: { registerCommand: (_id, callback) => { toggle = callback; return disposable(); } },
    window: { showInformationMessage() {}, createOutputChannel: () => ({
      appendLine: line => lines.push(JSON.parse(line)), show() {}, dispose: () => disposed++,
    }) },
    workspace: {
      onDidChangeTextDocument: callback => { change = callback; return disposable(); },
      onDidCloseTextDocument: callback => { close = callback; return disposable(); },
    },
  };
  const sandbox = { exports: {}, process, require: name => name === 'vscode' ? vscode
    : { getEligibleWorkspace: document => document.eligible ? {} : undefined } };
  vm.runInNewContext(fs.readFileSync('out/lifecycleDiagnostics.js', 'utf8'), sandbox);
  sandbox.exports.registerLifecycleDiagnostics({ subscriptions: [] });
  assert.equal(lines.length, 0);
  toggle();
  const document = { eligible: true, version: 2 };
  change({ document, reason: 1, contentChanges: [{ rangeOffset: 0, rangeLength: 1, text: 'private text' }] });
  change({ document: { eligible: false }, contentChanges: [] });
  assert.equal(lines.length, 2);
  assert.equal(lines[1].reason, 'undo');
  assert.equal(JSON.stringify(lines).includes('private text'), false);
  close(document);
  assert.equal(lines[2].event, 'document-close');
  toggle();
  assert.equal(disposed, 3);
});
