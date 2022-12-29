import * as vscode from 'vscode';

import {PlainObject} from '../../common/utilities/object';
import {SelfDisposing} from '../../common/utilities/disposable';
import {PlistModifier} from './model/plist_modifier';
import {PlistParser} from './model/plist_parser';
import {PlistEntry} from './model/plist_view_model';
import {NodePlistReader} from './model/node_plist_reader';
import {NodePlistWriter} from './model/node_plist_writer';

export class PlistOperations extends SelfDisposing {
  private readonly reader = new NodePlistReader();
  private readonly writer = new NodePlistWriter();
  readonly modifier = new PlistModifier();

  private model?: PlainObject | unknown[];

  constructor(private readonly document: vscode.TextDocument) {
    super();

    this.modifier.onRootDidChange(
      newRoot => {
        this.model = newRoot;
      },
      this,
      this.disposables
    );

    this.disposables.push(this.modifier);
  }

  get viewModel(): Promise<PlistEntry> {
    const pendingModel = this.model
      ? Promise.resolve(this.model)
      : this.reader.plistDocumentToJson(this.document);

    return pendingModel.then(model => {
      this.model = model;
      const parser = new PlistParser(this.modifier);
      return parser.parseIntoViewModel(model);
    });
  }

  reloadModel(updatedContent: string): void {
    this.model = this.reader.plistContentToJson(updatedContent);
  }

  update(): Promise<void> {
    if (!this.model) {
      return Promise.reject();
    }
    return this.writer.jsonToPlistDocument(this.document, this.model);
  }
}
