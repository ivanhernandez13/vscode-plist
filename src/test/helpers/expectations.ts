import {
  ArrayAndIndex,
  ObjectAndKey,
} from '../../core/textual/model/plist_parser';

function expectToBeObjectOrArray(
  element: ObjectAndKey | ArrayAndIndex | undefined
): element is ObjectAndKey | ArrayAndIndex {
  expect(element).toBeDefined();
  return element !== undefined;
}

export function expectToBeObject(
  element: ObjectAndKey | ArrayAndIndex | undefined
): element is ObjectAndKey {
  if (!expectToBeObjectOrArray(element)) {
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
  if (!expectToBeObjectOrArray(element)) {
    return false;
  }

  expect('index' in element)
    .withContext('"index" in element')
    .toBeTrue();
  return 'index' in element;
}
