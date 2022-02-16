import * as vscode from 'vscode';
import {UriUtils} from './utilities/vscode';

export function generatedFileUri(
  uri: vscode.Uri,
  destination: vscode.Uri,
  extension?: string
): vscode.Uri {
  const basename = UriUtils.basename(uri).split('.');
  basename.pop();
  basename.push(hashCode(uri.path));
  const filename =
    basename.join('.') + (extension ? `.${extension}` : UriUtils.extname(uri));
  return vscode.Uri.joinPath(destination, filename);
}

function hashCode(str: string): string {
  return Math.abs(
    str
      .split('')
      .reduce(
        (prevHash, currVal) =>
          ((prevHash << 5) - prevHash + currVal.charCodeAt(0)) | 0,
        0
      )
  ).toString(16);
}

export const TEST_ONLY = {hashCode};
