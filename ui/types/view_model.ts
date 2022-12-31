export const PLIST_ENTRY_TYPES_WITH_CHILDREN = ['Array', 'Dictionary'] as const;
export const PLIST_ENTRY_TYPES = [
  ...PLIST_ENTRY_TYPES_WITH_CHILDREN,
  'String',
  'Number',
  'Boolean',
  'Date',
  'Data',
] as const;
export type PlistEntryType = typeof PLIST_ENTRY_TYPES[number];

export interface ViewModel {
  id: number;
  key: string;
  type: PlistEntryType;
  value: string;
  children?: ViewModel[];
  parent?: number;
}
