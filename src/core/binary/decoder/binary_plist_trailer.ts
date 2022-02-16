import {BinaryPlistFixedSectionLength} from './binary_plist_fixed_section_length';

/**
 * A typescript representation of the 32-byte binary plist trailer that closely
 * matches the representation from CoreFoundation: https://opensource.apple.com/source/CF/CF-1153.18/ForFoundationOnly.h.auto.html
 * i.e.
 * typedef struct {
 *   uint8_t _unused[5];
 *   uint8_t _sortVersion;
 *   uint8_t _offsetIntSize;
 *   uint8_t _objectRefSize;
 *   uint64_t	_numObjects;
 *   uint64_t	_topObject;
 *   uint64_t	_offsetTableOffset;
 * } CFBinaryPlistTrailer;
 */
interface CFBinaryPlistTrailer {
  unused: Buffer;
  sortVersion: number;
  offsetIntSize: number;
  objectRefSize: number;
  numObjects: bigint;
  topObject: bigint;
  offsetTableOffset: bigint;
}

/**
 * The binary plist trailer that spans the last 32 bytes in a binary plist file.
 */
export interface BinaryPlistTrailer {
  // The number of bytes used per integer in the offset table.
  offsetTableIntSize: number;
  // The number of bytes used per reference in the object table.
  objectTableRefSize: number;
  // The total number of objects in the object table.
  numObjects: number;
  // The offset in bytes from the start of the object table to the first object
  // in the object table.
  topObjectOffset: number;
  // The byte count at which the offset table starts.
  offsetTableStart: number;
}

export function parseTrailer(bytes: Buffer): BinaryPlistTrailer {
  const trailerBytes = bytes.subarray(
    0 - BinaryPlistFixedSectionLength.Trailer
  );

  // Read the trailer exactly as it is read in CoreFoundation.
  const cfTrailer: CFBinaryPlistTrailer = {
    unused: trailerBytes.subarray(0, 5),
    sortVersion: trailerBytes.readUInt8(5),
    offsetIntSize: trailerBytes.readUInt8(6),
    objectRefSize: trailerBytes.readUInt8(7),
    numObjects: trailerBytes.readBigUInt64BE(8),
    topObject: trailerBytes.readBigUInt64BE(16),
    offsetTableOffset: trailerBytes.readBigUInt64BE(24),
  };

  // Convert the trailer into our representation.
  return {
    offsetTableIntSize: cfTrailer.offsetIntSize,
    objectTableRefSize: cfTrailer.objectRefSize,
    numObjects: Number(cfTrailer.numObjects),
    topObjectOffset: Number(cfTrailer.topObject),
    offsetTableStart: Number(cfTrailer.offsetTableOffset),
  };
}
