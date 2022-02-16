import {PlistObject} from 'plist';
import {countInstancesOfTypes} from '../../../test/helpers/type_counter';
import {TEST_ONLY} from './binary_plist_decoder';
import * as inputs from './binary_plist_decoder.testdata';
import {InvalidMagicError, UnsupportedVersionError} from './error';

const {assertBinaryPlist, decodeBinaryPlistImpl} = TEST_ONLY;

describe('Binary Plist Decoder', () => {
  it('parses binary plist headers', () => {
    expect(() => assertBinaryPlist(inputs.BPLIST00_BASE64)).not.toThrow();
    expect(() => assertBinaryPlist(inputs.BPLIST01_BASE64)).toThrowError(
      UnsupportedVersionError
    );
    expect(() => assertBinaryPlist(inputs.PLIST_ASCII)).toThrowError(
      InvalidMagicError
    );
  });

  it('decodes a binary plist', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const actual: any = decodeBinaryPlistImpl(inputs.EXHAUSTIVE_PLIST);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const expected: any = {
      Int: 1337,
      Double: 1337.1337,
      LongAsciiString: 'Ascii String Over Fifteen Bits',
      LongUnicodeString: 'υոісоԁе String Over Fifteen Bits 😀',
      AsciiString: 'Ascii',
      UnicodeString: 'υոісоԁе 😀',
      False: false,
      True: true,
      Date: new Date('Jan 9 2007 09:42:00 PST'),
      Data: Buffer.from('Hello World!'),
      Array: ['ArrayItem1', 'ArrayItem2'],
      Dict: {
        DictKey1: 'DictValue1',
        DictKey2: 'DictValue2',
      },
      TopArray: [
        {
          MiddleArray: [
            {
              BottomArray: [''],
            },
          ],
        },
      ],
    };

    const keys = new Set(Object.keys(actual));
    for (const key of Object.keys(expected)) {
      expect(actual[key]).withContext(`key: ${key}`).toEqual(expected[key]);
      keys.delete(key);
    }
    expect(keys.size)
      .withContext(`${keys.size} unexpected keys: [${Array.from(keys)}]`)
      .toBe(0);
  });

  it('decodes a large binary plist', () => {
    const obj = decodeBinaryPlistImpl(inputs.LARGE_PLIST) as PlistObject;
    const actual = countInstancesOfTypes(obj);
    expect(actual).toEqual({
      array: 9,
      boolean: 21,
      buffer: 0,
      date: 0,
      number: 83,
      object: 12,
      other: 0,
      string: 499,
    });
  });

  it('decodes a behemoth binary plist', () => {
    const obj = decodeBinaryPlistImpl(inputs.BEHEMOTH_PLIST) as PlistObject;
    const actual = countInstancesOfTypes(obj);
    expect(actual).toEqual({
      array: 0,
      boolean: 0,
      buffer: 0,
      date: 0,
      number: 68748,
      object: 70587,
      other: 0,
      string: 0,
    });
  });
});
