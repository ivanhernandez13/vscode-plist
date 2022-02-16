/** Limits the number of times an action will run in a given interval. */
export class Debouncer<T> {
  private timeout?: NodeJS.Timeout;
  private args: T[] = [];

  constructor(
    private readonly action: (...args: T[]) => void,
    private readonly delay: number
  ) {}

  run(...args: T[]): void {
    this.args = args;
    if (this.timeout) return;

    this.timeout = setTimeout(() => {
      this.timeout = undefined;
      this.action(...this.args);
    }, this.delay);
  }
}
