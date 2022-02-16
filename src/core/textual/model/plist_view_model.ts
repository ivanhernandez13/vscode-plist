/** The type names as used by plist files. */
export type PlistEntryType =
  | 'String'
  | 'Number'
  | 'Boolean'
  | 'Date'
  | 'Data'
  | 'Array'
  | 'Dictionary';

/** Encapsulates an entry in a plist file. */
export interface PlistEntry {
  id: number;
  key: string;
  type: PlistEntryType;
  value: string;
  children?: PlistEntry[];
  parent?: number;
}

/**
 * Maps the javascript type of the given value to the corresponding plist type.
 */
export function plistTypeForValue(value: unknown): PlistEntryType {
  switch (typeof value) {
    case 'string':
      return 'String';
    case 'number':
      return 'Number';
    case 'boolean':
      return 'Boolean';
    case 'object':
      if (Array.isArray(value)) {
        return 'Array';
      } else if (Buffer.isBuffer(value)) {
        return 'Data';
      } else if (value instanceof Date) {
        return 'Date';
      } else {
        return 'Dictionary';
      }
    default:
      throw new Error('plistTypeForValue');
  }
}

/** Returns "reasonable" initial values for when a new plist entry is added. */
export function defaultValueForPlistType(type: PlistEntryType): unknown {
  switch (type) {
    case 'Array':
      return [];
    case 'Dictionary':
      return {};
    case 'Boolean':
      return true;
    case 'Date':
      return new Date();
    case 'Number':
      return 0;
    case 'String':
      return '';
    case 'Data':
      return Buffer.from('');
  }
}
