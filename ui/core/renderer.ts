import {Debouncer} from '../common/debouncer';
import {CSS} from '../types/css';
import {logger} from '../common/logger';
import {
  createElement,
  createDiv,
  createInputAsLabel,
} from '../common/html_generators';
import {ViewRow, ViewRowKey, ViewRowType, ViewRowValue} from '../types/view';
import {
  PlistEntryType,
  PLIST_ENTRY_TYPES,
  PLIST_ENTRY_TYPES_WITH_CHILDREN,
  ViewModel,
} from '../types/view_model';
import {ViewState} from '../types/webview_state';
import {percent, seconds} from '../common/utilities';
import {vsCodeApi} from '../common/vscode_api';
import {ViewAndViewModel} from '../types/view_and_view_model';

const ROOT_NODE_ID = 0;

const IMMUTABLE_PLIST_ENTRY_TYPES: Array<PlistEntryType> = [
  'Array',
  'Dictionary',
];

export class ViewModelRenderer {
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
  ): ViewRow {
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
  ): ViewRowType {
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
  ): ViewRowValue {
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
  ): ViewRowKey {
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

export function renderBannerForGeneratedFiles(): void {
  const bannerDiv = document.getElementById('generatedBanner');
  if (!bannerDiv) return;

  bannerDiv.childNodes.forEach(child => child.remove());
  const banner = createElement('input', 'banner', {
    type: 'text',
    readOnly: true,
    value: bannerDiv.title,
  });
  bannerDiv.append(banner, createElement('input', 'banner-offset'));
  banner.addEventListener('click', () => {
    bannerDiv.remove();
  });
}

export function createErrorDiv(errorMessage: string): HTMLDivElement {
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

  return createDiv(elements, 'error-div');
}
