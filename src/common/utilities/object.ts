export type PlainObject = {[key: string]: unknown};

/** Whether an object is a plain object e.g. not a class, function, etc.  */
export function isPlainObject(obj: unknown): obj is PlainObject {
  if (typeof obj === 'object' && obj !== null) {
    if (typeof Object.getPrototypeOf === 'function') {
      const proto = Object.getPrototypeOf(obj);
      return proto === Object.prototype || proto === null;
    }

    return Object.prototype.toString.call(obj) === '[object Object]';
  }

  return false;
}

function omit<T extends PlainObject>(object: T, ...keys: Array<keyof T>) {
  const shallowCopy = {...object};
  for (const key of keys) {
    delete shallowCopy[key];
  }
  return shallowCopy;
}

function length(obj: object): number {
  return Object.keys(obj).length;
}

function deepLength(obj: PlainObject): number {
  let counter = 0;
  for (const value of Object.values(obj)) {
    if (Array.isArray(value)) {
      const arrayAsObject = {...value} as unknown as PlainObject;
      counter += deepLength(arrayAsObject);
    } else if (isPlainObject(value)) {
      counter += deepLength(value);
    }
    counter++;
  }
  return counter;
}

export const ObjectUtils = {omit, length, deepLength};
