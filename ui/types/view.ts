export interface ViewRowKey {
  container: HTMLDivElement;
  expandButton: HTMLButtonElement;
  plusButton: HTMLButtonElement;
  minusButton?: HTMLButtonElement;
  inputBox: HTMLInputElement;
}

export interface ViewRowType {
  dropdown: HTMLSelectElement;
}

interface ViewRowValueInput {
  inputBox: HTMLInputElement;
}
interface ViewRowValueSelect {
  dropdown: HTMLSelectElement;
}
export type ViewRowValue = (ViewRowValueInput | ViewRowValueSelect) & {
  element: HTMLInputElement | HTMLSelectElement;
};

export interface ViewRow {
  container: HTMLTableRowElement;
  key: ViewRowKey;
  type: ViewRowType;
  value: ViewRowValue;
  isExpanded: boolean;
  indentation: number;
}
