const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

const WIKI_LINK_REGEX = /\[\[([^\]]+)\]\]/g;

const bracketDecorationType = vscode.window.createTextEditorDecorationType({
  color: '#888888',
  opacity: '0.6',
});

const linkDecorationType = vscode.window.createTextEditorDecorationType({
  color: '#4fc1ff',
  textDecoration: 'underline',
  cursor: 'pointer',
});

function updateDecorations(editor) {
  if (!editor) return;

  const config = vscode.workspace.getConfiguration('notepadplus');
  if (!config.get('wikiLinks.enabled', true)) return;

  const text = editor.document.getText();
  const bracketRanges = [];
  const linkRanges = [];
  let match;

  WIKI_LINK_REGEX.lastIndex = 0;
  while ((match = WIKI_LINK_REGEX.exec(text)) !== null) {
    const startPos = editor.document.positionAt(match.index);
    const openBracketEnd = editor.document.positionAt(match.index + 2);
    const linkStart = openBracketEnd;
    const linkEnd = editor.document.positionAt(match.index + 2 + match[1].length);
    const closeBracketEnd = editor.document.positionAt(match.index + match[0].length);

    bracketRanges.push(new vscode.Range(startPos, openBracketEnd));
    bracketRanges.push(new vscode.Range(linkEnd, closeBracketEnd));
    linkRanges.push(new vscode.Range(linkStart, linkEnd));
  }

  editor.setDecorations(bracketDecorationType, bracketRanges);
  editor.setDecorations(linkDecorationType, linkRanges);
}

class WikiLinkProvider {
  provideDocumentLinks(document) {
    const config = vscode.workspace.getConfiguration('notepadplus');
    if (!config.get('wikiLinks.enabled', true)) return [];

    const text = document.getText();
    const links = [];
    let match;

    WIKI_LINK_REGEX.lastIndex = 0;
    while ((match = WIKI_LINK_REGEX.exec(text)) !== null) {
      const linkText = match[1];
      const startPos = document.positionAt(match.index + 2);
      const endPos = document.positionAt(match.index + 2 + linkText.length);
      const range = new vscode.Range(startPos, endPos);

      const link = new vscode.DocumentLink(range);
      link._linkText = linkText;
      links.push(link);
    }

    return links;
  }

  async resolveDocumentLink(link) {
    const linkText = link._linkText;
    if (!linkText) return link;

    const resolved = await resolveWikiLink(linkText);
    if (resolved) {
      link.target = vscode.Uri.file(resolved);
    }
    return link;
  }
}

async function resolveWikiLink(linkText) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return null;

  const config = vscode.workspace.getConfiguration('notepadplus');
  const extensions = config.get('wikiLinks.extensions', ['.txt', '.md', '.html', '.js', '.py', '.json', '.ts']);

  const currentDir = path.dirname(editor.document.uri.fsPath);
  const workspaceFolders = vscode.workspace.workspaceFolders;

  const searchDirs = [currentDir];
  if (workspaceFolders) {
    for (const folder of workspaceFolders) {
      if (!searchDirs.includes(folder.uri.fsPath)) {
        searchDirs.push(folder.uri.fsPath);
      }
    }
  }

  for (const dir of searchDirs) {
    const directPath = path.join(dir, linkText);
    if (fs.existsSync(directPath)) return directPath;

    for (const ext of extensions) {
      const withExt = path.join(dir, linkText + ext);
      if (fs.existsSync(withExt)) return withExt;
    }
  }

  if (workspaceFolders) {
    for (const folder of workspaceFolders) {
      const found = await searchRecursive(folder.uri.fsPath, linkText, extensions, 0);
      if (found) return found;
    }
  }

  return null;
}

async function searchRecursive(dirPath, linkText, extensions, depth) {
  if (depth > 4) return null;

  let entries;
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return null;
  }

  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

    if (!entry.isDirectory()) {
      const nameNoExt = entry.name.replace(/\.[^.]+$/, '');
      if (nameNoExt.toLowerCase() === linkText.toLowerCase() ||
          entry.name.toLowerCase() === linkText.toLowerCase()) {
        return path.join(dirPath, entry.name);
      }
    }
  }

  for (const entry of entries) {
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
      const found = await searchRecursive(path.join(dirPath, entry.name), linkText, extensions, depth + 1);
      if (found) return found;
    }
  }

  return null;
}

function activate(context) {
  const linkProvider = new WikiLinkProvider();
  context.subscriptions.push(
    vscode.languages.registerDocumentLinkProvider({ scheme: 'file' }, linkProvider)
  );

  const updateActive = () => {
    const editor = vscode.window.activeTextEditor;
    if (editor) updateDecorations(editor);
  };

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(updateActive),
    vscode.workspace.onDidChangeTextDocument((e) => {
      const editor = vscode.window.activeTextEditor;
      if (editor && e.document === editor.document) {
        updateDecorations(editor);
      }
    })
  );

  updateActive();
}

module.exports = { activate };
