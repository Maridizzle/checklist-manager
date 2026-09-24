const vscode = require('vscode');

const PRESETS = [
  { label: 'One Dark', color: '#282c34' },
  { label: 'VS Dark', color: '#1e1e1e' },
  { label: 'Solarized Dark', color: '#002b36' },
  { label: 'Solarized Light', color: '#fdf6e3' },
  { label: 'White', color: '#ffffff' },
  { label: 'Beige', color: '#f5f5dc' },
  { label: 'Tokyo Night', color: '#1a1b26' },
  { label: 'GitHub Dark', color: '#0d1117' },
  { label: 'Nord', color: '#2e3440' },
  { label: 'Gruvbox Light', color: '#fbf1c7' },
];

async function setBackground() {
  const items = PRESETS.map(p => ({
    label: p.label,
    description: p.color,
  }));
  items.push({ label: 'Custom...', description: 'Enter a hex color' });
  items.push({ label: 'Reset', description: 'Remove custom background' });

  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: 'Choose an editor background color',
  });

  if (!picked) return;

  const config = vscode.workspace.getConfiguration();
  const colorCustomizations = config.get('workbench.colorCustomizations') || {};

  if (picked.label === 'Reset') {
    delete colorCustomizations['editor.background'];
    delete colorCustomizations['sideBar.background'];
    delete colorCustomizations['activityBar.background'];
    await config.update('workbench.colorCustomizations', colorCustomizations, vscode.ConfigurationTarget.Workspace);
    vscode.window.showInformationMessage('Background color reset to theme default.');
    return;
  }

  let color;
  if (picked.label === 'Custom...') {
    color = await vscode.window.showInputBox({
      placeHolder: '#282c34',
      prompt: 'Enter a hex color code',
      validateInput: (val) => {
        return /^#[0-9a-fA-F]{6}$/.test(val) ? null : 'Enter a valid hex color (e.g. #282c34)';
      },
    });
    if (!color) return;
  } else {
    color = picked.description;
  }

  colorCustomizations['editor.background'] = color;
  await config.update('workbench.colorCustomizations', colorCustomizations, vscode.ConfigurationTarget.Workspace);
  vscode.window.showInformationMessage(`Background set to ${picked.label === 'Custom...' ? color : picked.label}.`);
}

function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand('notepadplus.setBackground', setBackground)
  );
}

module.exports = { activate };
