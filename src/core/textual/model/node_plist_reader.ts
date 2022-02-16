import * as plist from 'plist';
import {TextDocument} from 'vscode';

import {isPlainObject, PlainObject} from '../../../common/utilities/object';

import {PlistReader} from './plist_reader';

class PlistStructureError extends Error {
  constructor(type: string) {
    super(`${type} is not a supported type for a plist root value.`);
  }
}

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
