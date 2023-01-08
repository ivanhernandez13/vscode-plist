/**
 * Constants matching the values defined in the extension manifest (i.e.
 * package.json).
 */
export const MANIFEST = {
  commands: {
    clearCaches: 'plistEditor.clearCaches',
    collapseAll: 'plistEditor.collapseAll',
    expandAll: 'plistEditor.expandAll',
    openWithDefaultEditor: 'plistEditor.openWithDefaultEditor',
    openWithPlistEditor: 'plistEditor.openWithPlistEditor',
  },
  settings: {
    spacing: 'plist.editor.spacing',
    binaryDecoder: 'plist.binarySupport.decoder',
    loggingLevel: 'plist.logging.level',
  },
  customEditors: {
    plistEditor: 'plistEditor.plistedit',
    binaryPlistEditor: 'plistEditor.bplistedit',
    provisioningProfile: 'plistEditor.provisioningProfileEdit',
  },
} as const;
