import * as vscode from 'vscode';
import * as plist from 'plist';

import {decodeBinaryPlist} from '../decoder/binary_plist_decoder';
import {plutil} from '../../../common/utilities/node/plutil';
import {BinaryPlistDocument} from '../binary_plist_document';

export async function generateTextualPlist(
  document: BinaryPlistDocument,
  token: vscode.CancellationToken,
  useMacosDecoder: boolean
): Promise<void> {
  if (!document.generatedUri) return;

  if (useMacosDecoder) {
    await plutil.convert(
      document.uri.fsPath,
      'plist',
      document.generatedUri.fsPath,
      token
    );
  } else {
    const content = await decodeBinaryPlist(document.uri);
    const plistContent = plist.build(content as plist.PlistValue);
    await vscode.workspace.fs.writeFile(
      document.generatedUri,
      new Uint8Array(Buffer.from(plistContent))
    );
  }
}

export async function exportTextualPlist(
  sourceUri: vscode.Uri,
  destUri: vscode.Uri
): Promise<string> {
  return plutil.convert(sourceUri.fsPath, 'bplist', destUri.fsPath);
}
