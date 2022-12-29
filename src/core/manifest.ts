/**
 * Constants matching the values defined in the extension manifest (i.e.
 * package.json).
 */
export const MANIFEST = {
  COMMANDS: {
    clearCaches: 'plistEditor.clearCaches',
    collapseAll: 'plistEditor.collapseAll',
    expandAll: 'plistEditor.expandAll',
    openWithDefaultEditor: 'plistEditor.openWithDefaultEditor',
    openWithPlistEditor: 'plistEditor.openWithPlistEditor',
  },
  SETTINGS: {
    spacing: 'plist.editor.spacing',
    binaryDecoder: 'plist.binarySupport.decoder',
    loggingLevel: 'plist.logging.level',
  },
} as const;
