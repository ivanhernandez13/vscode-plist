import {ColumnWidths} from './webview_state';

interface WebviewCommandMessage<T extends string> {
  command: T;
}

type BaseMsg<T extends string> = WebviewCommandMessage<T>;

export type WebviewStateChangedMessagePayload =
  | {key: 'columnWidths'; newValue: ColumnWidths}
  | {key: 'expandedNodeIds'; newValue: number[]};

interface WebviewStateChangedMessage extends BaseMsg<'webviewStateChanged'> {
  payload: WebviewStateChangedMessagePayload;
}

interface ViewModelAddMessage extends BaseMsg<'viewModelAdd'> {
  id: number;
}

interface ViewModelDeleteMessage extends BaseMsg<'viewModelDelete'> {
  id: number;
}

interface ViewModelUpdateMessage extends BaseMsg<'viewModelUpdate'> {
  kind: 'key' | 'type' | 'value';
  id: number;
  newValue: string;
}

export type WebviewMessage =
  | WebviewStateChangedMessage
  | ViewModelAddMessage
  | ViewModelDeleteMessage
  | ViewModelUpdateMessage
  | WebviewCommandMessage<'openWithDefaultEditor'>
  | WebviewCommandMessage<'viewModelRequest'>;
