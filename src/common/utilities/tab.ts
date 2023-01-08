import * as vscode from 'vscode';
import {executeVSCodeCommand} from './vscode';

interface UriAndViewType {
  uri: vscode.Uri;
  viewType: string;
}

export async function replaceTab(
  ambigousReplacee: UriAndViewType | vscode.Uri,
  replacer: UriAndViewType
): Promise<void> {
  const replacee =
    ambigousReplacee instanceof vscode.Uri
      ? {uri: ambigousReplacee, viewType: undefined}
      : ambigousReplacee;

  const viewColumn = findTab(replacee)?.group.viewColumn;
  await executeVSCodeCommand('openWith', replacer.uri, replacer.viewType, {
    viewColumn,
  });
  await closeTab(replacee);
}

export async function closeTab(predicate: TabInputPredicate) {
  const tab = findTab(predicate);
  if (tab) {
    await vscode.window.tabGroups.close(tab);
  }
}

interface TabInputPredicate {
  uri?: vscode.Uri | vscode.Uri[];
  viewType?: string | string[];
}

function tabInputPredicate(
  tab: vscode.Tab,
  predicate: TabInputPredicate
): boolean {
  if (predicate.uri) {
    const input = tab.input as {uri?: vscode.Uri};
    const uris = Array.isArray(predicate.uri) ? predicate.uri : [predicate.uri];
    if (!uris.some(uri => input.uri?.path === uri.path)) {
      return false;
    }
  }

  if (predicate.viewType) {
    const input = tab.input as {viewType?: string};
    const viewTypes = Array.isArray(predicate.viewType)
      ? predicate.viewType
      : [predicate.viewType];
    if (!viewTypes.some(viewType => input.viewType === viewType)) {
      return false;
    }
  }

  return true;
}

function findTab(predicate: TabInputPredicate): vscode.Tab | undefined {
  return allTabs().find(t => tabInputPredicate(t, predicate));
}

export function findTabs(predicate: TabInputPredicate): vscode.Tab[] {
  return allTabs().filter(t => tabInputPredicate(t, predicate));
}

export function allTabs(): vscode.Tab[] {
  return vscode.window.tabGroups.all.flatMap(group => group.tabs);
}
