#!/usr/bin/env node
// telling *nix systems that the interpreter of our JavaScript file should be
// /usr/bin/env node which looks up for the locally-installed node executable

const chalk = require('chalk');
const clear = require('clear');
const figlet = require('figlet');
const files = require('./lib/files');
const glob = require('glob');

clear();
console.log(
  chalk.yellow(
    figlet.textSync('EEM Test', { horizontalLayout: 'full' })
  )
);

glob('**/*.spec.ts', {}, (er, files) => {
  console.log(files);
});
