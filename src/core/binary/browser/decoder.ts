import * as vscode from 'vscode';
import * as plist from 'plist';

import {decodeBinaryPlist} from '../decoder/binary_plist_decoder';
import {BinaryPlistDocument} from '../binary_plist_document';

/* eslint-disable @typescript-eslint/no-unused-vars */
export async function generateTextualPlist(
  document: BinaryPlistDocument,
  ...rest: unknown[]
): Promise<void> {
  if (!document.generatedUri) return;

  const content = await decodeBinaryPlist(document.uri);
  const plistContent = plist.build(content as plist.PlistValue);
  await vscode.workspace.fs.writeFile(
    document.generatedUri,
    new Uint8Array(Buffer.from(plistContent))
  );
}

export async function exportTextualPlist(
  sourceUri: vscode.Uri,
  destUri: vscode.Uri
): Promise<string> {
  return '';
}
/* eslint-enable @typescript-eslint/no-unused-vars */
