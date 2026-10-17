import * as vscode from 'vscode';
import { registerPasteProvider } from './pasteProvider';
import { setDestination } from './configuration';
import { registerLifecycleDiagnostics } from './lifecycleDiagnostics';

export function activate(context: vscode.ExtensionContext): void {
  registerPasteProvider(context);
  registerLifecycleDiagnostics(context);
  context.subscriptions.push(vscode.commands.registerCommand('markdownImagePaste.setDestination', setDestination));
}
