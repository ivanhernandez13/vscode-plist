import * as vscode from 'vscode';

export interface BinaryPlistDocument extends vscode.CustomDocument {
  generatedUri?: vscode.Uri;
}
