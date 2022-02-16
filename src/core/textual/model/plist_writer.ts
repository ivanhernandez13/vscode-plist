import {TextDocument} from 'vscode';
import {PlainObject} from '../../../common/utilities/object';

export interface PlistWriter {
  jsonToPlistDocument(
    document: TextDocument,
    json: PlainObject | ReadonlyArray<unknown>
  ): Promise<void>;
}
