/**
 * A typescript representation of the 8-byte binary plist header that closely
 * matches the representation from CoreFoundation: https://opensource.apple.com/source/CF/CF-1153.18/ForFoundationOnly.h.auto.html
 * i.e.
 * typedef struct {
 *   uint8_t _magic[6];
 *   uint8_t _version[2];
 * } CFBinaryPlistHeader;
 */
export interface CFBinaryPlistHeader {
  magic: Buffer;
  version: Buffer;
}

/**
 * The binary plist header that spans the first 8 bytes in a binary plist file.
 */
export interface BinaryPlistHeader {
  magic: string;
  version: string;
}

export function parseHeader(bytes: Buffer): BinaryPlistHeader {
  const cfHeader: CFBinaryPlistHeader = {
    magic: bytes.subarray(0, 6),
    version: bytes.subarray(6, 8),
  };
  return {
    magic: cfHeader.magic.toString(),
    version: cfHeader.version.toString(),
  };
}
