#!/usr/bin/env node
 // telling *nix systems that the interpreter of our JavaScript file should be
// /usr/bin/env node which looks up for the locally-installed node executable

const chalk = require('chalk');
const clear = require('clear');
const figlet = require('figlet');
const files = require('./lib/files');
const glob = require('glob');
const config = require('configstore');
const fs = require('fs');
const jsdom = require('jsdom');
const path = require('path');
const _ = require('lodash');

const {
  JSDOM
} = jsdom;

const baseDir = files.getCurrentDirectoryBase();
const rootDir = path.resolve('./');
const e2eFolder = [rootDir, 'e2e'].join(path.sep);
const languageKeyMap = new Map();
languageKeyMap.set('pt', 'Portuguese');
languageKeyMap.set('en', 'English');

clear();
console.log(
  chalk.yellow(
    figlet.textSync('EEM Test', {
      horizontalLayout: 'full'
    })
  )
);


const convertTagNameToExpectMatcher = (tagName, tagValue) => {
  let tagNameHTML = tagName.toLowerCase();
  let parentElementMatcher;
  let childElementMatcher;
  switch (tagNameHTML) {
    case 'ion-label':
      parentElementMatcher =
        `element(by.css('${tagNameHTML}[eem-key="${tagValue}"]'))`;
      return `expect(${parentElementMatcher}.getText()).toBe(translate.${tagValue})`;
    case 'ion-title':
      parentElementMatcher =
        `element(by.css('${tagNameHTML}[eem-key="${tagValue}"]'))`;
      return `expect(${parentElementMatcher}.getText()).toBe(translate.${tagValue})`;
    default:
      return '';
  }
};

const extractLanguageCodeFromFileName = (fileName) => {
  const fileComponents = fileName.split(path.sep);
  return fileComponents[fileComponents.length - 1].split('.')[0];
};

const buildExpectMatches = (elementSource) => {
  const map = new Map();
  elementSource.forEach((value, key) => {
    if (!map.has(key)) {
      map.set(key, '');
    }
    value.forEach((element) => {
      const expectString = convertTagNameToExpectMatcher(element.tagName,
        element.getAttribute('eem-key'));
      map.set(key, [map.get(key), expectString + ';'].join('\n'));
    });
  });
  return map;
}

const buildElementMap = (fileNames) => {
  let map = new Map();

  fileNames.reduce((collector, fileName, index) => {
    fileName = [rootDir, fileName].join(path.sep);
    const fileContent = fs.readFileSync(fileName, 'utf-8');
    const dom = new JSDOM(fileContent);
    const elementArray = [].slice.call(dom.window.document.querySelectorAll(
      '[eem-key]'));
    collector.set(fileName, elementArray);
    return collector;
  }, map);

  return map;
};

// Get a list of html files
const globElementPromise = new Promise((resolve, reject) => {
  glob('./src/pages/**/*.html', (err, items) => {
    if (err) {
      reject(err);
    } else {
      resolve(buildExpectMatches(buildElementMap(items)));
    }
  });
});

const globLanguagePromise = new Promise((resolve, reject) => {
  glob('./src/assets/i18n/**/*.json', (err, items) => {
    if (err) {
      reject(err);
    } else {
      let map = new Map();
      items.reduce((collector, item) => {
        const langCode = extractLanguageCodeFromFileName(item);
        item = [rootDir, item].join(path.sep);
        map.set(langCode, {
          languageName: languageKeyMap.get(langCode),
          languageFile: item
        });
      }, map);
      resolve(map);
    }
  });
});

Promise.all([globElementPromise, globLanguagePromise]).then((maps) => {
  const langMap = maps[1];
  const expectMap = maps[0];
  const testCases = [];

  expectMap.forEach((expectString, fileName) => {
    if (expectString !== '') {
      const testCaseFile = `${e2eFolder}/lang.auto.testcase.ts`;
      const testCaseVar = _.capitalize(path.basename(fileName).split(
        '.')[0]);
      const testCaseContent =
        `
      /* ${fileName} */
      let TestCase${testCaseVar} = (translate) => {
        ${expectString}
      };
      export {TestCase${testCaseVar}};`;
      testCases.push(testCaseContent);
      fs.writeFileSync(testCaseFile,
        `
        import { browser, element, by, protractor, $ } from 'protractor';
        ${testCaseContent}
        `
      );
      console.log(chalk.green('Test case file created at ' +
        testCaseFile));

      langMap.forEach((langObj, langCode) => {
        const translateVariable =
          `translate${langCode.toUpperCase()}`;
        const testFile =
          `${e2eFolder}/lang.${langCode}.e2e-spec.ts`;
        const testCaseObject = `TestCase${testCaseVar}`;
        fs.writeFileSync(testFile,
          `
            import { protractor } from 'protractor';
            import { LoginPage } from './pages/login.page';
            import * as ${translateVariable} from '${langObj.languageFile}';
            import { ${testCaseObject} } from './lang.auto.testcase';
            let loginPage: LoginPage, EC = protractor.ExpectedConditions;
            fdescribe("Test language translation", () => {
              beforeEach(() => {
                loginPage = new LoginPage(EC);
                loginPage.goToPage();
                loginPage.changeLanguage('${langObj.languageName}');
              });
              it("has static text in ${langObj.languageName}", ${testCaseObject}.bind(null, ${translateVariable}))
            });`
        );
        console.log(chalk.green(
          `Test file for ${langObj.languageName} created at ${testFile}`
        ));
      });
    }
  });
});

// Generates test cases for static element from the HTML template
// Using an attribute to annotate the control/element need to be tested in the tempalte
// Generates expect matchers for all those elements

// Refactor the test so that it can be used with different languages
// Generates language dependent lines
