import * as plist from 'plist';
import * as vscode from 'vscode';

import {PlainObject} from '../../../common/utilities/object';

import {PlistWriter} from './plist_writer';

/** Writes structured JSON as a plist file using the node plist library. */
export class NodePlistWriter implements PlistWriter {
  async jsonToPlistDocument(
    document: vscode.TextDocument,
    json: PlainObject | ReadonlyArray<unknown>
  ): Promise<void> {
    const renderedPlist = plist.build(json as plist.PlistObject);
    const edit = new vscode.WorkspaceEdit();

    // Just replace the entire document every time for the initial
    // implementation. Ideally this should compute and make minimal edits.
    edit.replace(
      document.uri,
      new vscode.Range(0, 0, document.lineCount, 0),
      renderedPlist
    );

    await vscode.workspace.applyEdit(edit);
  }
}
