import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightSpecialChars, drawSelection, dropCursor, rectangularSelection, crosshairCursor, highlightActiveLine } from '@codemirror/view';
import { EditorState, Compartment } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { foldGutter, indentOnInput, syntaxHighlighting, defaultHighlightStyle, bracketMatching, foldKeymap } from '@codemirror/language';
import { oneDark } from '@codemirror/theme-one-dark';

import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { python } from '@codemirror/lang-python';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { xml } from '@codemirror/lang-xml';
import { cpp } from '@codemirror/lang-cpp';
import { java } from '@codemirror/lang-java';
import { php } from '@codemirror/lang-php';
import { rust } from '@codemirror/lang-rust';
import { sql } from '@codemirror/lang-sql';

const LANGUAGES = {
  '.js': { name: 'JavaScript', ext: javascript },
  '.mjs': { name: 'JavaScript', ext: javascript },
  '.jsx': { name: 'JSX', ext: () => javascript({ jsx: true }) },
  '.ts': { name: 'TypeScript', ext: () => javascript({ typescript: true }) },
  '.tsx': { name: 'TSX', ext: () => javascript({ typescript: true, jsx: true }) },
  '.html': { name: 'HTML', ext: html },
  '.htm': { name: 'HTML', ext: html },
  '.css': { name: 'CSS', ext: css },
  '.py': { name: 'Python', ext: python },
  '.json': { name: 'JSON', ext: json },
  '.md': { name: 'Markdown', ext: markdown },
  '.markdown': { name: 'Markdown', ext: markdown },
  '.xml': { name: 'XML', ext: xml },
  '.svg': { name: 'XML', ext: xml },
  '.c': { name: 'C', ext: cpp },
  '.cpp': { name: 'C++', ext: cpp },
  '.h': { name: 'C/C++ Header', ext: cpp },
  '.hpp': { name: 'C++ Header', ext: cpp },
  '.java': { name: 'Java', ext: java },
  '.php': { name: 'PHP', ext: php },
  '.rs': { name: 'Rust', ext: rust },
  '.sql': { name: 'SQL', ext: sql },
  '.txt': { name: 'Plain Text', ext: null },
  '.log': { name: 'Plain Text', ext: null },
  '.ini': { name: 'Plain Text', ext: null },
  '.cfg': { name: 'Plain Text', ext: null },
};

const languageCompartment = new Compartment();
const wrapCompartment = new Compartment();

let tabs = [];
let activeTabId = null;
let tabCounter = 0;
let editorView = null;
let fontSize = 14;
let currentFolderPath = null;

function getFileExtension(filePath) {
  if (!filePath) return '';
  const dot = filePath.lastIndexOf('.');
  return dot >= 0 ? filePath.substring(dot).toLowerCase() : '';
}

function getFileName(filePath) {
  if (!filePath) return 'Untitled';
  return filePath.replace(/\\/g, '/').split('/').pop();
}

function getLanguageForFile(filePath) {
  const ext = getFileExtension(filePath);
  return LANGUAGES[ext] || { name: 'Plain Text', ext: null };
}

function getLanguageExtension(filePath) {
  const lang = getLanguageForFile(filePath);
  if (!lang.ext) return [];
  const ext = typeof lang.ext === 'function' ? lang.ext() : lang.ext();
  return [ext];
}

function createTab(filePath, content) {
  const id = ++tabCounter;
  const tab = {
    id,
    filePath,
    content: content || '',
    savedContent: content || '',
    modified: false,
    scrollPos: null,
    cursorPos: 0,
  };
  tabs.push(tab);
  renderTabs();
  switchToTab(id);
  return tab;
}

function getActiveTab() {
  return tabs.find(t => t.id === activeTabId);
}

function switchToTab(id) {
  const currentTab = getActiveTab();
  if (currentTab && editorView) {
    currentTab.content = editorView.state.doc.toString();
    currentTab.scrollPos = editorView.scrollDOM.scrollTop;
    currentTab.cursorPos = editorView.state.selection.main.head;
  }

  activeTabId = id;
  const tab = getActiveTab();
  if (!tab) return;

  const langExt = getLanguageExtension(tab.filePath);
  editorView.dispatch({
    changes: { from: 0, to: editorView.state.doc.length, insert: tab.content },
  });

  editorView.dispatch({
    effects: languageCompartment.reconfigure(langExt),
  });

  if (tab.scrollPos !== null) {
    editorView.scrollDOM.scrollTop = tab.scrollPos;
  }

  try {
    const pos = Math.min(tab.cursorPos, editorView.state.doc.length);
    editorView.dispatch({
      selection: { anchor: pos },
    });
  } catch (e) {
    // ignore position errors
  }

  editorView.focus();
  updateStatusBar();
  renderTabs();
}

function closeTab(id) {
  const idx = tabs.findIndex(t => t.id === id);
  if (idx < 0) return;

  tabs.splice(idx, 1);

  if (tabs.length === 0) {
    createTab(null, '');
    return;
  }

  if (activeTabId === id) {
    const newIdx = Math.min(idx, tabs.length - 1);
    switchToTab(tabs[newIdx].id);
  } else {
    renderTabs();
  }
}

function renderTabs() {
  const container = document.getElementById('tabs-container');
  container.innerHTML = '';

  for (const tab of tabs) {
    const el = document.createElement('div');
    el.className = 'tab' + (tab.id === activeTabId ? ' active' : '') + (tab.modified ? ' modified' : '');
    el.dataset.id = tab.id;

    const name = document.createElement('span');
    name.className = 'tab-name';
    name.textContent = getFileName(tab.filePath);

    const modified = document.createElement('span');
    modified.className = 'tab-modified';

    const close = document.createElement('span');
    close.className = 'tab-close';
    close.textContent = '×';
    close.addEventListener('click', (e) => {
      e.stopPropagation();
      closeTab(tab.id);
    });

    el.appendChild(name);
    el.appendChild(modified);
    el.appendChild(close);

    el.addEventListener('click', () => switchToTab(tab.id));
    container.appendChild(el);
  }
}

function updateStatusBar() {
  const tab = getActiveTab();
  if (!tab) return;

  document.getElementById('status-file').textContent = tab.filePath || 'Untitled';
  document.getElementById('status-modified').textContent = tab.modified ? '(Modified)' : '';

  const lang = getLanguageForFile(tab.filePath);
  document.getElementById('status-lang').textContent = lang.name;
  document.getElementById('status-encoding').textContent = 'UTF-8';

  if (editorView) {
    const pos = editorView.state.selection.main.head;
    const line = editorView.state.doc.lineAt(pos);
    const col = pos - line.from + 1;
    document.getElementById('status-position').textContent = `Ln ${line.number}, Col ${col}`;
  }
}

function markModified() {
  const tab = getActiveTab();
  if (!tab) return;
  const currentContent = editorView.state.doc.toString();
  tab.content = currentContent;
  tab.modified = currentContent !== tab.savedContent;
  renderTabs();
  updateStatusBar();
}

async function saveCurrentFile() {
  const tab = getActiveTab();
  if (!tab) return;

  const content = editorView.state.doc.toString();

  if (!tab.filePath) {
    await saveCurrentFileAs();
    return;
  }

  const result = await window.electronAPI.saveFile({ filePath: tab.filePath, content });
  if (result.success) {
    tab.savedContent = content;
    tab.modified = false;
    renderTabs();
    updateStatusBar();
  }
}

async function saveCurrentFileAs() {
  const tab = getActiveTab();
  if (!tab) return;

  const content = editorView.state.doc.toString();
  const result = await window.electronAPI.saveAs({
    content,
    defaultPath: tab.filePath || 'untitled.txt',
  });

  if (result.success) {
    tab.filePath = result.filePath;
    tab.savedContent = content;
    tab.modified = false;
    renderTabs();
    updateStatusBar();
  }
}

function setFontSize(size) {
  fontSize = Math.max(8, Math.min(40, size));
  document.querySelector('.cm-editor').style.fontSize = fontSize + 'px';
}

function initEditor() {
  const editorEl = document.getElementById('editor');

  const state = EditorState.create({
    doc: '',
    extensions: [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightSpecialChars(),
      history(),
      foldGutter(),
      drawSelection(),
      dropCursor(),
      EditorState.allowMultipleSelections.of(true),
      indentOnInput(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      bracketMatching(),
      closeBrackets(),
      autocompletion(),
      rectangularSelection(),
      crosshairCursor(),
      highlightActiveLine(),
      highlightSelectionMatches(),
      languageCompartment.of([]),
      wrapCompartment.of([]),
      oneDark,
      keymap.of([
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...searchKeymap,
        ...historyKeymap,
        ...foldKeymap,
        ...completionKeymap,
        indentWithTab,
      ]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          markModified();
        }
        if (update.selectionSet || update.docChanged) {
          updateStatusBar();
        }
      }),
    ],
  });

  editorView = new EditorView({
    state,
    parent: editorEl,
  });

  createTab(null, '');
}

async function openFileFromPath(filePath) {
  const existing = tabs.find(t => t.filePath === filePath);
  if (existing) {
    switchToTab(existing.id);
    return;
  }

  if (window.electronAPI) {
    const result = await window.electronAPI.readFile({ filePath });
    if (result.success) {
      await window.electronAPI.trackRecentFile({ filePath });
      createTab(filePath, result.content);
    }
  }
}

async function loadFolderTree(folderPath) {
  currentFolderPath = folderPath;
  const container = document.getElementById('file-tree-content');
  container.innerHTML = '';

  const rootLabel = folderPath.replace(/\\/g, '/').split('/').pop();
  const rootDiv = document.createElement('div');
  rootDiv.className = 'tree-item';
  rootDiv.style.paddingLeft = '4px';
  rootDiv.style.fontWeight = '600';
  rootDiv.innerHTML = `<span class="tree-icon folder">&#9660;</span><span class="tree-label">${rootLabel}</span>`;
  container.appendChild(rootDiv);

  const childrenDiv = document.createElement('div');
  childrenDiv.className = 'tree-children expanded';
  container.appendChild(childrenDiv);

  await populateTreeLevel(childrenDiv, folderPath, 1);

  rootDiv.addEventListener('click', () => {
    const isExpanded = childrenDiv.classList.contains('expanded');
    childrenDiv.classList.toggle('expanded');
    rootDiv.querySelector('.tree-icon').innerHTML = isExpanded ? '&#9654;' : '&#9660;';
  });
}

async function populateTreeLevel(parentEl, dirPath, depth) {
  if (!window.electronAPI) return;

  const result = await window.electronAPI.readDirectory({ dirPath });
  if (!result.success) return;

  for (const item of result.items) {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'tree-item';
    itemDiv.style.paddingLeft = (depth * 16 + 4) + 'px';

    if (item.isDirectory) {
      itemDiv.innerHTML = `<span class="tree-icon folder">&#9654;</span><span class="tree-label">${item.name}</span>`;

      const childrenDiv = document.createElement('div');
      childrenDiv.className = 'tree-children';
      let loaded = false;

      itemDiv.addEventListener('click', async () => {
        const isExpanded = childrenDiv.classList.contains('expanded');
        if (!loaded && !isExpanded) {
          await populateTreeLevel(childrenDiv, item.path, depth + 1);
          loaded = true;
        }
        childrenDiv.classList.toggle('expanded');
        itemDiv.querySelector('.tree-icon').innerHTML = isExpanded ? '&#9654;' : '&#9660;';
      });

      parentEl.appendChild(itemDiv);
      parentEl.appendChild(childrenDiv);
    } else {
      itemDiv.innerHTML = `<span class="tree-icon file">&#9679;</span><span class="tree-label">${item.name}</span>`;
      itemDiv.addEventListener('click', () => openFileFromPath(item.path));
      parentEl.appendChild(itemDiv);
    }
  }
}

async function loadRecentFiles() {
  if (!window.electronAPI) return;

  const container = document.getElementById('recent-files-content');
  const files = await window.electronAPI.getRecentFiles();

  if (!files || files.length === 0) {
    container.innerHTML = '<div class="sidebar-placeholder">No recent files</div>';
    return;
  }

  container.innerHTML = '';
  for (const filePath of files) {
    const item = document.createElement('div');
    item.className = 'recent-item';

    const name = filePath.replace(/\\/g, '/').split('/').pop();
    const dir = filePath.replace(/\\/g, '/').split('/').slice(0, -1).join('/');

    item.innerHTML = `<span class="recent-name">${name}</span><span class="recent-path">${dir}</span>`;
    item.addEventListener('click', () => openFileFromPath(filePath));
    container.appendChild(item);
  }
}

function initSidebarTabs() {
  const tabBtns = document.querySelectorAll('.sidebar-tab');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.sidebar-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.panel).classList.add('active');

      if (btn.dataset.panel === 'recent-files') {
        loadRecentFiles();
      }
    });
  });
}

function initSidebarResize() {
  const handle = document.getElementById('sidebar-resize-handle');
  const sidebar = document.getElementById('sidebar');
  let startX, startWidth;

  handle.addEventListener('mousedown', (e) => {
    startX = e.clientX;
    startWidth = sidebar.offsetWidth;
    handle.classList.add('dragging');
    document.body.classList.add('dragging-sidebar');

    const onMouseMove = (e) => {
      const newWidth = startWidth + (e.clientX - startX);
      sidebar.style.width = Math.max(150, Math.min(500, newWidth)) + 'px';
    };

    const onMouseUp = () => {
      handle.classList.remove('dragging');
      document.body.classList.remove('dragging-sidebar');
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });
}

function initDragAndDrop() {
  const editorArea = document.getElementById('editor-area');

  document.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });

  document.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.dataTransfer.files.length > 0) {
      for (const file of e.dataTransfer.files) {
        if (file.path) {
          openFileFromPath(file.path);
        }
      }
    }
  });
}

function wireEvents() {
  document.getElementById('btn-new').addEventListener('click', () => createTab(null, ''));
  document.getElementById('btn-open').addEventListener('click', () => window.electronAPI.openFile());
  document.getElementById('btn-save').addEventListener('click', () => saveCurrentFile());
  document.getElementById('btn-save-as').addEventListener('click', () => saveCurrentFileAs());

  let wordWrap = false;
  const toggleWrap = () => {
    wordWrap = !wordWrap;
    editorView.dispatch({
      effects: wrapCompartment.reconfigure(wordWrap ? EditorView.lineWrapping : []),
    });
  };
  document.getElementById('btn-wrap').addEventListener('click', toggleWrap);

  document.getElementById('btn-zoom-in').addEventListener('click', () => setFontSize(fontSize + 2));
  document.getElementById('btn-zoom-out').addEventListener('click', () => setFontSize(fontSize - 2));

  document.getElementById('btn-open-folder').addEventListener('click', () => {
    if (window.electronAPI) window.electronAPI.openFolder();
  });

  if (window.electronAPI) {
    window.electronAPI.onFileOpened(({ filePath, content }) => {
      const existing = tabs.find(t => t.filePath === filePath);
      if (existing) {
        switchToTab(existing.id);
        return;
      }
      createTab(filePath, content);
    });

    window.electronAPI.onFolderOpened(({ folderPath }) => {
      loadFolderTree(folderPath);
    });

    window.electronAPI.onMenuNew(() => createTab(null, ''));
    window.electronAPI.onMenuSave(() => saveCurrentFile());
    window.electronAPI.onMenuSaveAs(() => saveCurrentFileAs());
    window.electronAPI.onMenuToggleWrap(toggleWrap);
    window.electronAPI.onMenuZoomIn(() => setFontSize(fontSize + 2));
    window.electronAPI.onMenuZoomOut(() => setFontSize(fontSize - 2));
    window.electronAPI.onMenuZoomReset(() => setFontSize(14));
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initEditor();
  wireEvents();
  initSidebarTabs();
  initSidebarResize();
  initDragAndDrop();
  loadRecentFiles();
});
