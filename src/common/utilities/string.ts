export function quoted(str: string): string {
  const isSingleQuoted = str.startsWith("'") && str.endsWith("'");
  const isQouted = isSingleQuoted || (str.startsWith('"') && str.endsWith('"'));
  return isQouted ? str : `'${str}'`;
}
