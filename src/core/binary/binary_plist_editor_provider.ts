import * as vscode from 'vscode';

import {SelfDisposing} from '../../common/utilities/disposable';
import {GeneratedFileTracker} from './generated_file_tracker';
import {replaceTab} from '../../common/utilities/tab';
import {generatedFileUri} from '../../common/generated_files';
import {isBinaryPlist} from './decoder/binary_plist_decoder';
import {getConfiguration, UriUtils} from '../../common/utilities/vscode';
import {isLocalMacOS} from '../../common/utilities/host';
import {generateTextualPlist, exportTextualPlist} from './decoder';
import {BinaryPlistDocument} from './binary_plist_document';
import {MANIFEST} from '../manifest';

/**
 * Registers a custom editor that is used whenever a .plist file (binary OR
 * textual) is opened that. This does not actually implement a custom editor, it
 * merely forwards to the custom textual plist editor if the opened file is
 * textual or generates a textual version of the binary file and then opens in
 * the aforementioned editor. This is needed because VS Code does not invoke
 * custom text editors when a binary file is opened even if it matches the
 * supported file extension.
 */
export class BinaryPlistEditorProvider
  extends SelfDisposing
  implements vscode.CustomReadonlyEditorProvider<BinaryPlistDocument>
{
  static get usingMacosDecoder(): boolean {
    return (
      isLocalMacOS() &&
      getConfiguration('plist.binarySupport.decoder', 'plutil') === 'plutil'
    );
  }

  constructor(
    private readonly storageLocation: vscode.Uri,
    private readonly tracker: GeneratedFileTracker
  ) {
    super();
    this.disposables.push(...this.performRegistrations());
  }

  async openCustomDocument(uri: vscode.Uri): Promise<BinaryPlistDocument> {
    const needsGeneratedCounterpart = await isBinaryPlist(uri);
    const generatedUri = needsGeneratedCounterpart
      ? generatedFileUri(uri, this.storageLocation)
      : undefined;
    return {uri, generatedUri, dispose() {}};
  }

  async resolveCustomEditor(
    document: BinaryPlistDocument,
    webviewPanel: vscode.WebviewPanel,
    token: vscode.CancellationToken
  ): Promise<void> {
    if (document.generatedUri) {
      try {
        webviewPanel.webview.html = `Generating readable plist from file://${document.uri}...`;
        await generateTextualPlist(
          document,
          token,
          BinaryPlistEditorProvider.usingMacosDecoder
        );
        webviewPanel.webview.html = `Readable plist was generated at ${document.generatedUri}.`;
      } catch (err) {
        vscode.window.showErrorMessage(
          `Failed to decode binary plist '${UriUtils.basename(
            document.uri
          )}'. ${String(err)}`
        );
        return;
      }
      this.tracker.generatedFiles.set(document.generatedUri, document.uri);
    }

    setTimeout(async () => {
      await replaceTab(
        {uri: document.uri, viewType: MANIFEST.customEditors.binaryPlistEditor},
        {
          uri: document.generatedUri ?? document.uri,
          viewType: MANIFEST.customEditors.plistEditor,
        }
      );
    });
  }

  private performRegistrations(): vscode.Disposable[] {
    const registrations = [
      vscode.window.registerCustomEditorProvider(
        MANIFEST.customEditors.binaryPlistEditor,
        this
      ),
    ];
    if (isLocalMacOS()) {
      registrations.push(
        vscode.workspace.onDidSaveTextDocument(asciiDoc => {
          if (!BinaryPlistEditorProvider.usingMacosDecoder) return;

          const uri = this.tracker.generatedFiles.get(asciiDoc.uri);
          if (uri) {
            exportTextualPlist(asciiDoc.uri, uri);
          }
        })
      );
    }
    return registrations;
  }
}
