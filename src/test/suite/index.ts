import * as path from 'path';
import * as glob from 'glob';
import jasmine = require('jasmine');

export function run(): Promise<void> {
  const testsRoot = path.resolve(__dirname, '../..');

  const runner = new jasmine({projectBaseDir: testsRoot});

  return new Promise((c, e) => {
    glob('**/**.test.js', {cwd: testsRoot}, async (err, files) => {
      if (err) {
        return e(err);
      }

      // Add files to the test suite
      files.forEach(f => runner.addSpecFile(path.resolve(testsRoot, f)));

      try {
        await runner.execute();
        c();
      } catch (err) {
        console.error(err);
        e(err);
      }
    });
  });
}
