import * as vscode from 'vscode';

export class FakeScopedMemento<T> {
  private value?: T;

  constructor(private readonly defaultValue: T) {}
  get(): T {
    return this.value ?? this.defaultValue;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  update(value: T): Promise<void> {
    this.value = value;
    return Promise.resolve();
  }
  exists(): boolean {
    return this.value !== undefined;
  }
}

export class FakeMemento implements vscode.Memento {
  readonly data = new Map<string, unknown>();

  keys(): readonly string[] {
    return Array.from(this.data.keys());
  }

  get<T>(key: string, defaultValue?: T): T | undefined {
    // get<T>(key: string): T | undefined {
    const item = this.data.get(key) as T | undefined;
    return defaultValue !== undefined ? item ?? defaultValue : item;
  }

  async update(key: string, value: unknown): Promise<void> {
    this.data.set(key, value);
  }

  get oneAndOnlyKey(): string | undefined {
    const keys = this.keys();
    return keys.length === 1 ? keys[0] : undefined;
  }
}
