import {ViewModel} from '../types/view_model';
import {vsCodeApi} from '../common/vscode_api';
import {Debouncer} from '../common/debouncer';
import {logger} from '../common/logger';
import {isDeepEqual, seconds} from '../common/utilities';
import {ViewState, WebviewState} from '../types/webview_state';

const NOISY_KEYS = ['lastSelectedNodeId', 'selectedNodeId'];
const EXTENSION_MONITORED_KEYS = ['columnWidths', 'expandedNodeIds'] as const;
type ExtensionMonitoredKey = typeof EXTENSION_MONITORED_KEYS[number];

const ROOT_PLIST_NODE: Readonly<ViewModel> = {
  id: -1,
  key: '<placeholder>',
  type: 'String',
  value: '<placeholder>',
};

/**
 * State management system that handles:
 *   - automatically saving changes made to the state object to the VS Code
 *     webview state storage system.
 *   - notifying the extension when any state property is modified that the
 *     extension would be interested in.
 */
export class StateManager implements WebviewState {
  private readonly viewState: ViewState = {
    expandedNodeIds: [],
    isReadonly: false,
    columnWidths: {},
  };
  private viewModelState: ViewModel = ROOT_PLIST_NODE;

  private readonly stateSaver = new Debouncer(() => {
    vsCodeApi.setState({
      viewModel: this.viewModelState,
      view: this.viewState,
    });
  }, seconds(1));

  readonly view = this.initView();

  get viewModel(): Readonly<ViewModel> {
    return this.viewModelState;
  }

  constructor() {}

  updateRoot(viewModel: ViewModel): void {
    if (this.viewModel === viewModel) return;

    this.viewModelState = viewModel;
    this.stateSaver.run();
  }

  restore() {
    const previousState = vsCodeApi.getState();
    if (previousState.view) {
      Object.assign(this.viewState, previousState.view);
    }
    if (previousState.viewModel) {
      this.updateRoot(previousState.viewModel);
    }
  }

  private initView() {
    const debouncedSave = () => this.stateSaver.run();

    return new Proxy(this.viewState, {
      set(obj, untypedKey, newValue): boolean {
        const key = String(untypedKey) as keyof typeof obj;
        if (isDeepEqual(obj[key], newValue)) {
          logger.verbose(
            'State Manager',
            `Skipped updating view state for '${key}'`,
            {key: untypedKey, newValue, oldValue: obj[key]}
          );
          return true;
        }

        const source = 'State Manager';
        const message = `Updating view state for '${key}'`;
        const args = {key: untypedKey, newValue, oldValue: obj[key]};
        NOISY_KEYS.includes(key)
          ? logger.verbose(source, message, args)
          : logger.info(source, message, args);

        const unsafeObj = obj as unknown as {[key: string]: unknown};
        unsafeObj[key] = newValue;
        debouncedSave();

        const typedKey = key as ExtensionMonitoredKey;
        if (EXTENSION_MONITORED_KEYS.includes(typedKey)) {
          vsCodeApi.postMessage({
            command: 'webviewStateChanged',
            payload: {key: typedKey, newValue},
          });
        }

        return true;
      },
    });
  }
}
