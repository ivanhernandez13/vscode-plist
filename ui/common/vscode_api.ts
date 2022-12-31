import {logger} from './logger';
import {WebviewMessage} from '../types/message';
import {WebviewState} from '../types/webview_state';

interface NativeVsCodeApi<T extends object> {
  postMessage(msg: {}): void;
  setState(state: T): void;
  getState(): Partial<T>;
}

declare function acquireVsCodeApi(): NativeVsCodeApi<{}>;

class VsCodeApi<T extends object> implements NativeVsCodeApi<T> {
  private readonly internalVSCodeApi = acquireVsCodeApi();

  postMessage(msg: WebviewMessage): void {
    logger.info('VSCode Webview API', `Outgoing message '${msg.command}'`, msg);
    this.internalVSCodeApi.postMessage(msg);
  }
  setState(state: T): void {
    logger.info('VSCode Webview API', 'Saving state', state);
    this.internalVSCodeApi.setState(state);
  }
  getState(): Partial<T> {
    const state = this.internalVSCodeApi.getState() ?? {};
    logger.info('VSCode Webview API', 'Restoring state', state);
    return state;
  }
}

export const vsCodeApi = new VsCodeApi<WebviewState>();
