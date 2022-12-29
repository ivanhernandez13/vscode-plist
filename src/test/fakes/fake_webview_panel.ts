import * as vscode from 'vscode';
import {PlainObject} from '../../common/utilities/object';
import {promisifyEvent} from '../helpers/utils';

export class FakeWebview<T extends object> implements vscode.Webview {
  constructor(
    readonly html = '',
    readonly cspSource = '',
    readonly options: vscode.WebviewOptions = {}
  ) {}

  protected readonly didReceiveMessage = new vscode.EventEmitter<T>();
  readonly onDidReceiveMessage = this.didReceiveMessage.event;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  postMessage(message: PlainObject): Promise<boolean> {
    return Promise.resolve(true);
  }

  asWebviewUri(localResource: vscode.Uri): vscode.Uri {
    return localResource;
  }
}

export class SuperFakeWebview<T extends object> extends FakeWebview<T> {
  override postMessage(message: PlainObject): Promise<boolean> {
    this.didPostMessage.fire(message);
    return super.postMessage(message);
  }

  private readonly didPostMessage = new vscode.EventEmitter<PlainObject>();
  readonly onDidPostMessage = this.didPostMessage.event;

  postWebviewMessage(message: T): void {
    this.didReceiveMessage.fire(message);
  }

  postWebviewMessageAwaitResponseType(
    message: T,
    responseType: string
  ): Promise<PlainObject> {
    this.postWebviewMessage(message);
    return promisifyEvent(
      this.onDidPostMessage,
      message => message.command === responseType
    );
  }
}

export class FakeWebviewPanel implements vscode.WebviewPanel {
  constructor(
    readonly webview: vscode.Webview,
    readonly viewType = '',
    readonly title = '',
    readonly options: vscode.WebviewPanelOptions = {},
    readonly viewColumn: vscode.ViewColumn | undefined = undefined,
    public active = true,
    public visible = true
  ) {}

  readonly didChangeViewState =
    new vscode.EventEmitter<vscode.WebviewPanelOnDidChangeViewStateEvent>();
  readonly onDidChangeViewState = this.didChangeViewState.event;

  readonly didDispose = new vscode.EventEmitter<void>();
  readonly onDidDispose = this.didDispose.event;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  reveal(viewColumn?: vscode.ViewColumn, preserveFocus?: boolean): void {}
  dispose() {}
}
