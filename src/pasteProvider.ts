import * as vscode from 'vscode';
import * as fs from 'node:fs/promises';
import { constants } from 'node:fs';
import * as path from 'node:path';
import { getEligibleWorkspace, isConfiguredReadOnly, readDestination } from './configuration';
import { imageMimes, preferredMime } from './probePolicy';
import { buildMarkdownReference, buildNumberedFilename, extensionForMime, ImageSaveError,
  saveImageExclusive, validateDestinationRoute, validateFilenameStem, validateGeneratedPath } from './fileUtils';

interface PasteOperationContext {
  document: vscode.TextDocument;
  version: number;
  ranges: readonly vscode.Range[];
  root: string;
  destination: string;
  bytes: Uint8Array;
  extension: string;
  result?: Promise<ImagePasteEdit>;
}
interface ImagePasteEdit extends vscode.DocumentPasteEdit { operation: PasteOperationContext; }

function isOperationCurrent(operation: PasteOperationContext, token: vscode.CancellationToken): boolean {
  return !token.isCancellationRequested && !operation.document.isClosed
    && operation.document.version === operation.version;
}

async function availableCandidate(operation: PasteOperationContext, stem: string): Promise<void> {
  for (let index = 0; index < Number.MAX_SAFE_INTEGER; index++) {
    const candidate = path.join(operation.destination, buildNumberedFilename(stem, operation.extension, index));
    validateGeneratedPath(candidate);
    try { await fs.lstat(candidate); }
    catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') { return; }
      throw error;
    }
  }
  throw new Error('No available filename.');
}

async function promptFilename(operation: PasteOperationContext, token: vscode.CancellationToken): Promise<string | undefined> {
  const input = vscode.window.createInputBox();
  input.title = 'Image filename (without extension)';
  input.prompt = `The format extension ${operation.extension} is always appended, even if you type a suffix.`;
  return new Promise(resolve => {
    let finished = false;
    let validating = false;
    const finish = (value?: string): void => {
      if (finished) { return; }
      finished = true;
      for (const listener of listeners) { listener.dispose(); }
      input.dispose();
      resolve(value);
    };
    const invalidate = (): void => {
      if (!isOperationCurrent(operation, token)) {
        if (!token.isCancellationRequested) {
          void vscode.window.showWarningMessage('Image paste abandoned: the original document changed or closed.');
        }
        finish();
      }
    };
    const listeners = [input.onDidHide(() => finish()),
      input.onDidChangeValue(value => {
        try { validateFilenameStem(value); input.validationMessage = undefined; }
        catch (error) { input.validationMessage = error instanceof Error ? error.message : 'Invalid filename.'; }
      }),
      input.onDidAccept(async () => {
        if (validating || finished) { return; }
        validating = true;
        try {
          const stem = validateFilenameStem(input.value);
          await availableCandidate(operation, stem);
          if (finished) { return; }
          if (!isOperationCurrent(operation, token)) { invalidate(); return; }
          finish(stem);
        } catch (error) {
          if (!finished) { input.validationMessage = error instanceof Error ? error.message : 'Invalid filename.'; }
        } finally { validating = false; }
      }),
      token.onCancellationRequested(() => finish()),
      vscode.workspace.onDidChangeTextDocument(event => {
        if (event.document === operation.document) { invalidate(); }
      }),
      vscode.workspace.onDidCloseTextDocument(document => {
        if (document === operation.document) { invalidate(); }
      }),
      vscode.workspace.onDidRenameFiles(event => {
        if (event.files.some(file => file.oldUri.toString() === operation.document.uri.toString())) {
          void vscode.window.showWarningMessage('Image paste abandoned: the original document moved.');
          finish();
        }
      }),
    ];
    input.show();
    invalidate();
  });
}

export class MarkdownImagePasteProvider implements vscode.DocumentPasteEditProvider<ImagePasteEdit> {
  async provideDocumentPasteEdits(document: vscode.TextDocument, _ranges: readonly vscode.Range[],
    transfer: vscode.DataTransfer, _context: vscode.DocumentPasteEditContext,
    token: vscode.CancellationToken): Promise<ImagePasteEdit[] | undefined> {
    const folder = getEligibleWorkspace(document);
    const mime = preferredMime(Array.from(transfer, ([type]) => type));
    if (!mime || token.isCancellationRequested) { return undefined; }
    if (!folder) {
      if (!vscode.env.remoteName && document.uri.scheme === 'file' && document.languageId === 'markdown'
        && /\.md$/i.test(document.fileName) && !vscode.workspace.getWorkspaceFolder(document.uri)) {
        void vscode.window.showErrorMessage('Cannot save pasted image because this Markdown file is not part of a workspace.');
      }
      return undefined;
    }
    const file = transfer.get(mime)?.asFile();
    if (!file) { return undefined; }
    // Multiple identifiable source URIs are separate images, not MIME alternatives.
    const uris = new Set(imageMimes.map(type => transfer.get(type)?.asFile()?.uri?.toString()).filter(Boolean));
    if (uris.size > 1) { return undefined; }
    const version = document.version;
    try {
      if (isConfiguredReadOnly(document, folder)) { throw new Error('This Markdown document is configured read-only.'); }
      const destination = readDestination(document.uri, folder);
      await fs.access(document.uri.fsPath, constants.W_OK);
      await validateDestinationRoute(folder.uri.fsPath, destination);
      const bytes = await file.data();
      if (!bytes.byteLength || document.isClosed || document.version !== version || token.isCancellationRequested) { return undefined; }
      const edit = new vscode.DocumentPasteEdit('', 'Paste Markdown image with filename',
        vscode.DocumentDropOrPasteEditKind.Empty.append('markdownImagePaste', 'image')) as ImagePasteEdit;
      edit.operation = { document, version, ranges: _ranges, root: folder.uri.fsPath, destination,
        bytes, extension: extensionForMime(mime) };
      return [edit];
    } catch (error) {
      void vscode.window.showErrorMessage(error instanceof Error ? error.message : 'Unable to read clipboard image.');
      return undefined;
    }
  }

  resolveDocumentPasteEdit(edit: ImagePasteEdit, token: vscode.CancellationToken): Promise<ImagePasteEdit> {
    // VS Code may revisit an edit through the paste selector; never prompt/save twice.
    if (edit.operation.result && !isOperationCurrent(edit.operation, token)) {
      const abandoned = new vscode.DocumentPasteEdit('', edit.title, edit.kind) as ImagePasteEdit;
      abandoned.operation = edit.operation;
      return Promise.resolve(abandoned);
    }
    edit.operation.result ??= this.commit(edit, token);
    return edit.operation.result;
  }

  private async commit(edit: ImagePasteEdit, token: vscode.CancellationToken): Promise<ImagePasteEdit> {
    const operation = edit.operation;
    if (!isOperationCurrent(operation, token)) { return edit; }
    const stem = await promptFilename(operation, token);
    if (stem === undefined || !isOperationCurrent(operation, token)) { return edit; }
    try {
      const folder = getEligibleWorkspace(operation.document);
      if (!folder || isConfiguredReadOnly(operation.document, folder)) {
        throw new Error('The original document is no longer writable in its workspace.');
      }
      await fs.access(operation.document.uri.fsPath, constants.W_OK);
      const saved = await saveImageExclusive({ ...operation, stem,
        isCurrent: () => isOperationCurrent(operation, token) });
      void vscode.window.showInformationMessage(`Image saved: ${saved.path}. Final Markdown insertion is not confirmed.`);
      if (isOperationCurrent(operation, token)) {
        // Keep the document and image in the same lexical workspace coordinate system.
        const reference = buildMarkdownReference(operation.document.uri.fsPath,
          path.join(operation.destination, path.basename(saved.path)));
        const snippet = new vscode.SnippetString().appendText('![').appendTabstop(0)
          .appendText(reference.slice(2));
        const additionalEdit = new vscode.WorkspaceEdit();
        additionalEdit.set(operation.document.uri,
          operation.ranges.map(range => vscode.SnippetTextEdit.replace(range, snippet)));
        edit.additionalEdit = additionalEdit;
      } else {
        void vscode.window.showWarningMessage(`Image retained at ${saved.path}; paste was cancelled or the original document changed.`);
      }
    } catch (error) {
      const artifact = error instanceof ImageSaveError && error.artifactPath;
      void vscode.window.showErrorMessage(artifact ? `Incomplete image retained at ${artifact}. No link inserted.`
        : `Unable to save pasted image: ${error instanceof Error ? error.message : 'unknown error'}`);
    } finally {
      operation.bytes = new Uint8Array();
    }
    return edit;
  }
}

export function registerPasteProvider(context: vscode.ExtensionContext): void {
  const kind = vscode.DocumentDropOrPasteEditKind.Empty.append('markdownImagePaste', 'image');
  context.subscriptions.push(vscode.languages.registerDocumentPasteEditProvider(
    { language: 'markdown', scheme: 'file' }, new MarkdownImagePasteProvider(),
    { pasteMimeTypes: [...imageMimes], providedPasteEditKinds: [kind] }));
}
