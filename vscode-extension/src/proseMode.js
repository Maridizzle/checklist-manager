const vscode = require('vscode');

let proseActive = false;
let originalSettings = {};

async function toggleProseMode() {
  const config = vscode.workspace.getConfiguration();

  if (!proseActive) {
    originalSettings = {
      wordWrap: config.get('editor.wordWrap'),
      lineNumbers: config.get('editor.lineNumbers'),
      minimap: config.get('editor.minimap.enabled'),
      renderWhitespace: config.get('editor.renderWhitespace'),
      glyphMargin: config.get('editor.glyphMargin'),
      folding: config.get('editor.folding'),
      lineDecorationsWidth: config.get('editor.lineDecorationsWidth'),
      fontSize: config.get('editor.fontSize'),
      padding: config.get('editor.padding.top'),
    };

    await config.update('editor.wordWrap', 'on', vscode.ConfigurationTarget.Workspace);
    await config.update('editor.lineNumbers', 'off', vscode.ConfigurationTarget.Workspace);
    await config.update('editor.minimap.enabled', false, vscode.ConfigurationTarget.Workspace);
    await config.update('editor.renderWhitespace', 'none', vscode.ConfigurationTarget.Workspace);
    await config.update('editor.glyphMargin', false, vscode.ConfigurationTarget.Workspace);
    await config.update('editor.folding', false, vscode.ConfigurationTarget.Workspace);
    await config.update('editor.lineDecorationsWidth', 0, vscode.ConfigurationTarget.Workspace);
    await config.update('editor.fontSize', (originalSettings.fontSize || 14) + 2, vscode.ConfigurationTarget.Workspace);
    await config.update('editor.padding.top', 20, vscode.ConfigurationTarget.Workspace);

    await vscode.commands.executeCommand('workbench.action.zenMode');

    proseActive = true;
    vscode.window.showInformationMessage('Prose mode ON. Press Ctrl+Shift+P again to exit.');
  } else {
    try {
      await vscode.commands.executeCommand('workbench.action.exitZenMode');
    } catch {
      // zen mode may not be active
    }

    await config.update('editor.wordWrap', originalSettings.wordWrap, vscode.ConfigurationTarget.Workspace);
    await config.update('editor.lineNumbers', originalSettings.lineNumbers, vscode.ConfigurationTarget.Workspace);
    await config.update('editor.minimap.enabled', originalSettings.minimap, vscode.ConfigurationTarget.Workspace);
    await config.update('editor.renderWhitespace', originalSettings.renderWhitespace, vscode.ConfigurationTarget.Workspace);
    await config.update('editor.glyphMargin', originalSettings.glyphMargin, vscode.ConfigurationTarget.Workspace);
    await config.update('editor.folding', originalSettings.folding, vscode.ConfigurationTarget.Workspace);
    await config.update('editor.lineDecorationsWidth', originalSettings.lineDecorationsWidth, vscode.ConfigurationTarget.Workspace);
    await config.update('editor.fontSize', originalSettings.fontSize, vscode.ConfigurationTarget.Workspace);
    await config.update('editor.padding.top', originalSettings.padding, vscode.ConfigurationTarget.Workspace);

    proseActive = false;
    vscode.window.showInformationMessage('Prose mode OFF. Editor settings restored.');
  }
}

function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand('notepadplus.toggleProseMode', toggleProseMode)
  );
}

module.exports = { activate };
