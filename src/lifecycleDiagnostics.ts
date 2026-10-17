import * as vscode from 'vscode';
import { getEligibleWorkspace } from './configuration';

/** Opt-in observation only. Never stores text, image bytes, paths, or deletes files. */
export function registerLifecycleDiagnostics(context: vscode.ExtensionContext): void {
  let session: vscode.Disposable | undefined;
  context.subscriptions.push({ dispose: () => session?.dispose() },
    vscode.commands.registerCommand('markdownImagePaste.toggleLifecycleDiagnostics', () => {
      if (session) {
        session.dispose();
        session = undefined;
        void vscode.window.showInformationMessage('Image lifecycle diagnostics stopped.');
        return;
      }
      const output = vscode.window.createOutputChannel('Markdown Image Lifecycle');
      const ids = new WeakMap<vscode.TextDocument, number>();
      let sequence = 0;
      const id = (document: vscode.TextDocument): number => {
        let value = ids.get(document);
        if (value === undefined) { value = ++sequence; ids.set(document, value); }
        return value;
      };
      const log = (event: string, fields: object): void => {
        output.appendLine(JSON.stringify({ time: new Date().toISOString(), event, ...fields }));
      };
      const changes = vscode.workspace.onDidChangeTextDocument(event => {
        if (!getEligibleWorkspace(event.document)) { return; }
        log('document-change', { document: id(event.document), version: event.document.version,
          reason: event.reason === vscode.TextDocumentChangeReason.Undo ? 'undo'
            : event.reason === vscode.TextDocumentChangeReason.Redo ? 'redo' : 'other',
          changes: event.contentChanges.map(change => ({ offset: change.rangeOffset,
            removed: change.rangeLength, inserted: change.text.length })) });
      });
      const closed = vscode.workspace.onDidCloseTextDocument(document => {
        if (ids.has(document)) { log('document-close', { document: id(document) }); }
      });
      session = vscode.Disposable.from(changes, closed, output);
      log('started', { vscode: vscode.version, platform: process.platform, deletionEnabled: false });
      output.show(true);
    }));
}
