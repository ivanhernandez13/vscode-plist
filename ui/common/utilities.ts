const CHAR_CODES = {
  zero: '0'.charCodeAt(0),
  nine: '9'.charCodeAt(0),
  a: 'a'.charCodeAt(0),
  f: 'f'.charCodeAt(0),
  A: 'A'.charCodeAt(0),
  F: 'F'.charCodeAt(0),
};

export function isHexString(str: string): boolean {
  for (let i = 0; i < str.length; i++) {
    const charCode = str.charCodeAt(i);
    const isNumber = charCode >= CHAR_CODES.zero && charCode <= CHAR_CODES.nine;
    const isLowerAlpha = charCode >= CHAR_CODES.a && charCode <= CHAR_CODES.f;
    const isUpperAlpha = charCode >= CHAR_CODES.A && charCode <= CHAR_CODES.F;
    if (!(isNumber || isLowerAlpha || isUpperAlpha)) {
      return false;
    }
  }
  return true;
}

export function arrayRemove<T>(arr: T[], value: T): boolean {
  const index = arr.indexOf(value);
  if (index === -1) {
    return false;
  }
  return arr.splice(index, 1).length > 0;
}

export function percent(a: number, b: number): number {
  return ((a / b) * 100) | 0;
}

export function seconds(num: number): number {
  return num * 1000;
}

export function deepCopy<T extends object>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export function getLargestKey<T>(dict: ReadonlyMap<T, unknown>): T {
  return Array.from(dict.keys())
    .sort((a, b) => (a < b ? -1 : 1))
    .pop() as T;
}

/**
 * Triple equality operator for string, number and boolean primitives.
 * Recursive triple equality operator for the elements of arrays and objects.
 * Does not properly consider types other than string, number, boolean, arrays
 * and objects.
 */
export function isDeepEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return false;
    }

    // NOTE: doesn't consider order of entries
    return a.every((value, index) => isDeepEqual(value, b[index]));
  }

  if (typeof a === 'object' && typeof b === 'object') {
    if (a === null || b === null) {
      return a === b;
    } else if (a.constructor.name !== b.constructor.name) {
      return false;
    }

    const aEntries = Object.entries(a);
    const bEntries = Object.entries(b);
    return (
      aEntries.length === bEntries.length &&
      aEntries.every((value, index) => isDeepEqual(value, bEntries[index]))
    );
  }

  return false;
}
