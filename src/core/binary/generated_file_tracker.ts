import * as vscode from 'vscode';

export class GeneratedFileTracker {
  readonly generatedFiles = new Map<vscode.Uri, vscode.Uri>();

  isGenerated(uri: vscode.Uri): boolean {
    return this.generatedFiles.has(uri);
  }
}
