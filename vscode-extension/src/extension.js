const wikiLinks = require('./wikiLinks');
const grammarCheck = require('./grammarCheck');
const proseMode = require('./proseMode');
const backgroundColor = require('./backgroundColor');

function activate(context) {
  wikiLinks.activate(context);
  grammarCheck.activate(context);
  proseMode.activate(context);
  backgroundColor.activate(context);
}

function deactivate() {}

module.exports = { activate, deactivate };
