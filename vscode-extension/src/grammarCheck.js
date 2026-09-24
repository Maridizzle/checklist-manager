const vscode = require('vscode');
const https = require('https');
const querystring = require('querystring');

const errorDecorationType = vscode.window.createTextEditorDecorationType({
  borderWidth: '0 0 2px 0',
  borderStyle: 'wavy',
  borderColor: '#ff6b6b',
  overviewRulerColor: '#ff6b6b',
  overviewRulerLane: vscode.OverviewRulerLane.Right,
});

const styleDecorationType = vscode.window.createTextEditorDecorationType({
  borderWidth: '0 0 2px 0',
  borderStyle: 'wavy',
  borderColor: '#ffd93d',
  overviewRulerColor: '#ffd93d',
  overviewRulerLane: vscode.OverviewRulerLane.Right,
});

const typoDecorationType = vscode.window.createTextEditorDecorationType({
  borderWidth: '0 0 2px 0',
  borderStyle: 'wavy',
  borderColor: '#6bcb77',
  overviewRulerColor: '#6bcb77',
  overviewRulerLane: vscode.OverviewRulerLane.Right,
});

let currentMatches = [];
let statusBarItem = null;
let diagnosticCollection = null;

function getDecorationType(rule) {
  if (!rule || !rule.category) return errorDecorationType;
  const cat = rule.category.id || '';
  if (cat === 'TYPOS' || cat === 'SPELLING') return typoDecorationType;
  if (cat === 'STYLE' || cat === 'REDUNDANCY' || cat === 'TYPOGRAPHY') return styleDecorationType;
  return errorDecorationType;
}

function checkGrammar(text, language) {
  const postData = querystring.stringify({ text, language: language || 'en-US' });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.languagetool.org',
      port: 443,
      path: '/v2/check',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error('Failed to parse LanguageTool response'));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });

    req.write(postData);
    req.end();
  });
}

async function runCheck() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('No active editor to check.');
    return;
  }

  const text = editor.document.getText();
  if (!text.trim()) {
    vscode.window.showInformationMessage('Document is empty.');
    return;
  }

  const config = vscode.workspace.getConfiguration('notepadplus');
  const language = config.get('grammar.language', 'en-US');

  statusBarItem.text = '$(sync~spin) Checking grammar...';
  statusBarItem.show();

  try {
    const result = await checkGrammar(text, language);
    currentMatches = result.matches || [];
    applyDecorations(editor);
    applyDiagnostics(editor.document);

    const count = currentMatches.length;
    statusBarItem.text = count === 0
      ? '$(check) No grammar issues'
      : `$(warning) ${count} grammar issue${count > 1 ? 's' : ''}`;

    if (count === 0) {
      vscode.window.showInformationMessage('No grammar or spelling issues found.');
    } else {
      vscode.window.showInformationMessage(
        `Found ${count} issue${count > 1 ? 's' : ''}. Check the Problems panel for details.`
      );
    }
  } catch (err) {
    statusBarItem.text = '$(error) Grammar check failed';
    vscode.window.showErrorMessage(`Grammar check failed: ${err.message}`);
  }
}

function applyDecorations(editor) {
  const errorRanges = [];
  const styleRanges = [];
  const typoRanges = [];

  for (const match of currentMatches) {
    const startPos = editor.document.positionAt(match.offset);
    const endPos = editor.document.positionAt(match.offset + match.length);
    const range = new vscode.Range(startPos, endPos);

    const topFix = match.replacements && match.replacements.length > 0
      ? match.replacements[0].value : null;

    const hoverMessage = new vscode.MarkdownString();
    hoverMessage.appendMarkdown(`**${match.message}**\n\n`);
    if (topFix) {
      hoverMessage.appendMarkdown(`Suggestion: \`${topFix}\``);
    }

    const decoration = { range, hoverMessage };
    const decoType = getDecorationType(match.rule);

    if (decoType === typoDecorationType) {
      typoRanges.push(decoration);
    } else if (decoType === styleDecorationType) {
      styleRanges.push(decoration);
    } else {
      errorRanges.push(decoration);
    }
  }

  editor.setDecorations(errorDecorationType, errorRanges);
  editor.setDecorations(styleDecorationType, styleRanges);
  editor.setDecorations(typoDecorationType, typoRanges);
}

function applyDiagnostics(document) {
  const diagnostics = [];

  for (const match of currentMatches) {
    const startPos = document.positionAt(match.offset);
    const endPos = document.positionAt(match.offset + match.length);
    const range = new vscode.Range(startPos, endPos);

    const cat = match.rule && match.rule.category ? match.rule.category.id : '';
    const severity = (cat === 'TYPOS' || cat === 'SPELLING')
      ? vscode.DiagnosticSeverity.Warning
      : (cat === 'STYLE' || cat === 'REDUNDANCY' || cat === 'TYPOGRAPHY')
        ? vscode.DiagnosticSeverity.Information
        : vscode.DiagnosticSeverity.Warning;

    const diagnostic = new vscode.Diagnostic(range, match.message, severity);
    diagnostic.source = 'NotepadPlus Grammar';

    if (match.replacements && match.replacements.length > 0) {
      diagnostic.message += ` (suggestion: ${match.replacements[0].value})`;
    }

    diagnostics.push(diagnostic);
  }

  diagnosticCollection.set(document.uri, diagnostics);
}

function clearGrammar() {
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    editor.setDecorations(errorDecorationType, []);
    editor.setDecorations(styleDecorationType, []);
    editor.setDecorations(typoDecorationType, []);
  }
  diagnosticCollection.clear();
  currentMatches = [];
  statusBarItem.text = '$(book) Grammar';
}

function activate(context) {
  diagnosticCollection = vscode.languages.createDiagnosticCollection('notepadplus-grammar');
  context.subscriptions.push(diagnosticCollection);

  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.text = '$(book) Grammar';
  statusBarItem.command = 'notepadplus.checkGrammar';
  statusBarItem.tooltip = 'Click to check grammar (LanguageTool)';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  context.subscriptions.push(
    vscode.commands.registerCommand('notepadplus.checkGrammar', runCheck),
    vscode.commands.registerCommand('notepadplus.clearGrammar', clearGrammar)
  );
}

module.exports = { activate };
