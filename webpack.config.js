//@ts-check

'use strict';

const path = require('path');
const webpack = require('webpack');

//@ts-check
/** @typedef {import('webpack').Configuration} WebpackConfig **/

const PLACEHOLDER = '__NODE_OR_BROWSER__';

const ALIAS_PATHS = [
  `src/core/binary/${PLACEHOLDER}/decoder`,
  `src/common/utilities/${PLACEHOLDER}/host`,
  `src/common/utilities/${PLACEHOLDER}/hash`,
  `src/core/mobileprovision/${PLACEHOLDER}/provisioning_profile_editor_provider`,
];

function aliases(browserOrNode) {
  const aliases = {};
  for (const alias of ALIAS_PATHS) {
    const basename = path.basename(alias);
    const relativePath = alias.replace(PLACEHOLDER, browserOrNode);
    aliases[basename] = path.resolve(__dirname, relativePath);
  }
  return aliases;
}

// name,
// target,
// entry,
// output,
// resolve,
function webpackConfig(options, tsConfigFilename) {
  return /** @type WebpackConfig */ {
    mode: 'none',
    module: {
      rules: [
        {
          test: /\.ts$/,
          exclude: /node_modules/,
          use: [
            {
              loader: 'ts-loader?configFile=' + tsConfigFilename,
            },
          ],
        },
      ],
    },
    externals: {
      vscode: 'commonjs vscode', // ignored because it doesn't exist
    },
    performance: {
      hints: false,
    },
    devtool: 'nosources-source-map', // create a source map that points to the original source file
    infrastructureLogging: {
      level: 'log', // enables logging required for problem matchers
    },
    ...options,
  };
}

const browserConfig = webpackConfig(
  {
    context: __dirname,
    name: 'browser',
    target: 'webworker', // web extensions run in a webworker context
    entry: {
      'extension-web': './src/extension.ts', // source of the web extension main file
      // 'test/suite/index-web': './src/test/suite/index-web.ts', // source of the web extension test runner
    },
    output: {
      filename: '[name].js',
      path: path.join(__dirname, 'dist'),
      libraryTarget: 'commonjs',
    },
    resolve: {
      mainFields: ['browser', 'module', 'main'], // look for `browser` entry point in imported node modules
      extensions: ['.ts', '.js'], // support ts-files and js-files
      alias: aliases('browser'),
      fallback: {
        // Webpack 5 no longer polyfills Node.js core modules automatically.
        // see https://webpack.js.org/configuration/resolve/#resolvefallback
        // for the list of Node.js core module polyfills.
      },
    },
    plugins: [
      new webpack.ProvidePlugin({
        process: 'process/browser', // provide a shim for the global `process` variable
      }),
      new webpack.ProvidePlugin({
        Buffer: ['buffer', 'Buffer'],
      }),
    ],
  },
  'tsconfig.browser.json'
);

const nodeConfig = webpackConfig(
  {
    name: 'node',
    target: 'node', // vscode extensions run in a Node.js-context 📖 -> https://webpack.js.org/configuration/node/
    entry: './src/extension.ts', // the entry point of this extension, 📖 -> https://webpack.js.org/configuration/entry-context/
    output: {
      filename: 'extension.js',
      path: path.resolve(__dirname, 'dist'),
      libraryTarget: 'commonjs2',
    },
    resolve: {
      extensions: ['.ts', '.js'],
      alias: aliases('node'),
    },
  },
  'tsconfig.json'
);

const webviewConfig = webpackConfig(
  {
    name: 'webview',
    entry: './ui/webview.ts',
    output: {
      path: path.resolve(__dirname, './ui'),
      filename: 'webview.js',
    },
    resolve: {
      extensions: ['.ts'],
    },
  },
  'tsconfig.webview.json'
);

module.exports = [nodeConfig, browserConfig, webviewConfig];
