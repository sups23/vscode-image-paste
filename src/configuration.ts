import * as vscode from 'vscode';
import { eligibleDocument } from './probePolicy';
import { resolveDestination } from './configurationPolicy';
import { validateDestinationRoute } from './fileUtils';

export function getEligibleWorkspace(document: vscode.TextDocument): vscode.WorkspaceFolder | undefined {
  const folder = vscode.workspace.getWorkspaceFolder(document.uri);
  return eligibleDocument({ language: document.languageId, scheme: document.uri.scheme,
    filename: document.fileName, untitled: document.isUntitled,
    localWorkspace: folder?.uri.scheme === 'file', remote: !!vscode.env.remoteName }) ? folder : undefined;
}

export function readDestination(resource: vscode.Uri, folder: vscode.WorkspaceFolder): string {
  const value = vscode.workspace.getConfiguration('markdownImagePaste', resource).get<unknown>('destination', 'qa/screenshots');
  return resolveDestination(folder.uri.fsPath, value);
}

export function isConfiguredReadOnly(document: vscode.TextDocument, folder: vscode.WorkspaceFolder): boolean {
  const config = vscode.workspace.getConfiguration('files', document.uri);
  const matches = (key: string): boolean => {
    const patterns = config.get<Record<string, boolean>>(key, {});
    return Object.entries(patterns).some(([pattern, enabled]) => enabled
      && vscode.languages.match({ scheme: 'file', pattern: new vscode.RelativePattern(folder, pattern) }, document) > 0);
  };
  return matches('readonlyInclude') && !matches('readonlyExclude');
}

export async function setDestination(): Promise<void> {
  try {
    if (vscode.env.remoteName) { throw new Error('Only local desktop workspaces are supported.'); }
    const folders = vscode.workspace.workspaceFolders?.filter(folder => folder.uri.scheme === 'file') ?? [];
    if (!folders.length) { throw new Error('Open a local workspace first.'); }
    const active = vscode.window.activeTextEditor?.document;
    let folder = active ? getEligibleWorkspace(active) : undefined;
    if (!folder) {
      folder = folders.length === 1 ? folders[0] : (await vscode.window.showQuickPick(
        folders.map(value => ({ label: value.name, description: value.uri.fsPath, folder: value })),
        { placeHolder: 'Choose the workspace folder' }))?.folder;
    }
    if (!folder) { return; }
    const selected = folder;
    const config = vscode.workspace.getConfiguration('markdownImagePaste', selected.uri);
    const current = config.get<unknown>('destination', 'qa/screenshots');
    const value = await vscode.window.showInputBox({ title: 'Markdown Images: Set Destination Folder',
      value: typeof current === 'string' ? current : '',
      prompt: 'Workspace-relative folder using / separators',
      validateInput: input => {
        try { resolveDestination(selected.uri.fsPath, input); return undefined; }
        catch (error) { return error instanceof Error ? error.message : 'Invalid destination.'; }
      } });
    if (value === undefined) { return; }
    await validateDestinationRoute(selected.uri.fsPath, resolveDestination(selected.uri.fsPath, value));
    await config.update('destination', value, vscode.ConfigurationTarget.WorkspaceFolder);
  } catch (error) {
    void vscode.window.showErrorMessage(error instanceof Error ? error.message : 'Unable to configure destination.');
  }
}
