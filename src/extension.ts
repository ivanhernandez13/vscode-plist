import * as vscode from 'vscode';

import {ProvisioningProfileEditorProvider} from './core/mobileprovision/provisioning_profile_editor_provider';
import {StorageLocations} from './common/storage_location';
import {BinaryPlistEditorProvider} from './core/binary/binary_plist_editor_provider';
import {GeneratedFileTracker} from './core/binary/generated_file_tracker';
import {MANIFEST} from './core/manifest';
import {PlistEditorProvider} from './core/textual/plist_editor_provider';
import {logger} from './common/logging/extension_logger';

/** Called by VS Code when the extension is activated. */
export async function activate(context: vscode.ExtensionContext) {
  const baseStorageLocation = context.storageUri ?? context.globalStorageUri;
  const storageLocations = await createWorkspaceStorage(baseStorageLocation);

  context.subscriptions.push(
    new PlistEditorProvider(
      context.extensionUri,
      context.workspaceState,
      storageLocations
    ),
    new BinaryPlistEditorProvider(
      storageLocations.bplist,
      new GeneratedFileTracker()
    ),
    new ProvisioningProfileEditorProvider(storageLocations.mobileprovision),
    vscode.commands.registerCommand(MANIFEST.commands.clearCaches, () =>
      clearCaches(context.workspaceState)
    )
  );
}

function clearCaches(workspaceState: vscode.Memento): Promise<unknown> {
  const contents: Array<[string, unknown]> = [];
  const updates = workspaceState.keys().map(key => {
    contents.push([key, workspaceState.get(key)]);
    return workspaceState.update(key, undefined);
  });
  logger.info('Clearing workspace state', contents);
  return Promise.all(updates);
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
