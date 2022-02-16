/**
 * The layout of a binary plist along with their meaning is document at:
 * https://opensource.apple.com/source/CF/CF-1153.18/CFBinaryPList.c.auto.html
 *
 * HEADER
 *  bytes - [0, 8]
 * 	magic number ("bplist")
 * 	file format version (currently "0?")
 *
 * OBJECT TABLE
 *  bytes - [8, Offset Table Start)
 * 	variable-sized objects
 *
 * 	Object Formats (marker byte followed by additional info in some cases)
 * 	null	0000 0000			// null object [v"1?"+ only]
 * 	bool	0000 1000			// false
 * 	bool	0000 1001			// true
 * 	url	0000 1100	string		// URL with no base URL, recursive encoding of URL string [v"1?"+ only]
 * 	url	0000 1101	base string	// URL with base URL, recursive encoding of base URL, then recursive encoding of URL string [v"1?"+ only]
 * 	uuid	0000 1110			// 16-byte UUID [v"1?"+ only]
 * 	fill	0000 1111			// fill byte
 * 	int	0001 0nnn	...		// # of bytes is 2^nnn, big-endian bytes
 * 	real	0010 0nnn	...		// # of bytes is 2^nnn, big-endian bytes
 * 	date	0011 0011	...		// 8 byte float follows, big-endian bytes
 * 	data	0100 nnnn	[int]	...	// nnnn is number of bytes unless 1111 then int count follows, followed by bytes
 * 	string	0101 nnnn	[int]	...	// ASCII string, nnnn is # of chars, else 1111 then int count, then bytes
 * 	string	0110 nnnn	[int]	...	// Unicode string, nnnn is # of chars, else 1111 then int count, then big-endian 2-byte uint16_t
 * 	string	0111 nnnn	[int]	...	// UTF8 string, nnnn is # of chars, else 1111 then int count, then bytes [v"1?"+ only]
 * 	uid	1000 nnnn	...		// nnnn+1 is # of bytes
 * 		1001 xxxx			// unused
 * 	array	1010 nnnn	[int]	objref*	// nnnn is count, unless '1111', then int count follows
 * 	ordset	1011 nnnn	[int]	objref* // nnnn is count, unless '1111', then int count follows [v"1?"+ only]
 * 	set	1100 nnnn	[int]	objref* // nnnn is count, unless '1111', then int count follows [v"1?"+ only]
 * 	dict	1101 nnnn	[int]	keyref* objref*	// nnnn is count, unless '1111', then int count follows
 * 		1110 xxxx			// unused
 * 		1111 xxxx			// unused
 *
 * OFFSET TABLE
 *  bytes - [Offset Table Start, EOF - 32)
 * 	list of ints, byte size of which is given in trailer
 * 	-- these are the byte offsets into the file
 * 	-- number of these is in the trailer
 *
 * TRAILER
 *  bytes - [EOF - 32, EOF)
 * 	byte size of offset ints in offset table
 * 	byte size of object refs in arrays and dicts
 * 	number of offsets in offset table (also is number of objects)
 * 	element # in offset table which is top level object
 * 	offset table offset
 */

import * as vscode from 'vscode';

import {BinaryPlistMarker} from './binary_plist_marker';
import {parseHeader} from './binary_plist_header';
import {BinaryPlistTrailer, parseTrailer} from './binary_plist_trailer';
import {PlistDictionary, PlistValue} from '../../../common/types';
import {
  InvalidMagicError,
  UnsupportedTagError,
  UnsupportedVersionError,
} from './error';

const FOUR_BIT_MAX = 0b1111;

export async function isBinaryPlist(uri: vscode.Uri): Promise<boolean> {
  const contentsByteArray = await vscode.workspace.fs.readFile(uri);
  const contents = Buffer.from(contentsByteArray);
  try {
    assertBinaryPlist(contents);
  } catch {
    return false;
  }
  return true;
}

function assertBinaryPlist(bytes: Buffer): void {
  const header = parseHeader(bytes);
  if (header.magic !== 'bplist') {
    throw new InvalidMagicError(header.magic);
  } else if (header.version !== '00') {
    throw new UnsupportedVersionError(header.version);
  }
}

export async function decodeBinaryPlist(uri: vscode.Uri): Promise<PlistValue> {
  const byteArray = await vscode.workspace.fs.readFile(uri);
  return decodeBinaryPlistImpl(Buffer.from(byteArray));
}

// Convenience function to make testing possible without requiring a file.
function decodeBinaryPlistImpl(bytes: Buffer): PlistValue {
  assertBinaryPlist(bytes);
  const trailer = parseTrailer(bytes);

  // Determine the offset to the first enty in the offset table.
  const offsetTableOffset = trailer.offsetTableStart + trailer.topObjectOffset;
  // Determine the offset to the root level item in object table. Every other
  // item will be found recursively.
  const objectTableOffset = bytes.readUintBE(
    offsetTableOffset,
    trailer.offsetTableIntSize
  );

  return parseObjectTable(bytes, objectTableOffset, trailer);
}

function parseObjectTable(
  bytes: Buffer,
  offset: number,
  trailer: BinaryPlistTrailer
): PlistValue {
  const marker = bytes.readUint8(offset);
  // The offset to the next ref in the object table.
  const nextOffset = offset + 1;

  // Handle cases where the marker tells us both the type and the value of the
  // entry.
  switch (marker) {
    case BinaryPlistMarker.Null:
      throw new UnsupportedTagError('null');

    case BinaryPlistMarker.False:
      return false;

    case BinaryPlistMarker.True:
      return true;

    case BinaryPlistMarker.Date: {
      return parseAsDate(bytes, nextOffset);
    }
    default:
      break;
  }

  // Handle remaining cases where the marker holds type information but may not
  // contain complete value information. The marker is a byte long where the
  // first nibble tells us the type and the second nibble is known as the
  // "fill". The fill's meaning depends on the type.
  const markerType = marker & 0xf0;
  const markerFill = marker & 0x0f;

  switch (markerType) {
    case BinaryPlistMarker.Int: {
      const byteLength = Math.pow(2, markerFill);
      return byteLength === 8
        ? Number(bytes.readBigInt64BE(nextOffset))
        : bytes.readIntBE(nextOffset, byteLength);
    }

    case BinaryPlistMarker.Real: {
      const byteLength = Math.pow(2, markerFill);
      switch (byteLength) {
        case 4:
          return bytes.readFloatBE(nextOffset);
        case 8:
          return bytes.readDoubleBE(nextOffset);
        default:
          return bytes.readIntBE(nextOffset, byteLength);
      }
    }

    case BinaryPlistMarker.Data:
      return Buffer.from(bytes.subarray(nextOffset, nextOffset + markerFill));

    case BinaryPlistMarker.ASCIIString:
    case BinaryPlistMarker.UTF8String:
      return parseAsString(bytes, markerFill, nextOffset, /* charSize */ 1);

    case BinaryPlistMarker.UnicodeString:
      return parseAsString(bytes, markerFill, nextOffset, /* charSize */ 2);

    case BinaryPlistMarker.Array: {
      const [itemCount, adjustedOffset] = resolveLength(
        bytes,
        nextOffset,
        markerFill
      );
      return parseAsArray(bytes, itemCount, adjustedOffset, trailer);
    }

    case BinaryPlistMarker.Dict: {
      const [keyValuePairCount, adjustedOffset] = resolveLength(
        bytes,
        nextOffset,
        markerFill
      );
      return parseAsDictionary(
        bytes,
        keyValuePairCount,
        adjustedOffset,
        trailer
      );
    }

    case BinaryPlistMarker.Url:
    case BinaryPlistMarker.Url2:
      throw new UnsupportedTagError('url');

    case BinaryPlistMarker.UUID:
      throw new UnsupportedTagError('uuid');

    case BinaryPlistMarker.UID:
      throw new UnsupportedTagError('uid');

    case BinaryPlistMarker.OrdSet:
      throw new UnsupportedTagError('ordset');

    case BinaryPlistMarker.Set:
      throw new UnsupportedTagError('set');
  }

  throw new Error(`Unhandled marker ${marker.toString(16)}`);
}
/**
 * Returns a tuple where the first item is the length of the object and the
 * second item is the offset where the contents of the object begin.
 */
function resolveLength(
  bytes: Buffer,
  offset: number,
  fill: number
): [number, number] {
  // When the marker fill can be represented in 4 bits (i.e. < 15), interpret
  // the fill as the length of the object.
  if (fill < FOUR_BIT_MAX) {
    // We don't need to read any additional bytes to determine the object length
    // so the offset we were given is already where the contents of the object
    // begin.
    return [fill, offset];
  }

  // When the marker fill cannot be represented in 4 bits (i.e. >= 15), the byte
  // after the fill byte holds the log base 2 of n where n is number of bytes
  // needed to represent the length of the object. The n bytes after are the
  // length of the object.
  // e.g.
  //      Bytes to Interpret: 0xDF 0x03 0xE8 0x10 0xAC ...
  //             Marker Fill: 0xDF & 15 = 0x0F (First Byte)
  //              Log Base 2: 0x11 & 15 = 0x01 (Second Byte)
  // Object Length Byte Size: 2^1 = 2
  //           Object Length: 0x03 0xE8 = 1000 (Third & Fourth Bytes)
  //   Object Ref #1 of 1000: 0xAC             (Fifth Byte)
  const logBase2 = bytes.readUint8(offset) & FOUR_BIT_MAX;
  const objectLengthByteSize = Math.pow(2, logBase2);
  const objectLengthOffset = offset + 1;
  const objectLength = bytes.readUintBE(
    objectLengthOffset,
    objectLengthByteSize
  );
  return [objectLength, objectLengthOffset + objectLengthByteSize];
}

function parseAsString(
  bytes: Buffer,
  fill: number,
  offset: number,
  charSize: 1 | 2
) {
  if (fill < FOUR_BIT_MAX) {
    const end = offset + fill * charSize;
    return charSize === 1
      ? bytes.subarray(offset, end).toString('ascii')
      : bytes.subarray(offset, end).swap16().toString('utf16le');
  }

  const [stringLength, stringOffset] = resolveLength(bytes, offset, fill);
  const stringBytes = bytes.subarray(
    stringOffset,
    stringOffset + stringLength * charSize
  );

  return charSize === 1
    ? stringBytes.toString('ascii')
    : stringBytes.swap16().toString('utf16le');
}

const CORE_FOUNDATION_ABSOLUTE_TIME_START = 'January 1 2001 GMT' as const;
function parseAsDate(bytes: Buffer, offset: number): Date {
  const cfAbsoluteTime = bytes.readDoubleBE(offset);
  const date = new Date(CORE_FOUNDATION_ABSOLUTE_TIME_START);
  date.setSeconds(date.getSeconds() + cfAbsoluteTime);
  return date;
}

function parseContainerReference(
  bytes: Buffer,
  containerOffset: number,
  referenceOffset: number,
  trailer: BinaryPlistTrailer
) {
  const {objectTableRefSize, offsetTableStart, offsetTableIntSize} = trailer;

  // Read object reference from the object table
  const offsetTableOffset =
    bytes.readUintBE(containerOffset + referenceOffset, objectTableRefSize) *
    offsetTableIntSize;
  const resolvedOffset = offsetTableStart + offsetTableOffset;
  // Read object table offset to the actual value from the offset table
  const objectTableOffset = bytes.readUintBE(
    resolvedOffset,
    offsetTableIntSize
  );
  // Read the actual value from the Object Table
  return parseObjectTable(bytes, objectTableOffset, trailer);
}

function parseAsDictionary(
  bytes: Buffer,
  itemCount: number,
  offset: number,
  trailer: BinaryPlistTrailer
): PlistDictionary {
  const entries: Array<[PlistValue, PlistValue]> = [];

  const refSize = trailer.objectTableRefSize;
  for (let keyRefOffset = 0; keyRefOffset < itemCount; keyRefOffset++) {
    const key = parseContainerReference(
      bytes,
      offset,
      keyRefOffset * refSize,
      trailer
    );
    // All key refs are stored sequentially followed by all the value refs so to
    // get to the corresponding object ref we must skip over all key refs.
    const valueRefOffset = keyRefOffset + itemCount;
    const value = parseContainerReference(
      bytes,
      offset,
      valueRefOffset * refSize,
      trailer
    );
    entries.push([key, value]);
  }

  return Object.fromEntries(entries);
}

function parseAsArray(
  bytes: Buffer,
  itemCount: number,
  offset: number,
  trailer: BinaryPlistTrailer
): PlistValue[] {
  const entries: PlistValue[] = [];

  const refSize = trailer.objectTableRefSize;
  for (let refOffset = 0; refOffset < itemCount; refOffset++) {
    const value = parseContainerReference(
      bytes,
      offset,
      refOffset * refSize,
      trailer
    );
    entries.push(value);
  }

  return entries;
}

export const TEST_ONLY = {
  assertBinaryPlist,
  decodeBinaryPlistImpl,
};
