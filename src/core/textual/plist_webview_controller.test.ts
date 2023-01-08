import * as plist from 'plist';
import * as vscode from 'vscode';
import {readme} from '../../common/logging/logger';
import {StorageLocations} from '../../common/storage_location';
import {disposeAndClear} from '../../common/utilities/disposable';
import {ObjectUtils, PlainObject} from '../../common/utilities/object';
import {WebviewMessage} from '../../common/webview_types/message';
import {FakeMemento} from '../../test/fakes/fake_scoped_memento';
import {
  SuperFakeWebview,
  FakeWebviewPanel,
} from '../../test/fakes/fake_webview_panel';
import {expectToBeDefined} from '../../test/helpers/expectations';
import {BinaryPlistEditorProvider} from '../binary/binary_plist_editor_provider';
import {MANIFEST} from '../manifest';
import {PlistWebviewController} from './plist_webview_controller';

const JSON_CONTENT = {
  BooleanItem: true,
  IntItem: 1,
  FloatItem: 100.001,
  StringItem: '',
  ArrayItem: [''],
  DictItem: {DictStringItem: ''},
  DateItem: new Date(),
  DataItem: Buffer.from('SGVsbG8gV29ybGQh', 'base64'),
};
const PLIST_CONTENT = plist.build(JSON_CONTENT);

function plistOmittingKeys<T extends plist.PlistObject>(
  object: T,
  ...keys: Array<keyof T>
): string {
  const json = ObjectUtils.omit(object, ...keys);
  return plist.build(json);
}

interface NewEntry {
  index: number;
  entry: [string, plist.PlistValue];
}

function plistAddingKeys<T extends plist.PlistObject>(
  object: T,
  newEntries2: NewEntry | NewEntry[]
): string {
  const entries = Array.from(Object.entries(object));
  const newEntries = Array.isArray(newEntries2) ? newEntries2 : [newEntries2];
  for (const newEntry of newEntries) {
    entries.splice(newEntry.index, 0, newEntry.entry);
  }
  const ret = Object.fromEntries(entries);
  readme('addingKeys', ret);
  return plist.build(ret);
}

function fakeFileSystemUri(relpath: string): vscode.Uri {
  return vscode.Uri.from({
    scheme: 'ffs',
    path: '/root/' + relpath,
  });
}

async function webviewWithContent(
  content: string,
  disposables: vscode.Disposable[]
) {
  const document = await vscode.workspace.openTextDocument({content});
  return webviewWithDocument(document, disposables);
}

function webviewWithDocument(
  document: vscode.TextDocument,
  disposables: vscode.Disposable[]
) {
  const webview = new SuperFakeWebview<WebviewMessage>();
  const webviewPanel = new FakeWebviewPanel(webview);
  const extensionUri = fakeFileSystemUri('vscode-plist');
  const storageLocations: StorageLocations = {
    bplist: fakeFileSystemUri('binary'),
    mobileprovision: fakeFileSystemUri('mobileprovision'),
  };
  const memento = new FakeMemento();
  const webviewController = new PlistWebviewController(
    document,
    webviewPanel,
    extensionUri,
    storageLocations,
    memento
  );
  disposables.push(webviewController);
  return {
    webviewController,
    document,
    webview,
    webviewPanel,
    storageLocations,
    memento,
  };
}

async function documentWithUri(
  uri: vscode.Uri,
  content = ''
): Promise<vscode.TextDocument> {
  const realDocument = await vscode.workspace.openTextDocument({content});
  return {...realDocument, uri};
}

describe('Plist Webview Controller', () => {
  const disposables: vscode.Disposable[] = [];

  afterEach(() => {
    disposeAndClear(disposables);
  });

  it('detects readonly mobileprovision webviews', async () => {
    const mobileProvisionUri = fakeFileSystemUri(
      'mobileprovision/file.mobileprovision'
    );
    const document = await documentWithUri(mobileProvisionUri);
    const {webviewController} = webviewWithDocument(document, disposables);
    expect(webviewController.docAttributes).toEqual({
      isGenerated: true,
      isReadonly: true,
    });
  });

  it('detects writeable binary plists', async () => {
    const binaryPlistUri = fakeFileSystemUri('binary/bplist.plist');
    const document = await documentWithUri(binaryPlistUri);
    spyOnProperty(
      BinaryPlistEditorProvider,
      'usingMacosDecoder'
    ).and.returnValue(true);
    const {webviewController} = webviewWithDocument(document, disposables);
    expect(webviewController.docAttributes).toEqual({
      isGenerated: true,
      isReadonly: false,
    });
  });

  it('detects readonly binary plists', async () => {
    const binaryPlistUri = vscode.Uri.joinPath(
      fakeFileSystemUri('binary'),
      'bplist.plist'
    );
    const document = await documentWithUri(binaryPlistUri);
    spyOnProperty(
      BinaryPlistEditorProvider,
      'usingMacosDecoder'
    ).and.returnValue(false);
    const {webviewController} = webviewWithDocument(document, disposables);
    expect(webviewController.docAttributes).toEqual({
      isGenerated: true,
      isReadonly: true,
    });
  });

  it('updates expanded nodes', async () => {
    const {memento, webview} = await webviewWithContent(
      PLIST_CONTENT,
      disposables
    );
    expect(memento.keys().length).toBe(0);

    webview.postWebviewMessage({
      command: 'webviewStateChanged',
      payload: {key: 'expandedNodeIds', newValue: [0, 1, 3]},
    });
    const key = memento.oneAndOnlyKey;
    if (!expectToBeDefined(key)) return;
    expect(memento.get(key)).toEqual([0, 1, 3]);
  });

  it('updates column widths', async () => {
    const {memento, webview} = await webviewWithContent(
      PLIST_CONTENT,
      disposables
    );
    expect(memento.keys().length).toBe(0);

    webview.postWebviewMessage({
      command: 'webviewStateChanged',
      payload: {key: 'columnWidths', newValue: {first: '30'}},
    });
    const key = memento.oneAndOnlyKey;
    if (!expectToBeDefined(key)) return;
    expect(memento.get(key)).toEqual({first: 30});

    webview.postWebviewMessage({
      command: 'webviewStateChanged',
      payload: {key: 'columnWidths', newValue: {second: '15'}},
    });
    expect(memento.get(key)).toEqual({second: 15});

    webview.postWebviewMessage({
      command: 'webviewStateChanged',
      payload: {key: 'columnWidths', newValue: {first: '30', second: '15'}},
    });
    expect(memento.get(key)).toEqual({first: '30', second: '15'});
  });

  it('redirects to default editor', async () => {
    const {document, webview} = await webviewWithContent(
      PLIST_CONTENT,
      disposables
    );

    const spy = spyOn(vscode.commands, 'executeCommand');
    webview.postWebviewMessage({command: 'openWithDefaultEditor'});
    expect(spy).toHaveBeenCalledWith(
      MANIFEST.commands.openWithDefaultEditor,
      document.uri
    );
  });

  it('deletes node', async () => {
    const {document, webview, webviewController} = await webviewWithContent(
      PLIST_CONTENT,
      disposables
    );
    await webviewController.renderEditor();
    const originalContent = document.getText();

    await webview.postWebviewMessageAwaitResponseType(
      {command: 'viewModelDelete', id: 1},
      'renderViewModel'
    );

    const updatedContent = document.getText();
    expect(updatedContent).not.toEqual(originalContent);
    expect(updatedContent).toEqual(
      plistOmittingKeys(JSON_CONTENT, 'BooleanItem')
    );

    const lastId = ObjectUtils.deepLength(JSON_CONTENT) - 1;
    await webview.postWebviewMessageAwaitResponseType(
      {command: 'viewModelDelete', id: lastId},
      'renderViewModel'
    );

    expect(document.getText()).toEqual(
      plistOmittingKeys(JSON_CONTENT, 'BooleanItem', 'DataItem')
    );
  });

  it('inserts node', async () => {
    const {document, webview, webviewController} = await webviewWithContent(
      PLIST_CONTENT,
      disposables
    );
    await webviewController.renderEditor();
    const originalContent = document.getText();

    await webview.postWebviewMessageAwaitResponseType(
      {command: 'viewModelAdd', id: 0},
      'renderViewModel'
    );

    let updatedContent = document.getText();
    expect(updatedContent).not.toEqual(originalContent);
    const updates: NewEntry[] = [{index: 0, entry: ['New item', true]}];
    expect(updatedContent).toEqual(plistAddingKeys(JSON_CONTENT, updates));

    await webview.postWebviewMessageAwaitResponseType(
      {command: 'viewModelAdd', id: 4},
      'renderViewModel'
    );

    updatedContent = document.getText();
    updates.push({index: 4, entry: ['New item - 2', true]});
    expect(updatedContent).toEqual(plistAddingKeys(JSON_CONTENT, updates));
  });

  it('updates node', async () => {
    //TODO
  });

  it('renders view model when requested ', async () => {
    const {webview, webviewController} = await webviewWithContent(
      PLIST_CONTENT,
      disposables
    );
    const fakePanel = webviewController.panel as FakeWebviewPanel;
    fakePanel.visible = false;

    const response = await webview.postWebviewMessageAwaitResponseType(
      {command: 'viewModelRequest'},
      'renderViewModel'
    );
    expect(
      ObjectUtils.deepLength(response.viewModel as PlainObject)
    ).toBeGreaterThan(0);
  });
});
