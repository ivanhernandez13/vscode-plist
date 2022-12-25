import {PlainObject} from '../../../common/utilities/object';
import {PlistModifier} from './plist_modifier';
import {PlistEntry} from './plist_view_model';

import {PlistParser} from './plist_parser';

describe('Plist Parser', () => {
  function parseObjectAndReturnRootChildren(
    obj: PlainObject
  ): PlistEntry[] | undefined {
    const parser = new PlistParser(new PlistModifier());
    const viewModel = parser.parseIntoViewModel(obj);
    expect(viewModel.key).toEqual('Root');
    return viewModel.children;
  }

  it('string', () => {
    const actual = parseObjectAndReturnRootChildren({strKey: 'strValue'});
    const expected: PlistEntry[] = [
      {
        id: 1,
        key: 'strKey',
        type: 'String',
        value: 'strValue',
        children: undefined,
        parent: 0,
      },
    ];
    expect(actual).toEqual(expected);
  });

  it('number', () => {
    const actual = parseObjectAndReturnRootChildren({numberKey: 1});
    const expected: PlistEntry[] = [
      {
        id: 1,
        key: 'numberKey',
        type: 'Number',
        value: '1',
        children: undefined,
        parent: 0,
      },
    ];
    expect(actual).toEqual(expected);
  });

  it('boolean', () => {
    const actual = parseObjectAndReturnRootChildren({boolKey: true});
    const expected: PlistEntry[] = [
      {
        id: 1,
        key: 'boolKey',
        type: 'Boolean',
        value: 'YES',
        children: undefined,
        parent: 0,
      },
    ];
    expect(actual).toEqual(expected);
  });

  const FAKE_DATE = new Date('1995-07-30T03:24:00');
  it('date', () => {
    const actual = parseObjectAndReturnRootChildren({dateKey: FAKE_DATE});
    const expected: PlistEntry[] = [
      {
        id: 1,
        key: 'dateKey',
        type: 'Date',
        value: '1995-07-30T07:24:00.000Z',
        children: undefined,
        parent: 0,
      },
    ];
    expect(actual).toEqual(expected);
  });

  // Data is "Hello World!" encoded as base64 string.
  const FAKE_DATA = Buffer.from('SGVsbG8gV29ybGQhCg==', 'base64');
  const FAKE_DATA_AS_HEX = '48656C6C6F20576F726C64210A';
  it('data', () => {
    const actual = parseObjectAndReturnRootChildren({dataKey: FAKE_DATA});
    const expected: PlistEntry[] = [
      {
        id: 1,
        key: 'dataKey',
        type: 'Data',
        value: `<${FAKE_DATA_AS_HEX}>`,
        children: undefined,
        parent: 0,
      },
    ];
    expect(actual).toEqual(expected);
  });

  it('empty array', () => {
    const actual = parseObjectAndReturnRootChildren({arrayKey: []});
    const expected: PlistEntry[] = [
      {
        id: 1,
        key: 'arrayKey',
        type: 'Array',
        value: '(0 items)',
        children: [],
        parent: 0,
      },
    ];
    expect(actual).toEqual(expected);
  });

  it('array', () => {
    const actual = parseObjectAndReturnRootChildren({arrayKey: [1]});
    const expected: PlistEntry[] = [
      {
        id: 1,
        key: 'arrayKey',
        type: 'Array',
        value: '(1 item)',
        children: [
          {
            id: 2,
            key: 'Item 0',
            type: 'Number',
            value: '1',
            parent: 1,
            children: undefined,
          },
        ],
        parent: 0,
      },
    ];
    expect(actual).toEqual(expected);
  });

  it('empty dictionary', () => {
    const actual = parseObjectAndReturnRootChildren({dictionaryKey: {}});
    const expected: PlistEntry[] = [
      {
        id: 1,
        key: 'dictionaryKey',
        type: 'Dictionary',
        value: '(0 items)',
        children: [],
        parent: 0,
      },
    ];
    expect(actual).toEqual(expected);
  });

  it('dictionary', () => {
    const actual = parseObjectAndReturnRootChildren({
      dictionaryKey: {numberKey: 1},
    });
    const expected: PlistEntry[] = [
      {
        id: 1,
        key: 'dictionaryKey',
        type: 'Dictionary',
        value: '(1 item)',
        children: [
          {
            id: 2,
            key: 'numberKey',
            type: 'Number',
            value: '1',
            parent: 1,
            children: undefined,
          },
        ],
        parent: 0,
      },
    ];
    expect(actual).toEqual(expected);
  });

  it('complex', () => {
    const actual = parseObjectAndReturnRootChildren({
      dictionaryKey: {
        arrayKey: ['1', 1, true, FAKE_DATE, FAKE_DATA, [], {}],
      },
    });
    const expected: PlistEntry[] = [
      {
        id: 1,
        key: 'dictionaryKey',
        type: 'Dictionary',
        value: '(1 item)',
        children: [
          {
            id: 2,
            key: 'arrayKey',
            parent: 1,
            type: 'Array',
            value: '(7 items)',
            children: [
              {
                children: undefined,
                id: 3,
                key: 'Item 0',
                parent: 2,
                type: 'String',
                value: '1',
              },
              {
                children: undefined,
                id: 4,
                key: 'Item 1',
                parent: 2,
                type: 'Number',
                value: '1',
              },
              {
                children: undefined,
                id: 5,
                key: 'Item 2',
                parent: 2,
                type: 'Boolean',
                value: 'YES',
              },
              {
                children: undefined,
                id: 6,
                key: 'Item 3',
                parent: 2,
                type: 'Date',
                value: '1995-07-30T07:24:00.000Z',
              },
              {
                children: undefined,
                id: 7,
                key: 'Item 4',
                parent: 2,
                type: 'Data',
                value: `<${FAKE_DATA_AS_HEX}>`,
              },
              {
                children: [],
                id: 8,
                key: 'Item 5',
                parent: 2,
                type: 'Array',
                value: '(0 items)',
              },
              {
                children: [],
                id: 9,
                key: 'Item 6',
                parent: 2,
                type: 'Dictionary',
                value: '(0 items)',
              },
            ],
          },
        ],
        parent: 0,
      },
    ];
    expect(actual).toEqual(expected);
  });
});
