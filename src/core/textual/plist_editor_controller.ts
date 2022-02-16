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

  private readonly editorByUri = new Map<string, PlistWebviewController>();

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
    };

    let webviewController = this.editorByUri.get(filepath);
    if (!webviewController) {
      webviewController = new PlistWebviewController(
        document,
        webviewPanel.webview,
        this.extensionUri,
        this.storageLocations,
        persistentState
      );
      this.disposables.push(webviewController);

      const disposable = webviewPanel.onDidDispose(() => {
        webviewController?.dispose();
        disposable.dispose();
        this.editorByUri.delete(filepath);
      });

      this.editorByUri.set(filepath, webviewController);
    }

    return webviewController.renderEditor();
  }

  private performRegistrations(): vscode.Disposable[] {
    const debouncedReload = new Debouncer(
      (e: vscode.TextDocumentChangeEvent) => {
        const document = this.editorByUri.get(e.document.uri.path);
        if (!document) return;

        const updatedContent = e.document.getText();
        if (!updatedContent) return;

        document.renderEditor(updatedContent);
      },
      100
    );

    return [
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

    const controller = this.editorByUri.get(activeTab.uri.path);
    if (!controller) {
      logger.logWarning('Active tab does not have a webview controller.');
      return false;
    }

    return controller.webview.postMessage({command});
  }
}
