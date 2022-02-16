import {PlistObject} from 'plist';
import {isPlainObject} from '../../common/utilities/object';

const TYPES_TO_COUNT = [
  'string',
  'number',
  'boolean',
  'date',
  'buffer',
  'object',
  'array',
  'other',
] as const;
type TypeCounter = Record<typeof TYPES_TO_COUNT[number], number>;

function newTypeCounter(): TypeCounter {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return TYPES_TO_COUNT.reduce((obj: any, type) => {
    obj[type] = 0;
    return obj;
  }, {});
}

export function countInstancesOfTypes(
  input: PlistObject,
  counter = newTypeCounter()
): TypeCounter {
  for (const value of Object.values(input)) {
    switch (typeof value) {
      case 'number':
        counter.number++;
        break;
      case 'boolean':
        counter.boolean++;
        break;
      case 'string':
        counter.string++;
        break;
      case 'object':
        if (Array.isArray(value)) {
          counter.array++;
          const arrayAsObject = {...value} as unknown as PlistObject;
          countInstancesOfTypes(arrayAsObject, counter);
        } else if (isPlainObject(value)) {
          counter.object++;
          countInstancesOfTypes(value, counter);
        } else if (Buffer.isBuffer(value)) {
          counter.buffer++;
        } else if (value instanceof Date) {
          counter.date++;
        } else {
          counter.other++;
        }
        break;
      default:
        counter.other++;
        break;
    }
  }
  return counter;
}
