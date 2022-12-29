import {
  ArrayAndIndex,
  ObjectAndKey,
} from '../../core/textual/model/plist_parser';

export function expectToBe<T>(a: T, b: T): boolean {
  expect(a).toBe(b);
  return a === b;
}

export function expectToBeDefined<T>(element: T | undefined): element is T {
  expect(element).toBeDefined();
  return element !== undefined;
}

export function expectToBeObject(
  element: ObjectAndKey | ArrayAndIndex | undefined
): element is ObjectAndKey {
  if (!expectToBeDefined(element)) {
    return false;
  }

  expect('object' in element)
    .withContext('"object" in element')
    .toBeTrue();
  return 'object' in element;
}

export function expectToBeArray(
  element: ObjectAndKey | ArrayAndIndex | undefined
): element is ArrayAndIndex {
  if (!expectToBeDefined(element)) {
    return false;
  }

  expect('index' in element)
    .withContext('"index" in element')
    .toBeTrue();
  return 'index' in element;
}
