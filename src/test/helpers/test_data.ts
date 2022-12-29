import * as path from 'path';
import * as vscode from 'vscode';

const UNRESOLVED_TEST_DATA_DIR = __dirname + '/../..';

function temporaryFileUri(filename: string): vscode.Uri {
  const resolvedPath = path.resolve(UNRESOLVED_TEST_DATA_DIR, filename);
  return vscode.Uri.file(resolvedPath);
}

export async function writeTemporaryFile(
  filename: string,
  content: string,
  disposables: vscode.Disposable[]
): Promise<vscode.Uri> {
  const uri = temporaryFileUri(filename);
  await vscode.workspace.fs.writeFile(uri, Buffer.from(content));
  disposables.push(
    new vscode.Disposable(() => vscode.workspace.fs.delete(uri))
  );
  return uri;
}
