import * as vscode from 'vscode';
import {executeVSCodeCommand} from '../../../common/utilities/vscode';

import {NodePlistReader} from './node_plist_reader';

describe('Node Plist Reader', () => {
  const CONTENT = `<?xml version="1.0" encoding="UTF-8"?>
  <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
  <plist version="1.0">
    <dict>
      <key>BooleanItem</key>
      <true/>
      <key>IntItem</key>
      <integer>1</integer>
      <key>FloatItem</key>
      <real>100.001</real>
      <key>StringItem</key>
      <string/>
      <key>ArrayItem</key>
      <array>
        <string/>
      </array>
      <key>DictItem</key>
      <dict>
        <key>DictStringItem</key>
        </string>
      </dict>
      <key>DateItem</key>
      <date>1970-01-01T00:00:00.000Z</date>
      <key>DataItem</key>
      <data>SGVsbG8gV29ybGQh</data>
  </plist>`;

  const EXPECTED = {
    BooleanItem: true,
    IntItem: 1,
    FloatItem: 100.001,
    StringItem: '',
    ArrayItem: [''],
    DictItem: {
      DictStringItem: '',
    },
    DateItem: new Date(0),
    DataItem: Buffer.from('Hello World!'),
  };

  beforeAll(() => executeVSCodeCommand('closeAllEditors'));

  afterEach(() => executeVSCodeCommand('closeAllEditors'));

  it('converts plist document to json', async () => {
    const document = await vscode.workspace.openTextDocument({
      content: CONTENT,
    });
    const reader = new NodePlistReader();
    const actual = await reader.plistDocumentToJson(document);
    expect(actual).toEqual(EXPECTED);
  });

  it('converts plist content to json', () => {
    const reader = new NodePlistReader();
    const actual = reader.plistContentToJson(CONTENT);
    expect(actual).toEqual(EXPECTED);
  });
});
