import * as vscode from 'vscode';

export interface ScopedMemento<T> {
  get(): T;
  update(val: T): Promise<void>;
  exists(): boolean;
}

export function scopedMemento<T>(
  memento: vscode.Memento,
  key: string,
  defaultValue: T
): ScopedMemento<T> {
  return {
    exists(): boolean {
      return memento.get(key) !== undefined;
    },
    get() {
      return memento.get(key, defaultValue);
    },
    update(val: T): Promise<void> {
      return Promise.resolve(memento.update(key, val));
    },
  };
}
