import * as vscode from 'vscode';
import { eligibleDocument, imageMimes, preferredMime } from './probePolicy';

interface ProbeEdit extends vscode.DocumentPasteEdit {
  operation: number;
  document: vscode.TextDocument;
  version: number;
  imageBytes: Uint8Array;
  mime: string;
}

export function registerCompatibilityProbe(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel('Markdown Image Paste Probe');
  let sequence = 0;
  const log = (event: string, data: object = {}): void => {
    output.appendLine(JSON.stringify({ time: new Date().toISOString(), event, ...data }));
  };
  log('activated', { vscode: vscode.version, platform: process.platform,
    remote: vscode.env.remoteName ?? null, writesEnabled: false });
  const kind = vscode.DocumentDropOrPasteEditKind.Empty.append('markdownImagePaste', 'probe');
  const isEligible = (document: vscode.TextDocument): boolean => eligibleDocument({
    language: document.languageId, scheme: document.uri.scheme,
    filename: document.fileName, untitled: document.isUntitled,
    localWorkspace: vscode.workspace.getWorkspaceFolder(document.uri)?.uri.scheme === 'file',
    remote: !!vscode.env.remoteName,
  });
  const provider: vscode.DocumentPasteEditProvider<ProbeEdit> = {
    async provideDocumentPasteEdits(document, ranges, transfer, pasteContext, token) {
      const folder = vscode.workspace.getWorkspaceFolder(document.uri);
      if (!eligibleDocument({ language: document.languageId, scheme: document.uri.scheme,
        filename: document.fileName, untitled: document.isUntitled,
        localWorkspace: folder?.uri.scheme === 'file', remote: !!vscode.env.remoteName })) {
        return undefined;
      }
      const mimes = Array.from(transfer, ([mime]) => mime);
      const mime = preferredMime(mimes);
      if (!mime || token.isCancellationRequested) { return undefined; }
      const imageFile = transfer.get(mime)?.asFile();
      if (!imageFile) {
        log('image-bytes-unavailable', { mime, mimes });
        return undefined;
      }
      const operation = ++sequence;
      const version = document.version;
      let bytes: Uint8Array;
      try {
        // VS Code releases its clipboard file cache after this provider call returns.
        bytes = await imageFile.data();
        log('image-bytes-read', { operation, mime, byteLength: bytes.byteLength,
          phase: 'provide', cancelled: token.isCancellationRequested });
      } catch {
        log('image-bytes-read-failed', { operation, phase: 'provide' });
        return undefined;
      }
      if (token.isCancellationRequested || document.isClosed
        || document.version !== version || bytes.byteLength === 0) {
        log('abandoned-after-read', { operation });
        return undefined;
      }
      log('offered', { operation, mimes, ranges: ranges.length, version: document.version,
        trigger: pasteContext.triggerKind, fileRepresentations: imageMimes
          .filter(type => transfer.get(type)?.asFile() !== undefined) });
      const edit = new vscode.DocumentPasteEdit('[image paste compatibility probe]',
        'Image paste compatibility probe (does not save images)', kind) as ProbeEdit;
      edit.operation = operation;
      edit.document = document;
      edit.version = version;
      edit.imageBytes = bytes;
      edit.mime = mime;
      return [edit];
    },
    async resolveDocumentPasteEdit(edit, token) {
      log('resolve-start', { operation: edit.operation, cancelled: token.isCancellationRequested });
      if (token.isCancellationRequested) { return undefined; }
      const input = vscode.window.createInputBox();
      input.title = 'Compatibility probe — no image will be saved';
      input.prompt = 'Enter any filename stem to test resolution; Escape tests cancellation.';
      const result = await new Promise<string | undefined>(resolve => {
        let finished = false;
        const finish = (value?: string): void => {
          if (finished) { return; }
          finished = true;
          resolve(value);
          for (const disposable of listeners) { disposable.dispose(); }
          input.dispose();
        };
        const listeners = [
          input.onDidAccept(() => finish(input.value)),
          input.onDidHide(() => finish()),
          token.onCancellationRequested(() => finish()),
          vscode.workspace.onDidChangeTextDocument(event => {
            if (event.document === edit.document) { finish(); }
          }),
          vscode.workspace.onDidCloseTextDocument(document => {
            if (document === edit.document) { finish(); }
          }),
        ];
        input.show();
        if (token.isCancellationRequested || edit.document.isClosed
          || edit.document.version !== edit.version) { finish(); }
      });
      log('resolve-end', { operation: edit.operation, accepted: result !== undefined,
        cancelled: token.isCancellationRequested, closed: edit.document.isClosed,
        changed: edit.document.version !== edit.version });
      // Empty insertion is experimental only: it is NOT a verified fallback mechanism.
      if (result === undefined) {
        edit.insertText = '';
        return edit;
      }
      {
        const bytes = edit.imageBytes;
        log('image-bytes-ready', { operation: edit.operation, mime: edit.mime,
          byteLength: bytes.byteLength, phase: 'resolve' });
        if (token.isCancellationRequested || edit.document.isClosed
          || edit.document.version !== edit.version || bytes.byteLength === 0) {
          edit.insertText = '';
          log('abandoned-after-read', { operation: edit.operation });
        }
      }
      return edit;
    },
  };
  context.subscriptions.push(output,
    vscode.workspace.onDidChangeTextDocument(event => {
      // Output channels are documents too: logging their changes feeds back into itself.
      if (isEligible(event.document)) {
        log('document-change', {
          changes: event.contentChanges.length, version: event.document.version,
        });
      }
    }),
    vscode.workspace.onDidCloseTextDocument(document => {
      if (isEligible(document)) { log('document-close'); }
    }),
    vscode.languages.registerDocumentPasteEditProvider(
      { language: 'markdown', scheme: 'file' }, provider,
      { pasteMimeTypes: [...imageMimes], providedPasteEditKinds: [kind] }));
}
