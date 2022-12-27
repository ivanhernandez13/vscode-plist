'use strict';

/* -------------------------------------------------------------------------- */
/*                                   Logging                                  */
/* -------------------------------------------------------------------------- */

type WebviewLogSeverity = 'verbose' | 'info' | 'warn' | 'error';
const EXTENSION_LOG_LEVEL = document.getElementById('extensionLogLevel')?.title;

class WebviewLogger {
  constructor(private readonly severity?: string) {}

  private get timestamp(): string {
    const date = new Date();
    return `${date.toLocaleDateString(
      'en-US'
    )} ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}:${date.getMilliseconds()}`;
  }

  private processArgs(
    severity: WebviewLogSeverity,
    source: string,
    message: string,
    args: unknown[]
  ): {[key: string]: unknown} {
    let processedArgs: {[key: string]: unknown} = {};

    if (args.length === 1) {
      const arg = args[0];
      processedArgs = typeof arg === 'object' ? {...arg} : {arg0: arg};
    } else {
      for (const [index, arg] of Object.entries(args)) {
        processedArgs[`arg${index}`] = arg;
      }
    }

    const timestamp = this.timestamp;
    processedArgs.__context__ = {severity, timestamp, source, message};
    return processedArgs;
  }

  private log(
    severity: WebviewLogSeverity,
    source: string,
    message: string,
    args: unknown[]
  ) {
    if (!this.severity) return;
    switch (severity) {
      case 'verbose':
        if (this.severity !== 'verbose') return;
        break;
      case 'info':
        if (['warn', 'error'].includes(this.severity)) return;
        break;
      case 'warn':
        if (['error'].includes(this.severity)) return;
        break;
      case 'error':
        console.error(message, ...args);
        return;
      default:
        break;
    }

    console.log(`[${source}]:`, message);
    console.log(this.processArgs(severity, source, message, args));
  }

  verbose(source: string, message: string, ...args: unknown[]) {
    this.log('verbose', source, message, args);
  }
  info(source: string, message: string, ...args: unknown[]) {
    this.log('info', source, message, args);
  }
  warn(source: string, message: string, ...args: unknown[]) {
    this.log('warn', source, message, args);
  }
  error(source: string, message: string, ...args: unknown[]) {
    this.log('error', source, message, args);
  }
}
const logger = new WebviewLogger(EXTENSION_LOG_LEVEL);
logger.info('Logger', `Initiliazed with level '${EXTENSION_LOG_LEVEL}'`);

/* -------------------------------------------------------------------------- */
/*                             VSCode Webview API                             */
/* -------------------------------------------------------------------------- */

interface VsCodeApi<T extends object> {
  postMessage(msg: {}): void;
  setState(state: T): void;
  getState(): Partial<T>;
}

declare function acquireVsCodeApi(): VsCodeApi<{}>;

class VsCodeApiWrapper implements VsCodeApi<WebviewState> {
  private readonly internalVSCodeApi = acquireVsCodeApi();

  postMessage(msg: {command?: string}): void {
    logger.info('VSCode Webview API', `Outgoing message '${msg.command}'`, msg);
    this.internalVSCodeApi.postMessage(msg);
  }
  setState(state: WebviewState): void {
    logger.info('VSCode Webview API', 'Saving state', state);
    this.internalVSCodeApi.setState(state);
  }
  getState(): Partial<WebviewState> {
    const state = this.internalVSCodeApi.getState() ?? {};
    logger.info('VSCode Webview API', 'Restoring state', state);
    return state;
  }
}

const vsCodeApi: VsCodeApi<WebviewState> = new VsCodeApiWrapper();

/* -------------------------------------------------------------------------- */
/*                         View/View Model Definitions                        */
/* -------------------------------------------------------------------------- */

const PLIST_ENTRY_TYPES_WITH_CHILDREN = ['Array', 'Dictionary'] as const;
const PLIST_ENTRY_TYPES = [
  ...PLIST_ENTRY_TYPES_WITH_CHILDREN,
  'String',
  'Number',
  'Boolean',
  'Date',
  'Data',
] as const;
type PlistEntryType = typeof PLIST_ENTRY_TYPES[number];
const IMMUTABLE_PLIST_ENTRY_TYPES: Array<PlistEntryType> = [
  'Array',
  'Dictionary',
];

interface ViewModel {
  id: number;
  key: string;
  type: PlistEntryType;
  value: string;
  children?: ViewModel[];
  parent?: number;
}

interface ColumnWidths {
  first?: string;
  second?: string;
}

interface HTMLRowKey {
  container: HTMLDivElement;
  expandButton: HTMLButtonElement;
  plusButton: HTMLButtonElement;
  minusButton?: HTMLButtonElement;
  inputBox: HTMLInputElement;
}

interface HTMLRowType {
  dropdown: HTMLSelectElement;
}

interface HTMLRowValueInput {
  inputBox: HTMLInputElement;
}
interface HTMLRowValueSelect {
  dropdown: HTMLSelectElement;
}
type HTMLRowValue = (HTMLRowValueInput | HTMLRowValueSelect) & {
  element: HTMLInputElement | HTMLSelectElement;
};

interface HTMLRow {
  container: HTMLTableRowElement;
  key: HTMLRowKey;
  type: HTMLRowType;
  value: HTMLRowValue;
  isExpanded: boolean;
  indentation: number;
}

interface ViewAndViewModel {
  view: HTMLRow;
  viewModel: ViewModel;
}

interface ViewState {
  activeInputElement?: HTMLInputElement | HTMLSelectElement;
  columnWidths: ColumnWidths;
  errorMessage?: string;
  expandedNodeIds: number[];
  isReadonly?: boolean;
  lastSelectedNodeId?: number;
  newlyInsertedNode?: number;
  selectedNodeId?: number;
  spacing?: string;
}

interface WebviewState {
  view: ViewState;
  viewModel: ViewModel;
}

const ROOT_PLIST_NODE: Readonly<ViewModel> = {
  id: -1,
  key: '<placeholder>',
  type: 'String',
  value: '<placeholder>',
};

/* -------------------------------------------------------------------------- */
/*                               State Handling                               */
/* -------------------------------------------------------------------------- */

const EXTENSION_MONITORED_KEYS = ['columnWidths', 'expandedNodeIds'];
const NOISY_KEYS = ['lastSelectedNodeId', 'selectedNodeId'];
/**
 * State management system that handles:
 *   - automatically saving changes made to the state object to the VS Code
 *     webview state storage system.
 *   - notifying the extension when any state property is modified that the
 *     extension would be interested in.
 */
class StateManager implements WebviewState {
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
      set(obj, key, newValue): boolean {
        const keyStr = String(key);
        if (isDeepEqual(obj[key], newValue)) {
          logger.verbose(
            'State Manager',
            `Skipped updating view state for '${keyStr}'`,
            {key, newValue, oldValue: obj[key]}
          );
          return true;
        }

        const source = 'State Manager';
        const message = `Updating view state for '${keyStr}'`;
        const args = {key, newValue, oldValue: obj[key]};
        NOISY_KEYS.includes(keyStr)
          ? logger.verbose(source, message, args)
          : logger.info(source, message, args);

        obj[key] = newValue;
        debouncedSave();

        if (EXTENSION_MONITORED_KEYS.includes(keyStr)) {
          vsCodeApi.postMessage({
            command: 'webviewStateChanged',
            payload: {key, newValue},
          });
        }

        return true;
      },
    });
  }
}

/* -------------------------------------------------------------------------- */
/*                             Webview Controller                             */
/* -------------------------------------------------------------------------- */

const ROOT_NODE_ID = 0;
const BODY_CONTENT = document.getElementById('bodyContent')!;
const GENERATED_BANNER = document.getElementById('generatedBanner');

class WebviewController {
  private readonly state = new StateManager();
  private readonly renderer = new ViewModelRenderer(this.state.view);

  constructor() {
    this.configureGlobalEventListeners();
    this.restoreWebviewFromSavedState();
    this.renderBannerForGeneratedFiles();
    this.watchAttributeMutations();
    this.updateColorTheme();
    this.state.view.activeInputElement = undefined;
  }

  private renderBannerForGeneratedFiles() {
    if (!GENERATED_BANNER) return;

    GENERATED_BANNER.childNodes.forEach(child => child.remove());
    const banner = createElement('input', 'banner', {
      type: 'text',
      readOnly: true,
      value: GENERATED_BANNER.title,
    });
    GENERATED_BANNER.append(banner, createElement('input', 'banner-offset'));
    banner.addEventListener('click', () => {
      GENERATED_BANNER.remove();
    });
  }

  private renderErrorBody(errorMessage: string): void {
    const errorIcon = createElement('span', ['codicon', 'codicon-error']);
    errorIcon.style.fontSize = '48px';

    const errorLink = createElement('a', ['monaco-link', 'error-div-link'], {
      innerText: 'Open with Default Editor',
      href: '#',
    });
    errorLink.addEventListener('click', () => {
      vsCodeApi.postMessage({command: 'openWithDefaultEditor'});
    });

    const elements = [
      createDiv([errorIcon], 'error-icon-container'),
      createElement('span', 'error-div-text', {
        innerText:
          'The plist editor could not be opened due to an unexpected error:\n' +
          errorMessage,
      }),
      errorLink,
    ];

    BODY_CONTENT.style.height = '100%';
    BODY_CONTENT.replaceChildren(createDiv(elements, 'error-div'));
  }

  private restoreWebviewFromSavedState() {
    this.state.restore();
    this.state.view.errorMessage
      ? this.renderErrorBody(this.state.view.errorMessage)
      : this.renderWebviewBody(this.state.viewModel);
  }

  private collectViewAndViewModels(viewModel: ViewModel): ViewAndViewModel[] {
    const viewModels = [viewModel];
    for (const child of viewModel.children ?? []) {
      this.collectViewModels(child, viewModels);
    }
    return viewModels
      .map(n => this.renderer.viewAndViewModelById.get(n.id))
      .filter((n): n is ViewAndViewModel => n !== undefined);
  }

  private collectViewModels(
    viewModel: ViewModel,
    viewModels: ViewModel[]
  ): void {
    viewModels.push(viewModel);
    for (const child of viewModel.children ?? []) {
      this.collectViewModels(child, viewModels);
    }
  }

  private allViewModelIds(): number[] {
    const viewModels: ViewModel[] = [];
    this.collectViewModels(this.state.viewModel, viewModels);
    return viewModels.map(viewModel => viewModel.id);
  }

  private onMessageReceived(e: MessageEvent): void {
    const viewState = this.state.view;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const message: any = e.data;
    logger.info(
      'Webview Controller',
      `Incoming message: ${message.command}`,
      message
    );
    switch (message.command) {
      case 'renderViewModel':
        logger.info(
          'Webview Controller',
          'Rendering view model',
          message.viewModel
        );
        viewState.errorMessage = undefined;
        viewState.expandedNodeIds = message.expandedNodes;
        viewState.isReadonly = message.isReadonly;
        viewState.columnWidths = message.columnWidths;
        this.renderer.setSpacing(message.spacing);
        this.renderBannerForGeneratedFiles();
        this.renderWebviewBody(message.viewModel);
        break;
      case 'expandAll':
        viewState.expandedNodeIds = this.allViewModelIds();
        this.restoreWebviewFromSavedState();
        break;
      case 'collapseAll':
        // Doesn't make sense to collapse the "Root" node.
        viewState.expandedNodeIds = [0];
        this.restoreWebviewFromSavedState();
        break;
      case 'updateSpacing':
        this.renderer.setSpacing(message.spacing);
        break;
      case 'renderError':
        viewState.errorMessage = message.errorMessage;
        this.renderErrorBody(message.errorMessage);
        break;
    }
  }

  private addPlistNode(id: number): void {
    vsCodeApi.postMessage({
      command: 'viewModelAdd',
      id,
    });
  }

  private deletePlistNode(id: number): void {
    vsCodeApi.postMessage({command: 'viewModelDelete', id});
  }

  private updatePlistNode(
    kind: 'key' | 'type' | 'value',
    id: number,
    newValue: string
  ): void {
    vsCodeApi.postMessage({
      command: 'viewModelUpdate',
      kind,
      id,
      newValue,
    });
  }

  private renderWebviewBody(rootPlistNode: ViewModel): void {
    this.state.updateRoot(rootPlistNode);

    const table = createElement('table', 'plist-table', undefined, [
      this.renderer.renderPlistRowHeader(),
      this.renderer.renderViewModel(rootPlistNode),
    ]);
    BODY_CONTENT.replaceChildren(table);
    this.renderer.setSpacing(this.state.view.spacing);

    const viewModels = Array.from(this.renderer.viewAndViewModelById.values());
    this.configurePlistNodeEventListeners(viewModels);

    if (this.state.view.newlyInsertedNode) {
      this.handleNewNode(this.state.view.newlyInsertedNode);
    }
  }

  private handleNewNode(newNodeId: number) {
    this.state.view.newlyInsertedNode = undefined;

    const viewAndModel = this.renderer.viewAndViewModelById.get(newNodeId);
    if (!viewAndModel) return;

    logger.info(
      'Webview Controller',
      'Handling newly inserted node',
      newNodeId,
      viewAndModel
    );
    viewAndModel.view.value.element.dispatchEvent(
      new MouseEvent('dblclick', {bubbles: true, cancelable: false})
    );
    viewAndModel.view.value.element.focus();
  }

  private clearSelectedNode() {
    const nodes = Array.from(
      document.getElementsByClassName(CSS.plistRowHighlight)
    );
    for (const element of nodes) {
      element.classList.remove(CSS.plistRowHighlight);
      this.state.view.lastSelectedNodeId = this.state.view.selectedNodeId;
      this.state.view.selectedNodeId = undefined;
    }

    const noHideElements = Array.from(
      document.getElementsByClassName(CSS.noHide)
    );
    for (const button of noHideElements) {
      button.classList.remove(CSS.noHide);
    }
  }

  private updateColorTheme() {
    if (document.body.classList.contains('vscode-light')) {
      document.documentElement.style.setProperty(
        '--chevron-expand-icon',
        "url('icons/chevron-expand-light.svg')"
      );
    } else if (document.body.classList.contains('vscode-dark')) {
      document.documentElement.style.setProperty(
        '--chevron-expand-icon',
        "url('icons/chevron-expand-dark.svg')"
      );
    } else if (document.body.classList.contains('vscode-high-contrast')) {
      document.documentElement.style.setProperty(
        '--chevron-expand-icon',
        "url('icons/chevron-expand-high-contrast.svg')"
      );
    }
  }

  private reloadNode(node: ViewAndViewModel) {
    this.removeChildren(node.viewModel);
    this.renderer.reloadPlistRow(node);

    const viewAndViewModels = this.collectViewAndViewModels(node.viewModel);
    this.configurePlistNodeEventListeners(viewAndViewModels);
  }

  private removeChildren(viewModel: ViewModel) {
    if (!viewModel.children) return;

    for (const child of viewModel.children) {
      this.removeChildren(child);
      const childNode = this.renderer.viewAndViewModelById.get(child.id);
      childNode?.view.container.remove();
    }
  }

  private watchAttributeMutations() {
    new MutationObserver(mutationList => {
      for (const mutation of mutationList) {
        if (
          mutation.type === 'attributes' &&
          mutation.attributeName === 'class'
        ) {
          this.updateColorTheme();
        }
      }
    }).observe(document.body, {attributes: true});
  }

  private configurePlistNodeEventListeners(
    viewAndViewModels: ViewAndViewModel[]
  ): void {
    for (const viewAndModel of viewAndViewModels) {
      const {view, viewModel} = viewAndModel;

      view.container.addEventListener('click', () => {
        this.clearSelectedNode();
        setTimeout(() => {
          if (!this.state.view.isReadonly) {
            view.key.container.classList.add(CSS.noHide);
            view.key.plusButton.classList.add(CSS.noHide);
            view.key.minusButton?.classList.add(CSS.noHide);
            view.type.dropdown.parentElement?.classList.add(CSS.noHide);
            if ('dropdown' in view.value) {
              view.value.dropdown.parentElement?.classList.add(CSS.noHide);
            }
          }
          view.container.classList.add(CSS.plistRowHighlight);
          this.state.view.selectedNodeId = viewModel.id;
        });
      });

      view.key.expandButton.addEventListener('click', () => {
        view.isExpanded
          ? arrayRemove(this.state.view.expandedNodeIds, viewModel.id)
          : this.state.view.expandedNodeIds.push(viewModel.id);
        // Trigger the set proxy handler.
        this.state.view.expandedNodeIds = deepCopy(
          this.state.view.expandedNodeIds
        );
        view.isExpanded = !view.isExpanded;
        // this.renderWebviewBody(this.state.viewModel);
        this.reloadNode(viewAndModel);

        setTimeout(() => {
          this.renderer.viewAndViewModelById
            .get(viewModel.id)
            ?.view.container.classList.add(CSS.plistRowHighlight);
          this.state.view.selectedNodeId = viewModel.id;
        });
      });

      if (this.state.view?.isReadonly) {
        view.type.dropdown.disabled = true;
        view.key.plusButton.disabled = true;
        if (view.key.minusButton) {
          view.key.minusButton.disabled = true;
        }
        continue;
      }

      view.key.minusButton?.addEventListener('click', () => {
        this.deletePlistNode(viewModel.id);
      });
      view.key.plusButton.addEventListener('click', () => {
        this.addPlistNode(viewModel.id);
        this.state.view.newlyInsertedNode = viewModel.id + 1;
        logger.verbose(
          'Webview Controller',
          'Plus button was clicked and inserted new node',
          this.state.view.newlyInsertedNode
        );
      });

      view.type.dropdown.addEventListener('click', () => {
        this.state.view.activeInputElement = view.type.dropdown;
      });
      view.type.dropdown.addEventListener('blur', () => {
        this.state.view.activeInputElement = undefined;
      });
      view.type.dropdown.addEventListener('change', event => {
        if (!(event.target instanceof HTMLSelectElement)) return;

        this.updatePlistNode('type', viewModel.id, event.target.value);
      });

      if (viewModel.id === ROOT_NODE_ID) {
        continue;
      }

      for (const inputBox of [view.key.inputBox, view.value.element]) {
        inputBox.addEventListener('dblclick', () => {
          inputBox.classList.remove(CSS.inputAsLabel);
          inputBox.classList.add(CSS.focusedInputAsLabel);
          if ('readOnly' in inputBox) {
            inputBox.readOnly = false;
          }
          this.state.view.activeInputElement = inputBox;
        });
        inputBox.addEventListener('blur', () => {
          inputBox.classList.add(CSS.inputAsLabel);
          inputBox.classList.remove(CSS.focusedInputAsLabel);
          if ('readOnly' in inputBox) {
            inputBox.readOnly = true;
          }
          this.state.view.activeInputElement = undefined;

          if (
            inputBox === view.key.inputBox &&
            viewModel.key !== inputBox.value
          ) {
            const parentId = viewModel.parent;
            if (parentId !== undefined) {
              const siblings = viewAndViewModels.find(
                vm => vm.viewModel.id === parentId
              )?.viewModel.children;
              if (siblings?.find(s => s.key === inputBox.value)) {
                ViewModelRenderer.flashErrorIndicator(inputBox);
                inputBox.value = viewModel.key;
                return;
              }
            }

            this.updatePlistNode('key', viewModel.id, inputBox.value);
          } else if (
            inputBox === view.value.element &&
            viewModel.value !== inputBox.value
          ) {
            let inputBoxValue = inputBox.value;
            switch (viewModel.type) {
              case 'Data': {
                const length = inputBox.value.length;
                const isFormattedHexString =
                  length > 1 &&
                  inputBox.value[0] === '<' &&
                  inputBox.value[length - 1] === '>';
                inputBoxValue = inputBox.value.substring(1, length - 1);
                if (!isFormattedHexString || !isHexString(inputBoxValue)) {
                  ViewModelRenderer.flashErrorIndicator(inputBox);
                  inputBox.value = viewModel.value;
                  return;
                }
                break;
              }
              case 'Number':
                if (isNaN(Number(inputBoxValue))) {
                  ViewModelRenderer.flashErrorIndicator(inputBox);
                  inputBox.value = viewModel.value;
                  return;
                }
            }

            this.updatePlistNode('value', viewModel.id, inputBoxValue);
          }
        });
      }
    }
  }

  private configureGlobalEventListeners(): void {
    const viewState = this.state.view;
    let isOnEnterTimeout = false;

    document.addEventListener('keydown', event => {
      logger.verbose(
        'Webview Controller',
        `Handling keyboard input ${event.code}`
      );
      if (viewState.activeInputElement) {
        if (['Enter', 'Escape'].includes(event.code)) {
          viewState.activeInputElement.blur();
        }

        return;
      }

      if (viewState.selectedNodeId === undefined) {
        if (event.code === 'ArrowUp') {
          viewState.selectedNodeId = viewState.lastSelectedNodeId
            ? viewState.lastSelectedNodeId + 1
            : this.renderer.viewAndViewModelById.size;
        } else if (event.code === 'ArrowDown') {
          viewState.selectedNodeId = viewState.lastSelectedNodeId
            ? viewState.lastSelectedNodeId - 1
            : -1;
        } else {
          return;
        }
      }

      const nodeId = viewState.selectedNodeId;
      const viewAndModelById = this.renderer.viewAndViewModelById;

      switch (event.code) {
        case 'ArrowUp':
          for (let id = nodeId - 1; id >= 0; id--) {
            const previous = viewAndModelById.get(id);
            if (previous) {
              previous.view.container.click();
              break;
            }
          }
          break;
        case 'ArrowDown': {
          const largestId = getLargestKey(this.renderer.viewAndViewModelById);
          for (let id = nodeId + 1; id <= largestId; id++) {
            const next = viewAndModelById.get(id);
            if (next) {
              next.view.container.click();
              break;
            }
          }
          break;
        }

        case 'ArrowLeft':
        case 'ArrowRight': {
          const node = viewAndModelById.get(nodeId);
          if (node?.viewModel.children === undefined) {
            return;
          }

          const view = node.view;
          const isConsequential =
            (event.code === 'ArrowLeft' && view.isExpanded) ||
            (event.code === 'ArrowRight' && !view.isExpanded);
          if (isConsequential) {
            view.key.expandButton.click();
          }
          break;
        }

        case 'Enter':
          if (isOnEnterTimeout) {
            logger.warn('Webview Controller', 'ignoring enter key');
            return;
          }
          isOnEnterTimeout = true;
          setTimeout(() => {
            isOnEnterTimeout = false;
          }, seconds(1));
          viewAndModelById.get(nodeId)?.view.key.plusButton.click();
          break;

        case 'Backspace':
          viewAndModelById.get(nodeId)?.view.key.minusButton?.click();
          break;

        case 'Escape':
          this.clearSelectedNode();
          break;

        default:
          // vsCodeApi.postMessage({
          //   command: 'searchOnType',
          //   code: event.code,
          // });
          break;
      }
    });

    document.addEventListener('mousedown', () => {
      this.clearSelectedNode();
    });

    window.addEventListener('message', message =>
      this.onMessageReceived(message)
    );
  }
}

/* -------------------------------------------------------------------------- */
/*                              Webview Renderer                              */
/* -------------------------------------------------------------------------- */

enum CSS {
  opaque = 'opaque',
  faded = 'faded',
  hidden = 'hidden',
  hiddenConditionally = 'hidden-conditionally',
  noHide = 'no-hide',

  plistRow = 'plist-row',
  plistRowHighlight = 'plist-row-highlight',

  keyContainer = 'key-container',
  keyContainerLeft = 'key-container-left',
  keyContainerCenter = 'key-container-center',
  keyContainerRight = 'key-container-right',
  keyContainerButton = 'key-container-button',

  expandCollapseButton = 'expand-collapse-button',
  inputAsLabel = 'input-as-label',
  focusedInputAsLabel = 'focused-input-as-label',
  selectAsLabel = 'select-as-label',

  errorFlash = 'error-flash',
}

class ViewModelRenderer {
  private readonly viewAndViewModel = new Map<number, ViewAndViewModel>();

  get viewAndViewModelById(): ReadonlyMap<number, ViewAndViewModel> {
    return this.viewAndViewModel;
  }

  constructor(private readonly viewState: ViewState) {}

  renderViewModel(rootNode: ViewModel): HTMLTableSectionElement {
    this.viewAndViewModel.clear();
    const result = createElement(
      'tbody',
      undefined,
      undefined,
      this.renderViewModelNode(rootNode, 0)
    );
    logger.info(
      'View Renderer',
      `Rendered ${result.childElementCount} view models.`
    );
    return result;
  }

  renderPlistRowHeader(): HTMLHeadElement {
    const key = createElement('th', [], {innerHTML: '<b>Key</b>'});
    const type = createElement('th', [], {innerHTML: '<b>Type</b>'});
    const value = createElement('th', [], {innerHTML: '<b>Value</b>'});

    key.style.width = this.viewState.columnWidths.first ?? '30%';
    type.style.width = this.viewState.columnWidths.second ?? '10%';

    const tableRow = createElement('tr', undefined, undefined, [
      key,
      type,
      value,
    ]);
    const tableHead = createElement('thead', [CSS.plistRow], undefined, [
      tableRow,
    ]);

    this.watchColumnWidths(tableHead, key, type, value);

    return tableHead;
  }

  private renderViewModelNode(
    node: ViewModel,
    indent: number,
    parent?: ViewModel
  ): HTMLTableRowElement[] {
    const row = this.renderPlistRow(node, indent, parent);
    this.viewAndViewModel.set(node.id, {
      view: row,
      viewModel: node,
    });
    const elements: HTMLTableRowElement[] = [row.container];
    if (node.children && row.isExpanded) {
      elements.push(
        ...node.children.flatMap(c =>
          this.renderViewModelNode(c, indent + 1, node)
        )
      );
    }
    return elements;
  }

  reloadPlistRow(node: ViewAndViewModel): void {
    const [newRow, ...children] = this.renderViewModelNode(
      node.viewModel,
      node.view.indentation
    );
    node.view.container.replaceWith(newRow);
    newRow.after(...children);
    logger.info(
      'View Renderer',
      `Rendered ${children.length + 1} view models.`
    );
  }

  private renderPlistRow(
    node: ViewModel,
    indent = 0,
    parent?: ViewModel
  ): HTMLRow {
    const isRootNode = node.id === ROOT_NODE_ID;

    const key = this.renderPlistKey(
      node.key,
      node.id,
      {
        expandable: !!node.children,
        showMinus: !isRootNode,
        immutable: isRootNode || parent?.type === 'Array',
      },
      indent
    );
    const options =
      node.id === 0 ? PLIST_ENTRY_TYPES_WITH_CHILDREN : PLIST_ENTRY_TYPES;
    const type = this.renderPlistType(node.type, options);
    const value = this.renderPlistValue(
      node.value,
      !IMMUTABLE_PLIST_ENTRY_TYPES.includes(node.type),
      node.type
    );

    const tableRow = createElement('tr', CSS.plistRow, undefined, [
      createElement('td', undefined, undefined, [key.container]),
      createElement('td', undefined, undefined, [type.dropdown]),
      createElement('td', undefined, undefined, [value.element]),
    ]);
    const isExpanded = this.isExpanded(node.id);
    return {
      container: tableRow,
      key,
      type,
      value,
      isExpanded,
      indentation: indent,
    };
  }

  private renderPlistType(
    title: string,
    options: ReadonlyArray<PlistEntryType>
  ): HTMLRowType {
    const dropdownOptions = options.map(plistType =>
      createElement('option', undefined, {
        textContent: plistType,
        value: plistType,
        selected: plistType === title,
      })
    );

    return {
      dropdown: createElement(
        'select',
        CSS.selectAsLabel,
        undefined,
        dropdownOptions
      ),
    };
  }

  private renderPlistValue(
    title: string,
    mutable: boolean,
    type: PlistEntryType
  ): HTMLRowValue {
    if (type === 'Boolean') {
      const dropdownOptions = ['YES', 'NO'].map(plistType =>
        createElement('option', undefined, {
          textContent: plistType,
          value: plistType,
          selected: plistType === title,
        })
      );

      const dropdown = createElement(
        'select',
        CSS.selectAsLabel,
        undefined,
        dropdownOptions
      );
      return {dropdown, element: dropdown};
    }

    const inputBox = createInputAsLabel(title);

    if (!mutable) {
      inputBox.disabled = true;
      inputBox.classList.add(CSS.faded);
    }

    return {inputBox, element: inputBox};
  }

  private renderPlistKey(
    title: string,
    id: number,
    options: {
      expandable?: boolean;
      showMinus?: boolean;
      immutable?: boolean;
    },
    indent: number
  ): HTMLRowKey {
    const direction = this.isExpanded(id) ? 'down' : 'right';
    const expandButton = createElement('button', [
      CSS.expandCollapseButton,
      CSS.keyContainerButton,
      'codicon',
      `codicon-chevron-${direction}`,
    ]);
    if (!options.expandable) {
      expandButton.classList.add(CSS.opaque);
    }

    const label = createInputAsLabel(title);
    if (options.immutable) {
      label.disabled = true;
    }

    const minusButton = createElement('button', [
      CSS.keyContainerButton,
      'codicon',
      'codicon-remove',
      this.viewState.isReadonly || !options.showMinus
        ? CSS.hidden
        : CSS.hiddenConditionally,
    ]);

    const plusButton = createElement('button', [
      CSS.keyContainerButton,
      'codicon',
      'codicon-add',
      this.viewState.isReadonly ? CSS.hidden : CSS.hiddenConditionally,
    ]);

    const indentLabel = createElement('label');
    if (indent) {
      indentLabel.innerHTML = '&emsp;'.repeat(indent);
    }

    const rightSideButtons: HTMLButtonElement[] = [];
    if (options.showMinus) {
      rightSideButtons.push(minusButton);
    }
    rightSideButtons.push(plusButton);

    const left = createDiv([indentLabel, expandButton], CSS.keyContainerLeft);
    const center = createDiv([label], CSS.keyContainerCenter);
    const right = createDiv(rightSideButtons, CSS.keyContainerRight);

    return {
      container: createDiv([left, center, right], CSS.keyContainer),
      plusButton,
      minusButton: options.showMinus ? minusButton : undefined,
      expandButton,
      inputBox: label,
    };
  }

  setSpacing(spacing?: string): void {
    this.viewState.spacing = spacing;

    let padding = '';
    switch (spacing) {
      case 'spacious':
        padding = '6px 0 6px 0';
        break;
      case 'comfortable':
        padding = '3px 0 3px 0';
        break;
      case 'compact':
      default:
        break;
    }

    for (const tableCell of Array.from(document.getElementsByTagName('td'))) {
      tableCell.style.padding = padding;
    }
  }

  private watchColumnWidths(
    container: HTMLTableSectionElement,
    key: HTMLTableCellElement,
    type: HTMLTableCellElement,
    value: HTMLTableCellElement
  ) {
    const debouncedUpdate = new Debouncer(() => {
      // Can't calculate percentages without the denominator.
      if (!container.clientWidth) return;

      const first = percent(key.clientWidth, container.clientWidth);
      const second = percent(type.clientWidth, container.clientWidth);
      this.viewState.columnWidths = {first: `${first}%`, second: `${second}%`};
    }, seconds(1));

    const resizeObserver = new ResizeObserver(() => {
      debouncedUpdate.run();
    });

    for (const element of [key, type, value]) {
      resizeObserver.observe(element);
    }
  }

  private isExpanded(id: number): boolean {
    return this.viewState.expandedNodeIds.includes(id);
  }

  static flashErrorIndicator(element: HTMLElement): void {
    element.classList.add(CSS.errorFlash);
    setTimeout(() => element.classList.remove(CSS.errorFlash), seconds(1));
  }
}

/* -------------------------------------------------------------------------- */
/*                            HTML Helper Functions                           */
/* -------------------------------------------------------------------------- */

type HTMLElementTag = keyof HTMLElementTagNameMap;
type ResolvedHTMLElement<T extends HTMLElementTag> = HTMLElementTagNameMap[T];

function createElement<T extends HTMLElementTag>(
  tag: T,
  classList?: string | string[],
  options?: Partial<ResolvedHTMLElement<T>>,
  children?: HTMLElement[]
): ResolvedHTMLElement<T> {
  const element = document.createElement(tag);

  if (typeof classList === 'string') {
    element.classList.add(classList);
  } else if (Array.isArray(classList)) {
    element.classList.add(...classList);
  }

  if (options) {
    Object.assign(element, options);
  }

  if (children) {
    element.append(...children);
  }

  return element;
}

function createDiv(
  children: HTMLElement[],
  className?: string
): HTMLDivElement {
  const divElement = createElement('div', className);
  divElement.append(...children);
  return divElement;
}

function createInputAsLabel(
  title: string,
  className?: string
): HTMLInputElement {
  const classList: string[] = [CSS.inputAsLabel];
  if (className) {
    classList.push(className);
  }
  const inputElement = createElement('input', classList);
  inputElement.type = 'text';
  inputElement.value = title;
  inputElement.readOnly = true;
  return inputElement;
}

/* -------------------------------------------------------------------------- */
/*               Other Helper Constants, Functions, Classes, etc              */
/* -------------------------------------------------------------------------- */

const CHAR_CODES = {
  zero: '0'.charCodeAt(0),
  nine: '9'.charCodeAt(0),
  a: 'a'.charCodeAt(0),
  f: 'f'.charCodeAt(0),
  A: 'A'.charCodeAt(0),
  F: 'F'.charCodeAt(0),
};

function isHexString(str: string): boolean {
  for (let i = 0; i < str.length; i++) {
    const charCode = str.charCodeAt(i);
    const isNumber = charCode >= CHAR_CODES.zero && charCode <= CHAR_CODES.nine;
    const isLowerAlpha = charCode >= CHAR_CODES.a && charCode <= CHAR_CODES.f;
    const isUpperAlpha = charCode >= CHAR_CODES.A && charCode <= CHAR_CODES.F;
    if (!(isNumber || isLowerAlpha || isUpperAlpha)) {
      return false;
    }
  }
  return true;
}

function arrayRemove<T>(arr: T[], value: T): boolean {
  const index = arr.indexOf(value);
  if (index === -1) {
    return false;
  }
  return arr.splice(index, 1).length > 0;
}

function percent(a: number, b: number): number {
  return ((a / b) * 100) | 0;
}

function seconds(num: number): number {
  return num * 1000;
}

function deepCopy<T extends object>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function getLargestKey<T>(dict: ReadonlyMap<T, unknown>): T {
  return Array.from(dict.keys())
    .sort((a, b) => (a < b ? -1 : 1))
    .pop() as T;
}

/**
 * Triple equality operator for string, number and boolean primitives.
 * Recursive triple equality operator for the elements of arrays and objects.
 * Does not properly consider types other than string, number, boolean, arrays
 * and objects.
 */
function isDeepEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return false;
    }

    // NOTE: doesn't consider order of entries
    return a.every((value, index) => isDeepEqual(value, b[index]));
  }

  if (typeof a === 'object' && typeof b === 'object') {
    if (a === null || b === null) {
      return a === b;
    } else if (a.constructor.name !== b.constructor.name) {
      return false;
    }

    const aEntries = Object.entries(a);
    return (
      aEntries.length === Object.entries(b).length &&
      aEntries.every((value, index) => isDeepEqual(value, b[index]))
    );
  }

  return false;
}

class Debouncer {
  private timeout?: number;

  constructor(
    private readonly action: () => void | Promise<void>,
    private readonly delay: number
  ) {}

  run(): void {
    if (this.timeout) return;

    this.timeout = setTimeout(() => {
      this.timeout = undefined;
      this.action();
    }, this.delay) as unknown as number;
  }
}

/* -------------------------------------------------------------------------- */
/*                                    Main                                    */
/* -------------------------------------------------------------------------- */

new WebviewController();
