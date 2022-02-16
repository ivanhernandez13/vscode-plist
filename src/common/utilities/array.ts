export function arrayRemove<T>(arr: T[], value: T): boolean {
  const index = arr.indexOf(value);
  if (index === -1) {
    return false;
  }
  return arr.splice(index, 1).length > 0;
}
