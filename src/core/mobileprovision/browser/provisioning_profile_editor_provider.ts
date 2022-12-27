import * as vscode from 'vscode';

export class ProvisioningProfileEditorProvider
  implements vscode.CustomReadonlyEditorProvider
{
  /* eslint-disable @typescript-eslint/no-unused-vars */
  constructor(storageLocation: vscode.Uri) {}

  async openCustomDocument(uri: vscode.Uri): Promise<vscode.CustomDocument> {
    vscode.window.showErrorMessage(
      'Provisioning profiles are not supported on this platform.'
    );
    throw new Error();
  }

  async resolveCustomEditor(
    document: vscode.CustomDocument,
    webviewPanel: vscode.WebviewPanel,
    token: vscode.CancellationToken
  ): Promise<void> {
    throw new Error();
  }
  /* eslint-enable @typescript-eslint/no-unused-vars */

  dispose() {}
}
