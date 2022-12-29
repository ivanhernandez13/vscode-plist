import * as vscode from 'vscode';

export function sleep(seconds: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve();
    }, seconds * 1000);
  });
}

export function promisifyEvent<T>(
  event: vscode.Event<T>,
  condition?: (arg: T) => boolean
): Promise<T> {
  return new Promise(resolve => {
    const listener = event(arg => {
      if (condition && !condition(arg)) return;

      resolve(arg);
      listener.dispose();
    });
  });
}
