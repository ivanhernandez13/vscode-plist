import * as vscode from 'vscode';
import * as vscodeUri from 'vscode-uri';

export const UriUtils = vscodeUri.Utils;

export function isLocalWorkspace(): boolean {
  return (
    vscode.workspace.workspaceFolders !== undefined &&
    vscode.workspace.workspaceFolders.every(f => f.uri.scheme === 'file')
  );
}
