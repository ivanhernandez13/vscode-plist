import * as vscode from 'vscode';
import {SelfDisposing} from '../../common/utilities/self_disposing';
import {EDITOR_COMMANDS} from '../commands';
import {PlistWebviewController} from './plist_webview_controller';
import {scopedMemento} from '../../common/utilities/scoped_memento';
import {Debouncer} from '../../common/utilities/debouncer';
import {logger} from '../../common/logging/extension_logger';
import {StorageLocations} from '../../common/storage_location';

function keyName(path: string, name: string): string {
  return `plistEditor:${path}.${name}`;
}

/** Registers a custom textual editor for property list files. */
export class PlistEditorController
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

    const persistentState = {
      expandedNodes: scopedMemento(
        this.memento,
        keyName(filepath, 'expandedNodes'),
        []
      ),
      columnWidths: scopedMemento(this.memento, keyName('column', 'width'), {}),
    };

    let webviewController = this.webviewControllerByPath.get(filepath);
    if (!webviewController) {
      webviewController = new PlistWebviewController(
        document,
        webviewPanel,
        this.extensionUri,
        this.storageLocations,
        persistentState
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
      (e: vscode.TextDocumentChangeEvent) => {
        const controller = this.webviewControllerByPath.get(
          e.document.uri.path
        );
        if (!controller) return;

        const updatedContent = e.document.getText();
        if (!updatedContent) return;

        controller.renderEditor(updatedContent);
      },
      500
    );

    return [
      vscode.workspace.onDidChangeConfiguration(e => {
        if (!e.affectsConfiguration('binaryPlist.decoder')) return;

        for (const [
          path,
          controller,
        ] of this.webviewControllerByPath.entries()) {
          if (controller.docAttributes.isGenerated) {
            controller.dispose();
            this.webviewControllerByPath.delete(path);
          }
        }
      }),
      vscode.window.registerCustomEditorProvider(
        PlistEditorController.viewType,
        this,
        {
          webviewOptions: {enableFindWidget: true},
        }
      ),
      vscode.commands.registerCommand(
        EDITOR_COMMANDS.openWithDefaultEditor,
        resource => {
          vscode.commands.executeCommand(
            EDITOR_COMMANDS.openWith,
            resource,
            'default'
          );
        }
      ),
      vscode.commands.registerCommand(
        EDITOR_COMMANDS.openWithPlistEditor,
        resource => {
          vscode.commands.executeCommand(
            EDITOR_COMMANDS.openWith,
            resource,
            PlistEditorController.viewType
          );
        }
      ),
      vscode.commands.registerCommand(EDITOR_COMMANDS.collapseAll, () =>
        this.postCommandToActiveWebview('collapseAll')
      ),
      vscode.commands.registerCommand(EDITOR_COMMANDS.expandAll, () =>
        this.postCommandToActiveWebview('expandAll')
      ),
      vscode.workspace.onDidChangeTextDocument(e => debouncedReload.run(e)),
    ];
  }

  private async postCommandToActiveWebview(command: string): Promise<boolean> {
    const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab?.input;
    if (!(activeTab instanceof vscode.TabInputCustom)) {
      logger.logWarning('Active tab is not a custom editor.');
      return false;
    }

    const controller = this.webviewControllerByPath.get(activeTab.uri.path);
    if (!controller) {
      logger.logWarning('Active tab does not have a webview controller.');
      return false;
    }

    return controller.panel.webview.postMessage({command});
  }
}
