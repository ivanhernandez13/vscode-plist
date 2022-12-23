import * as vscode from 'vscode';
import {MANIFEST} from '../../core/manifest';

export async function replaceTab(
  replacee: vscode.Uri,
  replacer: vscode.Uri,
  viewType?: string
): Promise<void> {
  const viewColumn = findTab(replacee)?.group.viewColumn;
  await vscode.commands.executeCommand(
    MANIFEST.COMMANDS.openWith,
    replacer,
    viewType,
    {viewColumn}
  );

  const targetTab = findTab(replacee);
  if (targetTab) {
    await vscode.window.tabGroups.close(targetTab);
  }
}

function findTab(uri: vscode.Uri): vscode.Tab | undefined {
  return vscode.window.tabGroups.all
    .flatMap(group => group.tabs)
    .find(
      tab =>
        tab.input !== undefined &&
        (tab.input as {uri?: vscode.Uri}).uri?.path === uri.path
    );
}
