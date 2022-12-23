import * as vscode from 'vscode';
import * as vscodeUri from 'vscode-uri';

export const UriUtils = vscodeUri.Utils;

export function isLocalWorkspace(): boolean {
  return (
    vscode.workspace.workspaceFolders !== undefined &&
    vscode.workspace.workspaceFolders.every(f => f.uri.scheme === 'file')
  );
}

export function getConfiguration<T>(
  id: string,
  defaultValue?: T
): T | undefined;
export function getConfiguration<T = unknown>(
  id: string,
  defaultValue: undefined
): T | undefined;
export function getConfiguration<T = unknown>(id: string, defaultValue: T): T {
  const components = id.split('.');
  const section = components.pop() ?? '';
  const base = components.join('.');
  return vscode.workspace
    .getConfiguration(base)
    .get(section, defaultValue) as T;
}
