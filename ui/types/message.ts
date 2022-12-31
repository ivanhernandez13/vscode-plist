import {ColumnWidths} from './webview_state';

interface OpenWithDefaultEditorMessage {
  command: 'openWithDefaultEditor';
}

export type WebviewStateChangedMessagePayload =
  | {key: 'columnWidths'; newValue: ColumnWidths}
  | {key: 'expandedNodeIds'; newValue: number[]};

interface WebviewStateChangedMessage {
  command: 'webviewStateChanged';
  payload: WebviewStateChangedMessagePayload;
}

interface ViewModelAddMessage {
  command: 'viewModelAdd';
  id: number;
}

interface ViewModelDelete {
  command: 'viewModelDelete';
  id: number;
}

interface ViewModelUpdate {
  command: 'viewModelUpdate';
  kind: 'key' | 'type' | 'value';
  id: number;
  newValue: string;
}

export type WebviewMessage =
  | OpenWithDefaultEditorMessage
  | WebviewStateChangedMessage
  | ViewModelAddMessage
  | ViewModelDelete
  | ViewModelUpdate;
