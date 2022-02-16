import {defaultValueForPlistType, plistTypeForValue} from './plist_view_model';

describe('Plist View Model', () => {
  it('plistTypeForValue', () => {
    const actual = plistTypeForValue('string');
    expect(actual).toEqual('String');
  });

  it('defaultValueForPlistType', () => {
    const actual = defaultValueForPlistType('String');
    expect(actual).toEqual('');
  });
});
