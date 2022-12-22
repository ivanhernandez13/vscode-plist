import * as vscode from 'vscode';

import {checkOutput} from '../../../common/utilities/node/child_process';
import {SelfDisposing} from '../../../common/utilities/self_disposing';
import {PlistEditorController} from '../../textual/plist_editor_controller';
import {generatedFileUri} from '../../../common/generated_files';
import {replaceTab} from '../../../common/utilities/tab';
import {quoted} from '../../../common/utilities/string';
import {UriUtils} from '../../../common/utilities/vscode';

interface ProvisioningProfilePlistDocument extends vscode.CustomDocument {
  generatedUri: vscode.Uri;
}

export class ProvisioningProfileEditorController
  extends SelfDisposing
  implements
    vscode.CustomReadonlyEditorProvider<ProvisioningProfilePlistDocument>
{
  static readonly viewType = 'plistEditor.provisioningProfileEdit';

  constructor(private readonly storageLocation: vscode.Uri) {
    super();
    this.disposables.push(...this.performRegistrations());
  }

  async openCustomDocument(
    uri: vscode.Uri
  ): Promise<ProvisioningProfilePlistDocument> {
    const generatedUri = generatedFileUri(uri, this.storageLocation, 'plist');
    return {uri, generatedUri, dispose() {}};
  }

  async resolveCustomEditor(
    document: ProvisioningProfilePlistDocument,
    webviewPanel: vscode.WebviewPanel,
    token: vscode.CancellationToken
  ): Promise<void> {
    try {
      webviewPanel.webview.html = `Generating readable provisioning profile from file://${document.uri}...`;
      await checkOutput(
        '/usr/bin/security',
        [
          'cms',
          '-D', // decode
          '-i',
          document.uri.fsPath, // infile
          '-o',
          quoted(document.generatedUri.fsPath), // outfile
        ],
        token
      );
      webviewPanel.webview.html = `Readable provisioning profile was generated at ${document.generatedUri}.`;
    } catch (err) {
      vscode.window.showErrorMessage(
        `Failed to decrypt '${UriUtils.basename(document.uri)}'. ${String(err)}`
      );
    }

    setTimeout(async () => {
      await replaceTab(
        document.uri,
        document.generatedUri,
        PlistEditorController.viewType
      );
    });
  }

  private performRegistrations(): vscode.Disposable[] {
    return [
      vscode.window.registerCustomEditorProvider(
        ProvisioningProfileEditorController.viewType,
        this
      ),
    ];
  }
}
