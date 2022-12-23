import * as vscode from 'vscode';

import {PlistEntry, PlistEntryType} from './model/plist_view_model';
import {UriUtils, getConfiguration} from '../../common/utilities/vscode';

import {BinaryPlistEditorController} from '../binary/binary_plist_editor_controller';
import {MANIFEST} from '../manifest';
import {PlainObject} from '../../common/utilities/object';
import {PlistOperations} from './plist_operations';
import {ScopedMemento} from '../../common/utilities/scoped_memento';
import {SelfDisposing} from '../../common/utilities/self_disposing';
import {StorageLocations} from '../../common/storage_location';
import {arrayRemove} from '../../common/utilities/array';
import {errorMessageOrToString} from '../binary/decoder/error';

function entriesWithNumberOfChildren(
  node: PlistEntry,
  count: number,
  result: PlistEntry[]
) {
  if (!node.children) return;

  if (node.children.length <= count) {
    result.push(node);
  }
  for (const child of node.children) {
    entriesWithNumberOfChildren(child, count, result);
  }
}

/**
 * Renders and communicates with the underlying webview that serves as the plist
 * editor.
 */
export class PlistWebviewController extends SelfDisposing {
  private readonly operations: PlistOperations;

  private pendingContent?: string;

  readonly docAttributes: {
    readonly isGenerated: boolean;
    readonly isReadonly: boolean;
  };

  constructor(
    private readonly document: vscode.TextDocument,
    readonly panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    private readonly storageLocations: StorageLocations,
    private readonly persistentState: {
      expandedNodes: ScopedMemento<number[]>;
      columnWidths: ScopedMemento<{first?: string; second?: string}>;
    }
  ) {
    super();
    this.operations = new PlistOperations(document);
    this.disposables.push(this.operations);
    this.docAttributes = this.calculateDocAttributes();

    const webview = panel.webview;
    webview.options = {
      enableScripts: true,
    };
    const getWebviewUri = (filename: string, subpath = ['ui']) =>
      webview.asWebviewUri(
        vscode.Uri.joinPath(extensionUri, ...subpath, filename)
      );
    webview.html = this.renderHTML({
      scripts: [getWebviewUri('webview.js')],
      stylesheets: [
        getWebviewUri('webview.css'),
        getWebviewUri('codicon.css', [
          'node_modules',
          '@vscode/codicons',
          'dist',
        ]),
      ],
    });

    webview.onDidReceiveMessage(
      async m => {
        if (!this.handleIncomingMessages(m)) return;

        this.operations.update();

        const viewModel = await this.viewModelOrPostError();
        if (!viewModel) return;

        const spacing = getConfiguration(MANIFEST.SETTINGS.spacing);
        webview.postMessage({
          command: 'renderViewModel',
          viewModel,
          expandedNodes: this.persistentState.expandedNodes.get(),
          columnWidths: this.persistentState.columnWidths.get(),
          spacing,
        });
      },
      this,
      this.disposables
    );

    panel.onDidChangeViewState(
      s => {
        if (!s.webviewPanel.visible || this.pendingContent === undefined) {
          return;
        }

        const content = this.pendingContent;
        this.pendingContent = undefined;
        this.renderEditor(content);
      },
      this,
      this.disposables
    );

    this.disposables.push(panel);
  }

  private calculateDocAttributes(): {
    readonly isGenerated: boolean;
    readonly isReadonly: boolean;
  } {
    const documentDir = UriUtils.dirname(this.document.uri).path;
    const isGenerated = Object.values(this.storageLocations).some(
      (location: vscode.Uri) => location.path === documentDir
    );
    const isReadonly =
      // Provisioning profiles are not writeable.
      this.storageLocations.mobileprovision.path === documentDir ||
      // Binary plists can only be edited when the decoder is plutil which is
      // only available on local macOS clients.
      (isGenerated && !BinaryPlistEditorController.usingMacosDecoder);
    return {isGenerated, isReadonly};
  }

  async renderEditor(updatedContent?: string): Promise<void> {
    if (!this.panel.visible) {
      this.pendingContent = updatedContent;
      return;
    }

    if (updatedContent) {
      // TODO: This should not be needed, the model should update itself
      // whenever a node is added or removed.
      this.operations.reloadModel(updatedContent);
    }
    const viewModel = await this.viewModelOrPostError();
    if (!viewModel) return;

    if (!this.persistentState.expandedNodes.exists()) {
      const children: PlistEntry[] = [];
      entriesWithNumberOfChildren(viewModel, 1, children);
      this.persistentState.expandedNodes.update(
        children.map(c => c.id).concat([0])
      );
    }

    const spacing = getConfiguration(MANIFEST.SETTINGS.spacing);
    this.panel.webview.postMessage({
      command: 'renderViewModel',
      viewModel,
      expandedNodes: this.persistentState.expandedNodes.get(),
      isReadonly: this.docAttributes.isReadonly,
      columnWidths: this.persistentState.columnWidths.get(),
      spacing,
    });
  }

  private async viewModelOrPostError(): Promise<PlistEntry | undefined> {
    try {
      return await this.operations.viewModel;
    } catch (err) {
      this.panel.webview.postMessage({
        command: 'renderError',
        errorMessage: errorMessageOrToString(err),
      });
    }
    return undefined;
  }

  private handleIncomingMessages(message: PlainObject): boolean {
    if (typeof message.command !== 'string') {
      return false;
    }

    switch (message.command) {
      case 'viewModelAdd':
      case 'viewModelDelete': {
        if (typeof message.id !== 'number') {
          break;
        }

        const messageId = message.id;
        const expandedNodes = this.persistentState.expandedNodes.get();
        if (message.command === 'viewModelAdd') {
          if (this.operations.modifier.addNodeModel(message.id)) {
            this.persistentState.expandedNodes.update(
              expandedNodes.map(id => (id > messageId ? id + 1 : id))
            );
            return true;
          }
        } else {
          if (this.operations.modifier.deleteNodeModel(message.id)) {
            arrayRemove(expandedNodes, messageId);
            this.persistentState.expandedNodes.update(
              expandedNodes.map(id => (id > messageId ? id - 1 : id))
            );
            return true;
          }
        }
        return false;
      }

      case 'updateViewModelNode':
        if (typeof message.id !== 'number') {
          break;
        } else if (typeof message.kind !== 'string') {
          break;
        } else if (typeof message.newValue !== 'string') {
          break;
        }

        switch (message.kind) {
          case 'key':
            return this.operations.modifier.updateModelNodeKey(
              message.id,
              message.newValue
            );
          case 'type':
            return this.operations.modifier.updateModelNodeType(
              message.id,
              message.newValue as PlistEntryType
            );
          case 'value':
            return this.operations.modifier.updateModelNodeValue(
              message.id,
              message.newValue
            );
        }
        break;

      case 'expandedNodesChange':
        if (Array.isArray(message.ids)) {
          this.persistentState.expandedNodes.update(message.ids);
        }
        break;

      case 'searchOnType':
        // TODO: Figure out how to make find first instance.
        // vscode.commands.executeCommand('editor.action.webvieweditor.showFind');
        break;

      case 'columnWidthsChange': {
        const columnWidths = message.columnWidths as {
          first?: string;
          second?: string;
        };
        this.persistentState.columnWidths.update(columnWidths);
        break;
      }

      case 'openWithDefaultEditor':
        vscode.commands.executeCommand(
          MANIFEST.COMMANDS.openWithDefaultEditor,
          this.document.uri
        );
        break;

      default:
        break;
    }
    return false;
  }

  private renderScripts(scripts: vscode.Uri[]): string {
    return scripts
      .map(s => `<script type="module" src="${s}"></script>`)
      .join('<br>');
  }

  private renderStylesheets(stylesheets: vscode.Uri[]): string {
    return stylesheets
      .map(s => `<link rel="stylesheet" href="${s}">`)
      .join('<br>');
  }

  private renderHTML(external: {
    scripts: vscode.Uri[];
    stylesheets: vscode.Uri[];
  }): string {
    const head =
      this.renderScripts(external.scripts) +
      '\n' +
      this.renderStylesheets(external.stylesheets);

    let body = "<div id='bodyContent'></div>";
    if (this.docAttributes.isGenerated) {
      const title =
        'This is a generated file' +
        (this.docAttributes.isReadonly
          ? ' and cannot be edited'
          : ', changes are automatically saved to the binary file') +
        '. Click to hide.';
      body = `<div id='generatedBanner' title="${title}"></div>${body}`;
    }

    return html(body, head);
  }
}

function html(body: string, head = ''): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${head}
  <title>Webview</title>
</head>
<body>
    ${body}
</body>
</html>`;
}
