import * as vscode from 'vscode';

import {FormattedLogger} from './formatted_logger';

/** Logs messages to a vscode.OutputChannel. */
export class OutputChannelLogger extends FormattedLogger {
  private readonly outputChannel: vscode.OutputChannel;

  constructor(name: string) {
    super();
    this.outputChannel = vscode.window.createOutputChannel(name);
  }

  log(message: string): void {
    this.outputChannel.appendLine(message);
  }
}
