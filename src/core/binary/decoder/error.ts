/**
 * Error thrown when reading a file that is expected to be a binary plist but
 * does not contain the expected magic value.
 */
export class InvalidMagicError extends Error {
  constructor(magic: string) {
    super(`Unexpected magic '${magic}', expected 'bplist'.`);
  }
}

/**
 * Error thrown when reading a binary plist file that is a version other than
 * the most common 00 version.
 */
export class UnsupportedVersionError extends Error {
  constructor(version: string) {
    super(`Unexpected version '${version}', expected '00'.`);
  }
}

/**
 * Error thrown when parsing the contents of a binary plist file and finding a
 * tag that is unsupported by version 00.
 */
export class UnsupportedTagError extends Error {
  constructor(tag: string) {
    super(`${tag} tag is not supported`);
  }
}

/**
 * Error thrown when parsing the contents of a binary plist file and finding a
 * tag that is unsupported by version 00.
 */
export class PlistStructureError extends Error {
  constructor(type: string) {
    super(`${type} is not a supported type for a plist root value.`);
  }
}

export function errorMessageOrToString(errorOrUnknown: unknown): string {
  return errorOrUnknown instanceof Error
    ? errorOrUnknown.message
    : String(errorOrUnknown);
}
