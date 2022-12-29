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

const VSCODE_COMMANDS = {
  closeAllEditors: 'workbench.action.closeAllEditors',
  open: 'vscode.open',
  openWith: 'vscode.openWith',
};
type VSCodeCommand = keyof typeof VSCODE_COMMANDS;

export function executeVSCodeCommand(
  commandKey: 'open',
  uri: vscode.Uri
): Promise<void>;
export function executeVSCodeCommand(
  commandKey: 'openWith',
  uri: vscode.Uri,
  viewId: string,
  options?: vscode.TextDocumentShowOptions
): Promise<void>;
export function executeVSCodeCommand(
  commandKey: 'closeAllEditors'
): Promise<void>;
export function executeVSCodeCommand(
  commandKey: VSCodeCommand,
  ...args: unknown[]
): Promise<unknown> {
  return Promise.resolve(
    vscode.commands.executeCommand(VSCODE_COMMANDS[commandKey], ...args)
  );
}
