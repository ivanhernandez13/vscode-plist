import * as vscode from 'vscode';

import {sha256} from '../../common/utilities/hash';
import {ScopedMemento} from '../../common/utilities/scoped_memento';

export interface PersistentState {
  expandedNodes: ScopedMemento<number[]>;
  columnWidths: ScopedMemento<{first?: string; second?: string}>;
}

export interface PlistDocumentAttributes {
  readonly isGenerated: boolean;
  readonly isReadonly: boolean;
}

export class TextDocumentContent {
  private contentHash?: string;

  constructor(private readonly document: vscode.TextDocument) {}

  private calculateContentHash(): Promise<string> {
    return sha256(this.document.getText());
  }

  async contentHasChanged(): Promise<boolean> {
    const lastContentHash = this.contentHash;
    this.contentHash = await this.calculateContentHash();
    return lastContentHash !== this.contentHash;
  }
}
