import * as vscode from 'vscode';

/**
 * A base class that includes a list of disposables and implements dispose().
 */
export class SelfDisposing implements vscode.Disposable {
  protected readonly disposables: vscode.Disposable[] = [];

  dispose() {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
  }
}
