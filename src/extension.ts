import * as vscode from 'vscode';

import {ProvisioningProfileEditorController} from 'provisioning_profile_editor_controller';
import {StorageLocations} from './common/storage_location';
import {BinaryPlistEditorController} from './core/binary/binary_plist_editor_controller';
import {GeneratedFileTracker} from './core/binary/generated_file_tracker';
import {MANIFEST} from './core/manifest';
import {PlistEditorController} from './core/textual/plist_editor_controller';

/** Called by VS Code when the extension is activated. */
export async function activate(context: vscode.ExtensionContext) {
  const baseStorageLocation = context.storageUri ?? context.globalStorageUri;
  const storageLocations = await createWorkspaceStorage(baseStorageLocation);

  context.subscriptions.push(
    new PlistEditorController(
      context.extensionUri,
      context.workspaceState,
      storageLocations
    ),
    new BinaryPlistEditorController(
      storageLocations.bplist,
      new GeneratedFileTracker()
    ),
    new ProvisioningProfileEditorController(storageLocations.mobileprovision),
    vscode.commands.registerCommand(MANIFEST.COMMANDS.clearCaches, () =>
      clearCaches(context.workspaceState)
    )
  );
}

function clearCaches(workspaceState: vscode.Memento): Promise<unknown> {
  return Promise.all(
    workspaceState.keys().map(key => workspaceState.update(key, undefined))
  );
}

async function createWorkspaceStorage(
  storageLocation: vscode.Uri
): Promise<StorageLocations> {
  const bplistLocation = vscode.Uri.joinPath(storageLocation, 'bplist');
  const mobileProvisionLocation = vscode.Uri.joinPath(
    storageLocation,
    'mobileprovision'
  );
  try {
    await vscode.workspace.fs.createDirectory(bplistLocation);
    await vscode.workspace.fs.createDirectory(mobileProvisionLocation);
  } catch (err) {
    vscode.window.showWarningMessage(
      'Failed to create directories for temporary files. ' + String(err)
    );
  }
  return {bplist: bplistLocation, mobileprovision: mobileProvisionLocation};
}

/** Called by VS Code when the extension is deactivated. */
export function deactivate() {}
