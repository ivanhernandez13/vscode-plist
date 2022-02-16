import {sizeOf} from '../../../common/utilities/map';
import {PlainObject} from '../../../common/utilities/object';
import {
  expectToBeArray,
  expectToBeObject,
} from '../../../test/helpers/expectations';
import {PlistModifier} from './plist_modifier';
import {PlistParser} from './plist_parser';

import {PlistEntry} from './plist_view_model';

const CHILD: PlistEntry = {
  id: 2,
  key: 'childKey',
  value: 'childValue',
  type: 'String',
};
const ROOT: PlistEntry = {
  id: 1,
  key: 'rootKey',
  value: 'rootValue',
  type: 'Array',
  children: [CHILD],
};

describe('Plist Modifier', () => {
  let modifier: PlistModifier;

  beforeEach(() => {
    modifier = new PlistModifier();
  });

  afterEach(() => {
    modifier.dispose();
  });

  function populateModelById(obj: PlainObject) {
    new PlistParser(modifier).parseIntoViewModel(obj);
  }

  describe('updates', () => {
    it('view model mapping', () => {
      expect(modifier.viewModelById).toEqual(new Map());

      modifier.updateViewModel(ROOT);
      expect(modifier.viewModelById).toEqual(
        new Map([
          [1, ROOT],
          [2, CHILD],
        ])
      );

      const updatedChild = {...CHILD, value: 'updatedChildValue'};
      modifier.updateViewModel(updatedChild);
      expect(modifier.viewModelById).toEqual(
        new Map([
          [1, ROOT],
          [2, updatedChild],
        ])
      );
    });

    it('key', () => {
      const origObject = {
        keyToUpdate: 'keyToUpdateValue',
        unchangedKey: 'unchangedKeyValue',
      };
      populateModelById(origObject);

      const element = modifier.modelById.get(1);
      if (!element || !('object' in element)) {
        fail('Expected model with id 1 to be defined and an object.');
        return;
      }

      expect(element.key).toBe('keyToUpdate');
      expect(element.object).toEqual(origObject);

      modifier.updateModelNodeKey(1, 'newKey');
      expect(element.key).toBe('newKey');
      expect(element.object).toEqual({
        newKey: 'keyToUpdateValue',
        unchangedKey: 'unchangedKeyValue',
      });
    });

    it('updates type', () => {
      const inputObject: {[key: string]: unknown} = {
        keyOne: 'valueOne',
        keyTwo: 'valueTwo',
        keyThree: 'valueThree',
        keyFour: 'valueFour',
        keyFive: 'valueFive',
        keySix: 'valueSix',
        keySeven: 'valueSeven',
      };
      populateModelById(inputObject);

      expect(typeof inputObject.keyOne).toBe('string');
      modifier.updateModelNodeType(1, 'String');
      expect(typeof inputObject.keyOne).toBe('string');

      expect(typeof inputObject.keyTwo).toBe('string');
      modifier.updateModelNodeType(2, 'Boolean');
      expect(typeof inputObject.keyTwo).toBe('boolean');

      expect(typeof inputObject.keyThree).toBe('string');
      modifier.updateModelNodeType(3, 'Data');
      expect(inputObject.keyThree instanceof Buffer).toBeTrue();

      expect(typeof inputObject.keyFour).toBe('string');
      modifier.updateModelNodeType(4, 'Date');
      expect(inputObject.keyFour instanceof Date).toBeTrue();

      expect(typeof inputObject.keyFive).toBe('string');
      modifier.updateModelNodeType(5, 'Number');
      expect(typeof inputObject.keyFive).toBe('number');

      expect(typeof inputObject.keySix).toBe('string');
      modifier.updateModelNodeType(6, 'Dictionary');
      expect(inputObject.keySix instanceof Object).toBeTrue();

      expect(typeof inputObject.keySeven).toBe('string');
      modifier.updateModelNodeType(7, 'Array');
      expect(Array.isArray(inputObject.keySeven)).toBeTrue();
    });

    it('updates value', () => {
      const inputObject: {[key: string]: unknown} = {
        keyString: 'valueOne',
        keyBoolean: true,
        keyData: Buffer.from(''),
        keyDate: new Date(),
        keyNumber: 0,
      };
      populateModelById(inputObject);

      modifier.updateModelNodeValue(1, 'newStringValue');
      expect(inputObject.keyString).toEqual('newStringValue');

      modifier.updateModelNodeValue(2, '0');
      expect(inputObject.keyBoolean).toEqual(false);

      modifier.updateModelNodeValue(3, '48656c6c6f20576f726c6421');
      expect(inputObject.keyData).toEqual(Buffer.from('Hello World!'));

      modifier.updateModelNodeValue(4, '1970-01-01T00:00:00.000Z');
      expect(inputObject.keyDate).toEqual(new Date('1970-01-01T00:00:00.000Z'));

      modifier.updateModelNodeValue(5, '1337');
      expect(inputObject.keyNumber).toEqual(1337);
    });
  });

  describe('mutations', () => {
    const INPUT_OBJECT_ELEMENTS_ORDER = [
      'ROOT',
      'keyBoolean',
      'keyStringArray',
      'keyStringArray_valueOne',
      'keyNumberArray',
      'keyNumberArray_valueOne',
      'keyStringDictionary',
      'keyStringDictionary_keyOne',
      'keyNumberDictionary',
      'keyNumberDictionary_keyOne',
    ] as const;

    /* 0 */ const INPUT_OBJECT = {
      /* 1 */ keyBoolean: 0,
      /* 2 */ keyStringArray: [/* 3 */ 'keyStringArray_valueOne'],
      /* 4 */ keyNumberArray: [/* 5 */ 1337],
      /* 6 */ keyStringDictionary: {
        /* 7 */ keyStringDictionary_keyOne: 'keyStringDictionary_valueOne',
      },
      /* 8 */ keyNumberDictionary: {/* 9 */ keyNumberDictionary_keyOne: 1337},
    } as const;

    const INPUT_OBJECT_IDS = INPUT_OBJECT_ELEMENTS_ORDER.reduce(
      (result: PlainObject, item, index) => {
        result[item] = index;
        return result;
      },
      {}
    ) as Readonly<{
      [key in typeof INPUT_OBJECT_ELEMENTS_ORDER[number]]: number;
    }>;

    const INPUT_OBJECT_LENGTH = INPUT_OBJECT_ELEMENTS_ORDER.length;

    beforeEach(() => {
      const inputObject: PlainObject = JSON.parse(JSON.stringify(INPUT_OBJECT));
      populateModelById(inputObject);
    });

    // TODO: This should not be needed, the model should update itself whenever
    // a node is added or removed.
    function reloadModelById(): boolean {
      const elementZero = modifier.modelById.get(INPUT_OBJECT_IDS.ROOT);
      if (expectToBeObject(elementZero)) {
        modifier.modelById.clear();
        populateModelById(elementZero.object[elementZero.key] as PlainObject);
        return true;
      }
      return false;
    }

    describe('inserts', () => {
      it('boolean', () => {
        const index = INPUT_OBJECT_IDS.keyBoolean;
        modifier.addNodeModel(index);
        if (!reloadModelById()) return;

        const newElement = modifier.modelById.get(index + 1);
        if (expectToBeObject(newElement)) {
          expect(newElement.key).toBe('New item');
          expect(newElement.object[newElement.key]).toBe(0);
        }
        expect(sizeOf(modifier.modelById)).toBe(INPUT_OBJECT_LENGTH + 1);
      });

      it('string array', () => {
        const index = INPUT_OBJECT_IDS.keyStringArray;
        modifier.addNodeModel(index);
        if (!reloadModelById()) return;

        const newElement = modifier.modelById.get(
          INPUT_OBJECT_IDS.keyStringArray + 1
        );
        if (expectToBeArray(newElement)) {
          expect(newElement.index).toBe(0);
          expect(newElement.array[newElement.index]).toBe('');
        }
        expect(sizeOf(modifier.modelById)).toBe(INPUT_OBJECT_LENGTH + 1);
      });

      it('number array', () => {
        const index = INPUT_OBJECT_IDS.keyNumberArray;
        modifier.addNodeModel(index);
        if (!reloadModelById()) return;

        const newElement = modifier.modelById.get(index + 1);
        if (expectToBeArray(newElement)) {
          expect(newElement.index).toBe(0);
          expect(newElement.array[newElement.index]).toBe(0);
        }
        expect(sizeOf(modifier.modelById)).toBe(INPUT_OBJECT_LENGTH + 1);
      });

      it('string dict', () => {
        const index = INPUT_OBJECT_IDS.keyStringDictionary;
        modifier.addNodeModel(index);
        if (!reloadModelById()) return;

        const newElement = modifier.modelById.get(index + 1);
        if (expectToBeObject(newElement)) {
          expect(newElement.key).toBe('New item');
          expect(newElement.object[newElement.key]).toBe('');
        }
        expect(sizeOf(modifier.modelById)).toBe(INPUT_OBJECT_LENGTH + 1);
      });

      it('number dict', () => {
        const index = INPUT_OBJECT_IDS.keyNumberDictionary;
        modifier.addNodeModel(index);
        if (!reloadModelById()) return;

        const newElement = modifier.modelById.get(index + 1);
        if (expectToBeObject(newElement)) {
          expect(newElement.key).toBe('New item');
          expect(newElement.object[newElement.key]).toBe(0);
        }
        expect(sizeOf(modifier.modelById)).toBe(INPUT_OBJECT_LENGTH + 1);
      });

      it('invalid index', () => {
        expect(modifier.addNodeModel(Object.keys(INPUT_OBJECT_IDS).length + 1))
          .withContext('Inserting node at invalid index')
          .toBeFalse();
        expect(sizeOf(modifier.modelById)).toBe(INPUT_OBJECT_LENGTH);
      });
    });

    describe('deletes', () => {
      it('boolean', () => {
        const index = INPUT_OBJECT_IDS.keyBoolean;
        modifier.deleteNodeModel(index);
        if (!reloadModelById()) return;

        expect(sizeOf(modifier.modelById)).toBe(INPUT_OBJECT_LENGTH - 1);
      });

      it('string array', () => {
        const index = INPUT_OBJECT_IDS.keyStringArray;
        modifier.deleteNodeModel(index);
        if (!reloadModelById()) return;

        expect(sizeOf(modifier.modelById)).toBe(INPUT_OBJECT_LENGTH - 2);
      });

      it('number array', () => {
        const index = INPUT_OBJECT_IDS.keyNumberArray;
        modifier.deleteNodeModel(index);
        if (!reloadModelById()) return;

        expect(sizeOf(modifier.modelById)).toBe(INPUT_OBJECT_LENGTH - 2);
      });

      it('array element', () => {
        const index = INPUT_OBJECT_IDS.keyNumberArray_valueOne;
        modifier.deleteNodeModel(index);
        if (!reloadModelById()) return;

        expect(sizeOf(modifier.modelById)).toBe(INPUT_OBJECT_LENGTH - 1);
      });

      it('string dict', () => {
        const index = INPUT_OBJECT_IDS.keyStringDictionary;
        modifier.deleteNodeModel(index);
        if (!reloadModelById()) return;

        expect(sizeOf(modifier.modelById)).toBe(INPUT_OBJECT_LENGTH - 2);
      });

      it('number dict', () => {
        const index = INPUT_OBJECT_IDS.keyNumberDictionary;
        modifier.deleteNodeModel(index);
        if (!reloadModelById()) return;

        expect(sizeOf(modifier.modelById)).toBe(INPUT_OBJECT_LENGTH - 2);
      });

      it('dict element', () => {
        const index = INPUT_OBJECT_IDS.keyNumberDictionary_keyOne;
        modifier.deleteNodeModel(index);
        if (!reloadModelById()) return;

        expect(sizeOf(modifier.modelById)).toBe(INPUT_OBJECT_LENGTH - 1);
      });

      it('invalid index', () => {
        expect(modifier.deleteNodeModel(INPUT_OBJECT_LENGTH + 1))
          .withContext('Deleting node at invalid index')
          .toBeFalse();
        expect(sizeOf(modifier.modelById)).toBe(INPUT_OBJECT_LENGTH);
      });
    });
  });
});
