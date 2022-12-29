import * as path from 'path';
import * as glob from 'glob';
import jasmine = require('jasmine');
import {readFile, writeFile} from 'fs/promises';

const TESTS_ROOT = path.resolve(__dirname, '../..');

export function run(): Promise<void> {
  const runner = new jasmine({projectBaseDir: TESTS_ROOT});

  return new Promise((c, e) => {
    glob('**/**.test.js', {cwd: TESTS_ROOT}, async (err, files) => {
      if (err) {
        return e(err);
      }

      try {
        await performLeetHacks();
      } catch (err) {
        console.error('Failed to remap imports.', err);
      }
      // Add files to the test suite
      files.forEach(f => runner.addSpecFile(path.resolve(TESTS_ROOT, f)));

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

async function performLeetHacks(): Promise<void> {
  const remapPaths = await readRequireMappings();
  if (!remapPaths) return;

  const pendingRemappings = Object.entries(remapPaths).map(
    ([name, relpaths]) => {
      const filepath = calculateFileToRemap(relpaths[0]);
      return remapRequirePaths(name, filepath, 'node');
    }
  );
  await Promise.all(pendingRemappings);
}

type RequireMappings = {[name: string]: string[]};

async function readRequireMappings(): Promise<RequireMappings | undefined> {
  const rawTsConfig = await readFile(
    path.resolve(TESTS_ROOT, '../tsconfig.json'),
    'utf-8'
  );

  const tsConfig: {compilerOptions?: {paths?: RequireMappings}} =
    JSON.parse(rawTsConfig);
  return tsConfig.compilerOptions?.paths;
}

function calculateFileToRemap(sourcePath: string): string {
  const outputPath = sourcePath.replace('src/', '') + '.js';
  return path.resolve(
    TESTS_ROOT,
    path.dirname(outputPath),
    '..',
    path.basename(outputPath)
  );
}

async function remapRequirePaths(
  moduleName: string,
  filepath: string,
  target: 'node' | 'browser'
): Promise<void> {
  return readFile(filepath, 'utf-8').then(content => {
    const remappedContent = content.replace(
      `require("${moduleName}")`,
      `require("./${target}/${moduleName}")`
    );
    const logFilepath = filepath.substring(
      path.resolve(TESTS_ROOT, '..').length
    );
    console.log(
      `.${logFilepath}: remapping 'require("${moduleName}")' to 'require("./${target}/${moduleName}")'`
    );
    return writeFile(filepath, remappedContent);
  });
}
