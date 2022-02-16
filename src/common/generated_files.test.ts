import * as vscode from 'vscode';

import {generatedFileUri, TEST_ONLY} from './generated_files';

const {hashCode} = TEST_ONLY;

function generatedFileUriWithPaths(
  input: string,
  outputDirectory: string,
  extension?: string
) {
  return generatedFileUri(
    vscode.Uri.file(input),
    vscode.Uri.file(outputDirectory),
    extension
  );
}

describe('Generated Files', () => {
  it('generates a temp file uri', () => {
    const actual = generatedFileUriWithPaths(
      '/orig/dir/name.extension',
      '/new/dir'
    );
    const hash = hashCode('/orig/dir/name.extension');
    expect(actual.fsPath).toEqual(`/new/dir/name.${hash}.extension`);
  });

  it('generates a temp file uri with a new extension', () => {
    const actual = generatedFileUriWithPaths(
      '/orig/dir/name.extension',
      '/new/dir',
      'new-extension'
    );
    const hash = hashCode('/orig/dir/name.extension');
    expect(actual.fsPath).toEqual(`/new/dir/name.${hash}.new-extension`);
  });
});
