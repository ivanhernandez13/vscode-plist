import {
  arrayRemove,
  deepCopy,
  getLargestKey,
  isHexString,
  seconds,
} from '../common/utilities';
import {createElement} from '../common/html_generators';
import {CSS} from '../types/css';
import {logger} from '../common/logger';
import {createErrorDiv, ViewModelRenderer} from './renderer';
import {StateManager} from './state';
import {ViewModel} from '../types/view_model';
import {vsCodeApi} from '../common/vscode_api';
import {ViewAndViewModel} from '../types/view_and_view_model';

const ROOT_NODE_ID = 0;
const BODY_CONTENT = document.getElementById('bodyContent')!;

export class WebviewController {
  private readonly state = new StateManager();
  private readonly renderer = new ViewModelRenderer(this.state.view);

  constructor() {
    this.configureGlobalEventListeners();
    this.restoreWebviewFromSavedState();
    this.watchAttributeMutations();
    this.updateColorTheme();
    this.state.view.activeInputElement = undefined;
  }

  private renderErrorBody(errorMessage: string) {
    BODY_CONTENT.style.height = '100%';
    BODY_CONTENT.replaceChildren(createErrorDiv(errorMessage));
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
        "url('resources/icons/chevron-expand-light.svg')"
      );
    } else if (document.body.classList.contains('vscode-dark')) {
      document.documentElement.style.setProperty(
        '--chevron-expand-icon',
        "url('resources/icons/chevron-expand-dark.svg')"
      );
    } else if (document.body.classList.contains('vscode-high-contrast')) {
      document.documentElement.style.setProperty(
        '--chevron-expand-icon',
        "url('resources/icons/chevron-expand-high-contrast.svg')"
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
