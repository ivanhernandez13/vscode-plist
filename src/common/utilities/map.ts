export function sizeOf(map: Map<unknown, unknown>): number {
  return Array.from(map.keys()).length;
}
