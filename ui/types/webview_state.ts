import {ViewModel} from './view_model';

export interface ColumnWidths {
  first?: string;
  second?: string;
}

export interface ViewState {
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

export interface WebviewState {
  view: ViewState;
  viewModel: ViewModel;
}
