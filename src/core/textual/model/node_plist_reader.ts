import * as plist from 'plist';
import {TextDocument} from 'vscode';

import {isPlainObject, PlainObject} from '../../../common/utilities/object';
import {PlistStructureError} from '../../binary/decoder/error';

import {PlistReader} from './plist_reader';

/** Reads a plist file into structured JSON using the node plist library. */
export class NodePlistReader implements PlistReader {
  async plistDocumentToJson(
    document: TextDocument
  ): Promise<PlainObject | unknown[]> {
    const content = document.getText();
    if (!content) {
      return {};
    }

    return this.plistContentToJson(content);
  }

  plistContentToJson(content: string): PlainObject | unknown[] {
    const result = plist.parse(content);

    if (typeof result !== 'object') {
      throw new PlistStructureError(typeof result);
    } else if (Buffer.isBuffer(result)) {
      throw new PlistStructureError('Buffer');
    } else if (result instanceof Date) {
      throw new PlistStructureError('Date');
    }

    return isPlainObject(result) ? result : [...result];
  }
}
