import * as os from 'os';
import {isLocalWorkspace} from '../vscode';

const isMacOS = os.platform() === 'darwin';

export function isLocalMacOS(): boolean {
  return isMacOS && isLocalWorkspace();
}
