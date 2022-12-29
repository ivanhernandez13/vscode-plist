import * as vscode from 'vscode';

export function disposeAndClear(disposables: vscode.Disposable[]) {
  for (const disposable of disposables) {
    disposable.dispose();
  }
  disposables.length = 0;
}

/**
 * A base class that includes a list of disposables and implements dispose().
 */
export class SelfDisposing implements vscode.Disposable {
  protected readonly disposables: vscode.Disposable[] = [];

  dispose() {
    disposeAndClear(this.disposables);
  }
}
