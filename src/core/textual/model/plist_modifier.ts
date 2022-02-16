import {EventEmitter} from 'vscode';

import {SelfDisposing} from '../../../common/utilities/self_disposing';
import {ArrayAndIndex, ObjectAndKey} from './plist_parser';
import {isPlainObject, PlainObject} from '../../../common/utilities/object';

import {
  plistTypeForValue,
  PlistEntry,
  PlistEntryType,
  defaultValueForPlistType,
} from './plist_view_model';

type ModelValue =
  | ({kind: 'array'} & ArrayAndIndex)
  | ({kind: 'object'} & ObjectAndKey);

// The default type of new plist entries.
const DEFAULT_PLIST_TYPE: PlistEntryType = 'String';

// function nextMapId(map: Map<number, unknown>): number {
//   const keys = [...map.keys()].sort();
//   return keys[keys.length - 1] + 1;
// }

/**
 * The brains behind the editor. This class manages converting between the model
 * representing the plist file and the view model that is displayed via the
 * editor.
 */
export class PlistModifier extends SelfDisposing {
  private readonly rootDidChange = new EventEmitter<PlainObject | unknown[]>();
  readonly onRootDidChange = this.rootDidChange.event;

  constructor(
    readonly viewModelById = new Map<number, PlistEntry>(),
    /**
     * A mapping of every element inside an object or array by their ID.
     * e.g.
     * Object: {a: '', b: [0,1], c: {z: ''}}
     * Map: {
     *   0: {key: 'a', object: {a: '', b: [0,1], c: {z: ''}}}
     *   1: {key: 'b', object: {a: '', b: [0,1], c: {z: ''}}}
     *   2: {index: 0, array: [0,1]}
     *   3: {index 1, array: [0,1]}
     *   4: {key: 'c', object: {a: '', b: [0,1], c: {z: ''}}}
     *   5: {key: 'z', object: {z: ''}}
     * }
     */
    readonly modelById = new Map<number, ArrayAndIndex | ObjectAndKey>()
  ) {
    super();
    this.disposables.push(this.rootDidChange);
  }

  updateViewModel(viewModel: PlistEntry) {
    const entries = [viewModel];
    while (entries.length) {
      const entry = entries.pop()!;
      this.viewModelById.set(entry.id, entry);
      if (entry.children) {
        entries.push(...entry.children);
      }
    }
  }

  updateModelNodeKey(id: number, key: string): boolean {
    const model = this.modelById.get(id);
    // Array elements don't have keys.
    if (!model || !('object' in model)) {
      return false;
    }

    // TODO: This recreates the original object key-by-key, replacing the
    // changed key when needed. There's probably a better way to do this...
    for (const [k, v] of Object.entries(model.object)) {
      delete model.object[k];
      const resolvedKey = k === model.key ? key : k;
      model.object[resolvedKey] = v;
    }

    model.key = key;

    return true;
  }

  updateModelNodeType(id: number, type: PlistEntryType): boolean {
    const model = this.getModelForId(id);
    const newValue = defaultValueForPlistType(type);

    let existingValue: unknown;
    switch (model?.kind) {
      case 'array':
        existingValue = model.array[model.index];
        model.array[model.index] = newValue;
        break;
      case 'object':
        existingValue = model.object[model.key];
        model.object[model.key] = newValue;
        break;
      default:
        return false;
    }

    if (isPlainObject(existingValue)) {
      const newArrayValue = newValue as unknown[];
      newArrayValue.push(...Object.values(existingValue));
    } else if (Array.isArray(existingValue)) {
      const newObjectValue = newValue as PlainObject;
      for (const [index, val] of existingValue.entries()) {
        const key = index === 0 ? 'New item' : `New item - ${index + 1}`;
        newObjectValue[key] = val;
      }
    }

    if (id === 0) {
      this.rootDidChange.fire(newValue as PlainObject | unknown[]);
    }

    return true;
  }

  updateModelNodeValue(id: number, value: string): boolean {
    const model = this.modelById.get(id);
    const viewModel = this.viewModelById.get(id);
    if (!model || !viewModel) {
      return false;
    }

    let newValue: unknown;
    switch (viewModel.type) {
      case 'String':
        newValue = value;
        break;
      case 'Boolean':
        newValue = value === '0' ? false : true;
        break;
      case 'Number':
        newValue = Number(value);
        break;
      case 'Date':
        newValue = new Date(value);
        break;
      case 'Data':
        newValue = Buffer.from(
          Buffer.from(value, 'hex').toString('base64'),
          'base64'
        );
        break;
      default:
        break;
    }

    if ('object' in model) {
      model.object[model.key] = newValue;
    } else {
      model.array[model.index] = newValue;
    }

    return true;
  }

  addNodeModel(id: number): boolean {
    const parentModel = this.getModelForId(id);
    if (!parentModel) {
      return false;
    }

    function nextDictKey(dict: PlainObject): string {
      const keys = new Set(Object.keys(dict));
      let newKey = 'New item';
      let index = 1;
      while (keys.has(newKey)) {
        newKey = `New item - ${++index}`;
      }
      return newKey;
    }

    const childValue =
      parentModel.kind === 'object'
        ? parentModel.object[parentModel.key]
        : parentModel.array[parentModel.index];
    const type = plistTypeForValue(childValue);

    if (type === 'Array' || type === 'Dictionary') {
      if (Array.isArray(childValue)) {
        const newValue = this.defaultValueForPlistArray(childValue);
        childValue.splice(0, 0, newValue);
      } else if (childValue && typeof childValue === 'object') {
        const dict = childValue as PlainObject;
        const newValue = this.defaultValueForPlistDict(dict);
        const dictCopy = {...dict};
        dict[nextDictKey(dict)] = newValue;
        for (const [k, v] of Object.entries(dictCopy)) {
          delete dict[k];
          dict[k] = v;
        }
      } else {
        return false;
      }
    } else {
      switch (parentModel.kind) {
        case 'array': {
          const newArrValue = defaultValueForPlistType(type);
          parentModel.array.splice(parentModel.index + 1, 0, newArrValue);
          break;
        }
        case 'object': {
          const dict = parentModel.object;
          const newDictValue = this.defaultValueForPlistDict(dict);
          for (const [k, v] of Object.entries(dict)) {
            delete dict[k];
            dict[k] = v;
            if (k === parentModel.key) {
              dict[nextDictKey(dict)] = newDictValue;
            }
          }
          break;
        }
        default:
          return false;
      }
    }

    return true;
  }

  deleteNodeModel(id: number): boolean {
    const model = this.getModelForId(id);
    switch (model?.kind) {
      case 'array':
        model.array.splice(model.index, 1);
        break;
      case 'object':
        delete model.object[model.key];
        break;
      default:
        return false;
    }

    return true;
  }

  private getModelForId(id: number): ModelValue | undefined {
    const value = this.modelById.get(id);
    if (!value) {
      return undefined;
    }
    return 'index' in value
      ? {kind: 'array', ...(value as ArrayAndIndex)}
      : {kind: 'object', ...(value as ObjectAndKey)};
  }

  private defaultValueForPlistArray(array: unknown[]): unknown {
    const type = array.length
      ? plistTypeForValue(array[0])
      : DEFAULT_PLIST_TYPE;
    return defaultValueForPlistType(type);
  }

  private defaultValueForPlistDict(dict: PlainObject): unknown {
    const values = Object.values(dict);
    const type = values.length
      ? plistTypeForValue(values[0])
      : DEFAULT_PLIST_TYPE;
    return defaultValueForPlistType(type);
  }
}
