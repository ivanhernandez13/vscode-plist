import * as vscode from 'vscode';
import {EDITOR_COMMANDS} from '../../core/commands';

export async function replaceTab(
  replacee: vscode.Uri,
  replacer: vscode.Uri,
  viewType?: string
) {
  const targetTab = vscode.window.tabGroups.all
    .flatMap(group => group.tabs)
    .find(
      tab =>
        tab.input !== undefined &&
        (tab.input as {uri?: vscode.Uri}).uri?.path === replacee.path
    );
  if (targetTab) {
    await vscode.window.tabGroups.close(targetTab);
  }
  await vscode.commands.executeCommand(
    EDITOR_COMMANDS.openWith,
    replacer,
    viewType,
    {
      viewColumn: targetTab?.group.viewColumn,
    }
  );
}
