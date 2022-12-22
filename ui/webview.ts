'use strict';

type WebviewLogSeverity = 'off' | 'trace' | 'info' | 'warn' | 'error';
class WebviewLogger {
  constructor(private severity: WebviewLogSeverity) {}
  log(severity: WebviewLogSeverity, message: string, ...args: unknown[]) {
    if (this.severity === 'off') return;
    const severityStr = severity.toUpperCase();
    switch (severity) {
      case 'trace':
        if (this.severity !== 'trace') return;
        console.trace(severityStr, message, ...args);
        return;
      case 'info':
        if (['warn', 'error'].includes(this.severity)) return;
        break;
      case 'warn':
        if (['error'].includes(this.severity)) return;
        break;
      case 'error':
        console.error(severityStr, message, ...args);
        return;
      default:
        break;
    }
    console.log(severityStr, message, ...args);
  }
  trace(message: string, ...args: unknown[]) {
    this.log('trace', message, args);
  }
  info(message: string, ...args: unknown[]) {
    this.log('info', message, args);
  }
  warn(message: string, ...args: unknown[]) {
    this.log('warn', message, args);
  }
  error(message: string, ...args: unknown[]) {
    this.log('error', message, args);
  }
}
const logger = new WebviewLogger('info');

interface VsCodeApi {
  postMessage(msg: {}): void;
  setState(state: {}): void;
  getState(): {};
}

declare function acquireVsCodeApi(): VsCodeApi;

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

interface ViewModelRendererDelegate {
  isExpanded(id: number): boolean;
  isReadonly(): boolean;
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
}

interface ViewAndViewModel {
  view: HTMLRow;
  viewModel: ViewModel;
}

interface WebviewState {
  isReadonly?: boolean;
  expandedNodeIds: number[];
  lastSelectedNodeId?: number;
  selectedNodeId?: number;
  activeInputElement?: HTMLInputElement | HTMLSelectElement;
}

interface State {
  webview: WebviewState;
  viewModel: ViewModel;
}

const ROOT_NODE_ID = 0;
const BODY_CONTENT = document.getElementById('bodyContent')!;
const GENERATED_BANNER = document.getElementById('generatedBanner');

class WebviewController {
  private readonly vsCodeApi: VsCodeApi;
  private readonly viewModel: ViewModelRenderer;
  private readonly webviewState: WebviewState = {
    expandedNodeIds: [],
    isReadonly: false,
  };

  private rootPlistNode: ViewModel = {
    id: -1,
    key: '<placeholder>',
    type: 'String',
    value: '<placeholder>',
  };

  private newlyInsertedNode: number | undefined;

  constructor() {
    this.vsCodeApi = acquireVsCodeApi();
    this.viewModel = new ViewModelRenderer({
      isExpanded: (id: number) =>
        this.webviewState.expandedNodeIds.includes(id),
      isReadonly: () => this.webviewState?.isReadonly === true,
    });
    this.configureGlobalEventListeners();
    this.renderWebviewFromSavedState();
    this.renderBannerForGeneratedFiles();
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
    const currentState = this.getState();
    if (currentState.viewModel) {
      this.collectViewModels(currentState.viewModel, viewModels);
    }
    return viewModels.map(viewModel => viewModel.id);
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

  private renderWebviewFromSavedState() {
    const unsafeRestoredState: Partial<State> = this.getState() ?? {};
    if (unsafeRestoredState.webview) {
      this.webviewState.activeInputElement =
        unsafeRestoredState.webview.activeInputElement;
      this.webviewState.lastSelectedNodeId =
        unsafeRestoredState.webview.lastSelectedNodeId;
      this.webviewState.selectedNodeId =
        unsafeRestoredState.webview.selectedNodeId;
      this.webviewState.isReadonly = unsafeRestoredState.webview.isReadonly;
      this.webviewState.expandedNodeIds.length = 0;
      this.webviewState.expandedNodeIds.push(
        ...unsafeRestoredState.webview.expandedNodeIds
      );
    }
    if (unsafeRestoredState.viewModel) {
      this.renderWebviewBody(unsafeRestoredState.viewModel);
    }
  }

  private onMessageReceived(e: MessageEvent): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const message: any = e.data;
    switch (message.command) {
      case 'renderViewModel':
        this.webviewState.expandedNodeIds.length = 0;
        this.webviewState.expandedNodeIds.push(...message.expandedNodes);
        this.webviewState.isReadonly = message.isReadonly;
        this.renderBannerForGeneratedFiles();
        logger.info('onMessageReceived.renderViewModel', message.viewModel);
        this.renderWebviewBody(message.viewModel);
        this.saveState({
          viewModel: message.viewModel,
          webview: this.webviewState,
        });
        break;
      case 'expandAll':
        this.webviewState.expandedNodeIds.length = 0;
        this.webviewState.expandedNodeIds.push(...this.allViewModelIds());
        this.collapseNodesChanged();
        this.renderWebviewFromSavedState();
        logger.info('onMessageReceived.expandAll');
        break;
      case 'collapseAll':
        this.webviewState.expandedNodeIds.length = 0;
        // Doesn't make sense to collapse the "Root" node.
        this.webviewState.expandedNodeIds.push(0);
        this.collapseNodesChanged();
        this.renderWebviewFromSavedState();
        logger.info('onMessageReceived.collapseAll');
        break;
    }
  }

  private addPlistNode(id: number): void {
    this.vsCodeApi.postMessage({
      command: 'viewModelAdd',
      id,
    });
  }

  private deletePlistNode(id: number): void {
    this.vsCodeApi.postMessage({command: 'viewModelDelete', id});
  }

  private updatePlistNode(
    kind: 'key' | 'type' | 'value',
    id: number,
    newValue: string
  ): void {
    this.vsCodeApi.postMessage({
      command: 'updateViewModelNode',
      kind,
      id,
      newValue,
    });
  }

  private collapseNodesChanged(): void {
    this.vsCodeApi.postMessage({
      command: 'expandedNodesChange',
      ids: this.webviewState.expandedNodeIds,
    });
    this.saveState({webview: this.webviewState});
  }

  private getState(): Partial<State> {
    try {
      return JSON.parse(JSON.stringify(this.vsCodeApi.getState() ?? {}));
    } catch (err) {
      logger.error('this.vsCodeApi.getState', this.vsCodeApi.getState());
      return {};
    }
  }

  private saveState(state: Partial<State>) {
    const currentState = this.getState();
    const newState = {
      viewModel: state.viewModel ?? currentState.viewModel,
      webview: state.webview ?? currentState.webview,
    };
    this.vsCodeApi.setState(newState);
  }

  private renderWebviewBody(rootPlistNode: ViewModel): void {
    this.rootPlistNode = rootPlistNode;

    const table = createElement('table', 'plist-table', undefined, [
      this.viewModel.renderPlistRowHeader(),
      this.viewModel.renderViewModel(rootPlistNode),
    ]);
    BODY_CONTENT.replaceChildren(table);

    const viewModels = Array.from(this.viewModel.viewAndViewModelById.values());
    this.configurePlistNodeEventListeners(viewModels);

    const newNodeId = this.newlyInsertedNode;
    this.newlyInsertedNode = undefined;
    if (!newNodeId) return;

    const viewAndModel = this.viewModel.viewAndViewModelById.get(newNodeId);
    if (!viewAndModel) return;

    logger.info('renderWebviewBody.newlyInsertedNode', newNodeId, viewAndModel);
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
      this.webviewState.lastSelectedNodeId = this.webviewState.selectedNodeId;
      this.webviewState.selectedNodeId = undefined;
    }

    const noHideElements = Array.from(
      document.getElementsByClassName(CSS.noHide)
    );
    for (const button of noHideElements) {
      button.classList.remove(CSS.noHide);
    }
  }

  private configurePlistNodeEventListeners(
    viewModels: ViewAndViewModel[]
  ): void {
    for (const viewAndModel of viewModels) {
      const {view, viewModel} = viewAndModel;

      view.container.addEventListener('click', () => {
        this.clearSelectedNode();
        setTimeout(() => {
          if (!this.webviewState.isReadonly) {
            view.key.plusButton.classList.add(CSS.noHide);
            view.key.minusButton?.classList.add(CSS.noHide);
            view.type.dropdown.parentElement?.classList.add(CSS.noHide);
            if ('dropdown' in view.value) {
              view.value.dropdown.parentElement?.classList.add(CSS.noHide);
            }
          }
          view.container.classList.add(CSS.plistRowHighlight);
          this.webviewState.selectedNodeId = viewModel.id;
        });
      });

      view.key.expandButton.addEventListener('click', () => {
        view.isExpanded
          ? arrayRemove(this.webviewState.expandedNodeIds, viewModel.id)
          : this.webviewState.expandedNodeIds.push(viewModel.id);
        this.collapseNodesChanged();
        view.isExpanded = !view.isExpanded;
        this.renderWebviewBody(this.rootPlistNode);

        setTimeout(() => {
          this.viewModel.viewAndViewModelById
            .get(viewModel.id)
            ?.view.container.classList.add(CSS.plistRowHighlight);
          this.webviewState.selectedNodeId = viewModel.id;
        });
      });

      if (this.webviewState?.isReadonly) {
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
        this.newlyInsertedNode = viewModel.id + 1;
        logger.info('plusButton.click', this.newlyInsertedNode);
      });

      view.type.dropdown.addEventListener('click', () => {
        this.webviewState.activeInputElement = view.type.dropdown;
      });
      view.type.dropdown.addEventListener('blur', () => {
        this.webviewState.activeInputElement = undefined;
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
          this.webviewState.activeInputElement = inputBox;
        });
        inputBox.addEventListener('blur', () => {
          inputBox.classList.add(CSS.inputAsLabel);
          inputBox.classList.remove(CSS.focusedInputAsLabel);
          if ('readOnly' in inputBox) {
            inputBox.readOnly = true;
          }
          this.webviewState.activeInputElement = undefined;

          if (
            inputBox === view.key.inputBox &&
            viewModel.key !== inputBox.value
          ) {
            const parentId = viewModel.parent;
            if (parentId !== undefined) {
              const siblings = viewModels.find(
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
    const state = this.webviewState;
    let isOnEnterTimeout = false;

    document.addEventListener('keydown', event => {
      if (state.activeInputElement) {
        if (['Enter', 'Escape'].includes(event.code)) {
          state.activeInputElement.blur();
        }

        return;
      }

      if (state.selectedNodeId === undefined) {
        if (event.code === 'ArrowUp') {
          state.selectedNodeId = state.lastSelectedNodeId
            ? state.lastSelectedNodeId + 1
            : this.viewModel.viewAndViewModelById.size;
        } else if (event.code === 'ArrowDown') {
          state.selectedNodeId = state.lastSelectedNodeId
            ? state.lastSelectedNodeId - 1
            : -1;
        } else {
          return;
        }
      }

      const nodeId = state.selectedNodeId;
      const viewAndModelById = this.viewModel.viewAndViewModelById;

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
          const largestId = getLargestKey(this.viewModel.viewAndViewModelById);
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
            logger.warn('ignoring enter key');
            return;
          }
          isOnEnterTimeout = true;
          setTimeout(() => {
            isOnEnterTimeout = false;
          }, 1000);
          viewAndModelById.get(nodeId)?.view.key.plusButton.click();
          break;

        case 'Backspace':
          viewAndModelById.get(nodeId)?.view.key.minusButton?.click();
          break;

        case 'Escape':
          this.clearSelectedNode();
          break;

        default:
          logger.warn(event.code);
          this.vsCodeApi.postMessage({
            command: 'searchOnType',
            code: event.code,
          });
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

function getLargestKey<T>(dict: ReadonlyMap<T, unknown>): T {
  return Array.from(dict.keys())
    .sort((a, b) => (a < b ? -1 : 1))
    .pop() as T;
}

enum CSS {
  opaque = 'opaque',
  hidden = 'hidden',
  hiddenConditionally = 'hidden-conditionally',
  faded = 'faded',
  floatLeft = 'float-left',
  floatCenter = 'float-center',
  floatRight = 'float-right',

  inputAsLabel = 'input-as-label',
  focusedInputAsLabel = 'focused-input-as-label',
  selectAsLabel = 'select-as-label',

  plistRow = 'plist-row',
  plistRowHighlight = 'plist-row-highlight',
  plistRowButton = 'plist-row-button',

  expandCollapseButton = 'expand-collapse-button',
  errorFlash = 'error-flash',
  noHide = 'no-hide',
}

class ViewModelRenderer {
  private readonly viewAndViewModel = new Map<number, ViewAndViewModel>();

  get viewAndViewModelById(): ReadonlyMap<number, ViewAndViewModel> {
    return this.viewAndViewModel;
  }

  constructor(private readonly delegate: ViewModelRendererDelegate) {}

  renderViewModel(rootNode: ViewModel): HTMLTableSectionElement {
    this.viewAndViewModel.clear();
    const result = createElement(
      'tbody',
      undefined,
      undefined,
      this.renderViewModelNode(rootNode, 0)
    );
    logger.log('info', `Rendered ${result.childElementCount} view models.`);
    return result;
  }

  renderPlistRowHeader(): HTMLHeadElement {
    const columns = [
      createElement('th', [], {innerHTML: '<b>Key</b>'}),
      createElement('th', [], {innerHTML: '<b>Type</b>'}),
      createElement('th', [], {innerHTML: '<b>Value</b>'}),
    ];
    columns[0].style.width = '30%';
    columns[1].style.width = '10%';
    const tableRow = createElement('tr', undefined, undefined, columns);
    return createElement('thead', [CSS.plistRow], undefined, [tableRow]);
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

    const isExpanded = this.delegate.isExpanded(node.id);
    return {container: tableRow, key, type, value, isExpanded};
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
    const direction = this.delegate.isExpanded(id) ? 'down' : 'right';
    const expandButton = createElement('button', [
      CSS.expandCollapseButton,
      CSS.plistRowButton,
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
      CSS.plistRowButton,
      'codicon',
      'codicon-remove',
      this.delegate.isReadonly() || !options.showMinus
        ? CSS.hidden
        : CSS.hiddenConditionally,
    ]);

    const plusButton = createElement('button', [
      CSS.plistRowButton,
      'codicon',
      'codicon-add',
      this.delegate.isReadonly() ? CSS.hidden : CSS.hiddenConditionally,
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

    const right = createDiv(rightSideButtons, CSS.floatRight);
    const center = createDiv([label], CSS.floatCenter);
    const left = createDiv([indentLabel, expandButton], CSS.floatLeft);

    return {
      container: createDiv([left, center, right], 'key-container'),
      plusButton,
      minusButton: options.showMinus ? minusButton : undefined,
      expandButton,
      inputBox: label,
    };
  }

  static flashErrorIndicator(element: HTMLElement): void {
    element.classList.add(CSS.errorFlash);
    setTimeout(() => element.classList.remove(CSS.errorFlash), 1000);
  }
}

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
    if (!isNumber && !isLowerAlpha && !isUpperAlpha) {
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

function updateColorTheme() {
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

new MutationObserver(mutationList => {
  for (const mutation of mutationList) {
    if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
      updateColorTheme();
    }
  }
}).observe(document.body, {attributes: true});

updateColorTheme();
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const webviewUI = new WebviewController();
