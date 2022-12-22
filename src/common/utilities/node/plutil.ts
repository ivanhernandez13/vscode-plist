import {CancellationToken} from 'vscode';
import {checkOutput} from './child_process';
import {quoted} from '../string';

async function convert(
  input: string,
  format: 'bplist' | 'plist' | 'json',
  output?: undefined,
  token?: CancellationToken
): Promise<string>;
async function convert(
  input: string,
  format: 'bplist' | 'plist' | 'json',
  output: string,
  token?: CancellationToken
): Promise<string>;
async function convert(
  input: string,
  format: 'bplist' | 'plist' | 'json',
  output = '-',
  token?: CancellationToken
): Promise<string> {
  const args = [
    format === 'json' ? format : format === 'plist' ? 'xml1' : 'binary1',
    '-r',
    input,
    '-o',
    quoted(output),
  ];
  return execPlutil('convert', args, token);
}

function execPlutil(
  command: 'convert',
  args: string[],
  token?: CancellationToken
): Promise<string> {
  return checkOutput('/usr/bin/plutil', [`-${command}`].concat(args), token);
}

/** Run the `plutil` CLI tool. */
export const plutil = {convert};
