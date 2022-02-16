type SingularPlistValue = Buffer | Date | string | number | boolean | null;
type PlistArray = PlistValue[];
export type PlistDictionary = {[key: string]: PlistValue};
export type PlistValue = SingularPlistValue | PlistArray | PlistDictionary;
