/**
 * Module dependencies/
 */
var fs = require('fs'),
  path = require('path'),
  Xgettext = require('xgettext-js'),
  preProcessXGettextJSMatch = require('./preprocess-xgettextjs-match.js'),
  formatters = require('./formatters'),
  debug = require('debug')('glotpress-js');

module.exports = function(config) {
  var keywords, data, matches, parser, parserKeywords, formatter, textOutput;

  keywords = config.keywords || ['translate'];
  formatter = (config.format || 'pot').toLowerCase();

  if (!config.data && !config.inputPaths) {
    throw new Error('Must provide input `data` or `inputPaths`');
  }

  parserKeywords = config.parserKeywords || {};

  if (keywords) {
    parserKeywords = keywords.reduce(function(output, currentKeyword) {
      output[currentKeyword] = preProcessXGettextJSMatch;
      return output;
    }, parserKeywords);
  }

  parser = new Xgettext({
    keywords: parserKeywords,
    parseOptions: {
      plugins: [
        'jsx',
        'typescript',
        'classProperties',
        'objectRestSpread',
        'exportExtensions',
        'trailingFunctionCommas',
        'asyncFunctions',
        'decorators',
        'dynamicImport',
      ],
      allowImportExportEverywhere: true,
    },
  });

  function getFileMatches(inputFiles) {
    return inputFiles.map(function(inputFile) {
      var relativeInputFilePath = path
        .relative(__dirname, inputFile)
        .replace(/^[\/.]+/, '');
      return parser
        .getMatches(fs.readFileSync(inputFile, 'utf8'))
        .map(function(match) {
          match.line = relativeInputFilePath + ':' + match.line;
          return match;
        });
    });
  }

  if (config.data) {
    // If data is provided, feed it directly to the parser and call the file <unknown>
    matches = [
      parser.getMatches(data).map(function(match) {
        match.location = '<unknown>:' + match.line;
        return match;
      }),
    ];
  } else {
    matches = getFileMatches(config.inputPaths);
  }

  if (config.extras) {
    matches = matches.concat(
      getFileMatches(
        config.extras.map(function(extra) {
          return path.join(__dirname, 'extras', extra + '.js');
        })
      )
    );
  }

  // The matches array now contains the entries for each file in it's own array:
  // [ [ 'file1 match1', 'file1 match2' ], [ 'file2 match1' ] ]

  // Flatten array, so that it has all entries in just one level.
  matches = [].concat.apply([], matches);

  debug('matches', matches);

  if ('string' === typeof formatter) {
    formatter = formatters[formatter];
  }

  if (!formatter) {
    throw new Error('Formatter not found : ' + config.formatter);
  }

  textOutput = formatter(matches, config);

  if (config.output) {
    fs.writeFileSync(config.output, textOutput, 'utf8');
  }

  return textOutput;
};
