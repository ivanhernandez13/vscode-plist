import {logger} from '../../../common/logging/extension_logger';
import {isPlainObject, PlainObject} from '../../../common/utilities/object';
import {PlistModifier} from './plist_modifier';
import {
  plistTypeForValue,
  PlistEntry,
  PlistEntryType,
} from './plist_view_model';

/** An array and its index. */
export interface ArrayAndIndex {
  array: unknown[];
  index: number;
}

/** An object and its key. */
export interface ObjectAndKey {
  object: PlainObject;
  key: string;
}

type ModelMap = Map<number, ArrayAndIndex | ObjectAndKey>;
type ViewModelMap = Map<number, PlistEntry>;

/** Parses a structured JSON representing a plist into a view model. */
export class PlistParser {
  private nextId = 0;

  private readonly modelMap: ModelMap;
  private readonly viewModelMap: ViewModelMap;

  /**
   * Populates the dict with the underlying model values. If the value is an
   * element of an array, the value stored will be the value's index in the
   * array. If the value is an item in a dictionary, the stored value will be
   * the values key. Values of all other types are stored directly.
   */
  constructor(modifierOrModelMap: PlistModifier) {
    this.modelMap = modifierOrModelMap.modelById;
    this.viewModelMap = modifierOrModelMap.viewModelById;
  }

  parseIntoViewModel(content: PlainObject | unknown[]): PlistEntry {
    const rootId = this.nextId++;
    const rootIsDict = isPlainObject(content);
    const children = rootIsDict
      ? this.parseDictionary(content)
      : this.parseArray(content);

    for (const child of children) {
      child.parent = rootId;
    }

    const rootEntry: PlistEntry = {
      id: rootId,
      key: 'Root',
      type: rootIsDict ? 'Dictionary' : 'Array',
      value: this.getItemsString(children.length),
      children,
    };

    this.modelMap.set(rootId, {
      object: {[rootEntry.key]: content},
      key: rootEntry.key,
    });
    this.viewModelMap.set(rootId, rootEntry);

    logger.logInfo(`Parsed ${this.nextId - 1} view models.`);
    return rootEntry;
  }

  private parseArray(array: unknown[]): PlistEntry[] {
    const entries: PlistEntry[] = [];

    for (const index in array) {
      const id = this.nextId++;
      const item = array[index];
      const key = `Item ${index}`;
      const type = plistTypeForValue(item);
      const value = this.getValue(item, type);

      this.modelMap.set(id, {array, index: Number(index)});

      let children: PlistEntry[] | undefined;

      switch (type) {
        case 'Array':
          children = this.parseArray(item as unknown[]);
          break;
        case 'Dictionary':
          children = this.parseDictionary(item as PlainObject);
          break;
        default:
          break;
      }

      const entry = {id, key, type, value, children};
      for (const child of children ?? []) {
        child.parent = id;
        this.viewModelMap?.set(child.id, child);
      }
      this.viewModelMap?.set(entry.id, entry);
      entries.push(entry);
    }

    return entries;
  }

  private parseDictionary(dict: PlainObject): PlistEntry[] {
    const entries: PlistEntry[] = [];

    for (const [key, item] of Object.entries(dict)) {
      const id = this.nextId++;
      const type = plistTypeForValue(item);
      const value = this.getValue(item, type);

      this.modelMap.set(id, {object: dict, key});

      let children: PlistEntry[] | undefined;

      switch (type) {
        case 'Array':
          children = this.parseArray(item as PlainObject[]);
          break;
        case 'Dictionary':
          children = this.parseDictionary(item as PlainObject);
          break;
        default:
          break;
      }
      const entry = {id, key, type, value, children};
      for (const child of children ?? []) {
        child.parent = id;
        this.viewModelMap?.set(child.id, child);
      }
      this.viewModelMap?.set(entry.id, entry);
      entries.push(entry);
    }

    return entries;
  }

  private getItemsString(length: number) {
    const word = length === 1 ? 'item' : 'items';
    return `(${length} ${word})`;
  }

  private getValue(value: unknown, type: PlistEntryType): string {
    switch (type) {
      case 'String':
      case 'Number':
        return String(value);
      case 'Boolean':
        return value === true ? 'YES' : 'NO';
      case 'Dictionary': {
        const dict = value as object;
        return this.getItemsString(Object.keys(dict).length);
      }
      case 'Array': {
        const array = value as unknown[];
        return this.getItemsString(array.length);
      }
      case 'Data': {
        const base64Data = Buffer.from(value as string, 'base64');
        return `<${base64Data.toString('hex').toUpperCase()}>`;
      }
      case 'Date':
        return (value as Date).toISOString();
      default:
        return `Unhandled '${type}'`;
    }
  }
}
