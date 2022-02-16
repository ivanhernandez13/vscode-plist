/**
 * The possible marker values in a binary plists object table section that
 * indicate the type of the encoded value.
 */
export enum BinaryPlistMarker {
  Null = 0x00, // v"1?"+ only
  False = 0x08,
  True = 0x09,
  Url = 0x0a, // v"1?"+ only
  Url2 = 0x0b, // v"1?"+ only
  UUID = 0x0c, // v"1?"+ only
  Fill = 0x0f,
  Int = 0x10,
  Real = 0x20,
  Date = 0x33,
  Data = 0x40,
  ASCIIString = 0x50,
  UnicodeString = 0x60,
  UTF8String = 0x70,
  UID = 0x80,
  Array = 0xa0,
  OrdSet = 0xb0, // v"1?"+ only
  Set = 0xc0, // v"1?"+ only
  Dict = 0xd0,
}
