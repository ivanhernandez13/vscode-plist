import * as vscode from 'vscode';

import {SelfDisposing} from '../../common/utilities/disposable';
import {MANIFEST} from '../manifest';
import {PlistWebviewController} from './plist_webview_controller';
import {Debouncer} from '../../common/utilities/debouncer';
import {logger} from '../../common/logging/extension_logger';
import {StorageLocations} from '../../common/storage_location';
import {replaceTab} from '../../common/utilities/tab';
import {getConfiguration} from '../../common/utilities/vscode';

/** Registers a custom textual editor for property list files. */
export class PlistEditorProvider
  extends SelfDisposing
  implements vscode.CustomTextEditorProvider
{
  static readonly viewType = 'plistEditor.plistedit';

  private readonly webviewControllerByPath = new Map<
    string,
    PlistWebviewController
  >();

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly memento: vscode.Memento,
    private readonly storageLocations: StorageLocations
  ) {
    super();

    this.disposables.push(...this.performRegistrations());
  }

  async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel
  ): Promise<void> {
    const filepath = document.uri.path;

    let webviewController = this.webviewControllerByPath.get(filepath);
    if (!webviewController) {
      webviewController = new PlistWebviewController(
        document,
        webviewPanel,
        this.extensionUri,
        this.storageLocations,
        this.memento
      );
      this.disposables.push(webviewController);
      this.webviewControllerByPath.set(filepath, webviewController);

      const disposable = webviewPanel.onDidDispose(() => {
        this.webviewControllerByPath.delete(filepath);
        webviewController?.dispose();
        if (webviewController?.docAttributes.isGenerated) {
          vscode.workspace.fs.delete(document.uri);
        }
        disposable.dispose();
      });
    }

    return webviewController.renderEditor();
  }

  private performRegistrations(): vscode.Disposable[] {
    const debouncedReload = new Debouncer(
      async (e: vscode.TextDocumentChangeEvent) => {
        const docPath = e.document.uri.path;
        const webviewController = this.webviewControllerByPath.get(docPath);
        if (!webviewController) return;

        webviewController.renderEditor(e.document.getText());
      },
      500
    );

    return [
      vscode.workspace.onDidChangeConfiguration(e => {
        if (
          !(
            e.affectsConfiguration(MANIFEST.SETTINGS.binaryDecoder) ||
            e.affectsConfiguration(MANIFEST.SETTINGS.spacing)
          )
        ) {
          return;
        }

        if (e.affectsConfiguration(MANIFEST.SETTINGS.binaryDecoder)) {
          const entries = this.webviewControllerByPath.entries();
          for (const [path, controller] of entries) {
            if (!controller.docAttributes.isGenerated) continue;

            controller.dispose();
            this.webviewControllerByPath.delete(path);
          }
        } else if (e.affectsConfiguration(MANIFEST.SETTINGS.spacing)) {
          const controllers = this.webviewControllerByPath.values();
          for (const controller of controllers) {
            controller.panel.webview.postMessage({
              command: 'updateSpacing',
              spacing: getConfiguration(MANIFEST.SETTINGS.spacing),
            });
          }
        }
      }),
      vscode.window.registerCustomEditorProvider(
        PlistEditorProvider.viewType,
        this,
        {
          webviewOptions: {enableFindWidget: true},
        }
      ),
      vscode.commands.registerCommand(
        MANIFEST.COMMANDS.openWithDefaultEditor,
        resource => replaceTab(resource, resource, 'default')
      ),
      vscode.commands.registerCommand(
        MANIFEST.COMMANDS.openWithPlistEditor,
        resource => replaceTab(resource, resource, PlistEditorProvider.viewType)
      ),
      vscode.commands.registerCommand(MANIFEST.COMMANDS.collapseAll, () =>
        this.postCommandToActiveWebview('collapseAll')
      ),
      vscode.commands.registerCommand(MANIFEST.COMMANDS.expandAll, () =>
        this.postCommandToActiveWebview('expandAll')
      ),
      vscode.workspace.onDidChangeTextDocument(e => debouncedReload.run(e)),
    ];
  }

  private async postCommandToActiveWebview(command: string): Promise<boolean> {
    const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab?.input;
    if (!(activeTab instanceof vscode.TabInputCustom)) {
      logger.warning('Active tab is not a custom editor.');
      return false;
    }

    const controller = this.webviewControllerByPath.get(activeTab.uri.path);
    if (!controller) {
      logger.warning('Active tab does not have a webview controller.');
      return false;
    }

    return controller.panel.webview.postMessage({command});
  }
}
