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
