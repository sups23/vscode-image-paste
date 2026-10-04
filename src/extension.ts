import * as vscode from 'vscode';
import { registerCompatibilityProbe } from './compatibilityProbe';

export function activate(context: vscode.ExtensionContext): void {
  registerCompatibilityProbe(context);
}
