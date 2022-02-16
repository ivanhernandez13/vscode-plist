import {TextDocument} from 'vscode';
import {PlainObject} from '../../../common/utilities/object';

export interface PlistReader {
  plistDocumentToJson(document: TextDocument): Promise<PlainObject | unknown[]>;
}
