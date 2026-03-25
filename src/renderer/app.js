const COLORS = ['#00a884', '#53bdeb', '#d97706', '#8b5cf6', '#ec4899', '#ef4444', '#06b6d4', '#84cc16'];

const SIDEBAR_HIDE_CSS = `
  /* Hide the entire left sidebar panel (class _aigw contains header + chat list) */
  div._aigw { display: none !important; }
  div[class*="_aigw"] { display: none !important; }
  /* Also target by id and common selectors */
  #side { display: none !important; }
  #pane-side { display: none !important; }
  div[data-testid="chat-list"] { display: none !important; }
  /* Make the right/conversation panel take full width */
  div._aigv > div:last-child,
  div[class*="_aigv"] > div:last-child {
    flex: 1 !important;
    max-width: 100% !important;
    width: 100% !important;
  }
`;

// ── State ───────────────────────────────────────────────────

let accounts = [];
let activeAccountId = null;
let sidebarHidden = false;
let tabPosition = 'top';
let config = null;

// ── DOM refs ────────────────────────────────────────────────

const tabsEl = document.getElementById('tabs');
const leftTabsEl = document.getElementById('leftTabs');
const container = document.getElementById('webviewContainer');
const statusBar = document.getElementById('statusBar');

// ── Helpers ─────────────────────────────────────────────────

function getInitials(name) {
  return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
}

// ── Persistence ─────────────────────────────────────────────

function saveAccounts() {
  const data = accounts.map(a => ({ id: a.id, name: a.name, partition: a.partition }));
  localStorage.setItem('wapp-accounts', JSON.stringify(data));
  localStorage.setItem('wapp-active', activeAccountId);
  localStorage.setItem('wapp-tab-position', tabPosition);
}

function loadSavedAccounts() {
  try {
    return JSON.parse(localStorage.getItem('wapp-accounts')) || [];
  } catch {
    return [];
  }
}

// ── Account Management ──────────────────────────────────────

async function createAccount(name, existingId, existingPartition) {
  if (!config) config = await window.wapp.getConfig();

  const id = existingId || `account-${Date.now()}`;
  const partition = existingPartition || `persist:whatsapp-${id}`;

  await window.wapp.setupSession(partition);

  const webview = document.createElement('webview');
  webview.setAttribute('src', config.whatsappUrl);
  webview.setAttribute('partition', partition);
  webview.setAttribute('useragent', config.userAgent);
  webview.setAttribute('id', `wv-${id}`);

  webview.addEventListener('did-finish-load', () => {
    if (sidebarHidden) injectSidebarCSS(webview, true);
  });

  // Block ⌘R / Ctrl+R from refreshing the webview
  webview.addEventListener('before-input-event', (_event, input) => {
    if ((input.meta || input.control) && input.key.toLowerCase() === 'r') {
      _event.preventDefault();
    }
  });

  container.appendChild(webview);

  const account = { id, name: name || `Account ${accounts.length + 1}`, partition, webview };
  accounts.push(account);
  switchTo(id);
  saveAccounts();
  updateStatusBar();
  return account;
}

function switchTo(id) {
  activeAccountId = id;
  accounts.forEach(acc => {
    acc.webview.classList.toggle('active', acc.id === id);
  });
  renderTabs();
  saveAccounts();
  updateStatusBar();
}

function removeAccount(id) {
  const idx = accounts.findIndex(a => a.id === id);
  if (idx === -1) return;

  const acc = accounts[idx];
  acc.webview.remove();
  window.wapp.clearSession(acc.partition);
  accounts.splice(idx, 1);

  if (accounts.length > 0) {
    switchTo(accounts[Math.max(0, idx - 1)].id);
  } else {
    activeAccountId = null;
    renderTabs();
  }
  saveAccounts();
  updateStatusBar();
}

// ── Tab Rendering ───────────────────────────────────────────

function renderTabs() {
  renderTopTabs();
  renderLeftTabs();
}

function renderTopTabs() {
  tabsEl.innerHTML = '';
  accounts.forEach((acc, idx) => {
    const tab = document.createElement('div');
    tab.className = `tab${acc.id === activeAccountId ? ' active' : ''}`;
    tab.innerHTML = `
      <span class="tab-dot" style="background:${COLORS[idx % COLORS.length]}"></span>
      <span>${acc.name}</span>
      <button class="tab-close">✕</button>
    `;
    tab.addEventListener('click', (e) => {
      if (!e.target.classList.contains('tab-close')) switchTo(acc.id);
    });
    tab.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showAccountMenu(acc.id);
    });
    tab.querySelector('.tab-close').addEventListener('click', (e) => {
      e.stopPropagation();
      removeAccount(acc.id);
    });
    tabsEl.appendChild(tab);
  });
}

function renderLeftTabs() {
  leftTabsEl.innerHTML = '';
  accounts.forEach((acc, idx) => {
    const tab = document.createElement('div');
    tab.className = `left-tab${acc.id === activeAccountId ? ' active' : ''}`;
    tab.setAttribute('data-tooltip', acc.name);
    tab.innerHTML = `<span class="left-tab-dot" style="background:${COLORS[idx % COLORS.length]}">${getInitials(acc.name)}</span>`;
    tab.addEventListener('click', () => switchTo(acc.id));
    tab.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showAccountMenu(acc.id);
    });
    leftTabsEl.appendChild(tab);
  });
}

// ── Native Menu Actions ─────────────────────────────────────

async function showAccountMenu(accountId) {
  const action = await window.wapp.showAccountMenu();
  const acc = accounts.find(a => a.id === accountId);
  if (!acc || !action) return;

  if (action === 'rename') {
    const newName = prompt('Rename account:', acc.name);
    if (newName && newName.trim()) {
      acc.name = newName.trim();
      renderTabs();
      saveAccounts();
    }
  } else if (action === 'reload') {
    acc.webview.reload();
  } else if (action === 'remove') {
    removeAccount(accountId);
  }
}

async function openSettings() {
  const result = await window.wapp.showSettingsMenu();
  if (result === 'top' || result === 'left') {
    tabPosition = result;
    document.body.className = `layout-${tabPosition}`;
    saveAccounts();
  }
}

// ── Sidebar Toggle ──────────────────────────────────────────

function toggleSidebar() {
  sidebarHidden = !sidebarHidden;
  accounts.forEach(acc => injectSidebarCSS(acc.webview, sidebarHidden));
  updateSidebarButtons();
  updateStatusBar();
}

async function injectSidebarCSS(webview, hide) {
  try {
    if (hide) {
      const key = await webview.insertCSS(SIDEBAR_HIDE_CSS);
      webview._sidebarCSSKey = key;
    } else if (webview._sidebarCSSKey) {
      await webview.removeInsertedCSS(webview._sidebarCSSKey);
      webview._sidebarCSSKey = null;
    }
  } catch {
    // Webview not ready yet — will be applied on did-finish-load
  }
}

function updateSidebarButtons() {
  document.getElementById('sidebarToggle').classList.toggle('active', sidebarHidden);
  document.getElementById('sidebarToggleLeft').classList.toggle('active', sidebarHidden);
}

// ── Status Bar ──────────────────────────────────────────────

function updateStatusBar() {
  const activeAcc = accounts.find(a => a.id === activeAccountId);
  const accName = activeAcc ? activeAcc.name : 'No account';
  const accCount = accounts.length;
  const sidebarState = sidebarHidden ? 'Hidden' : 'Visible';

  statusBar.innerHTML = `
    <div class="status-left">
      <span class="status-item">${accName}</span>
      <span class="status-sep">|</span>
      <span class="status-item">${accCount} account${accCount !== 1 ? 's' : ''}</span>
    </div>
    <div class="status-right">
      <span class="status-item status-clickable" id="statusSidebarToggle">
        <kbd>⌘B</kbd> Sidebar ${sidebarState}
      </span>
    </div>
  `;

  document.getElementById('statusSidebarToggle').addEventListener('click', toggleSidebar);
}

// ── Event Listeners ─────────────────────────────────────────

document.getElementById('settingsToggle').addEventListener('click', openSettings);
document.getElementById('settingsToggleLeft').addEventListener('click', openSettings);
document.getElementById('addAccount').addEventListener('click', () => createAccount());
document.getElementById('addAccountLeft').addEventListener('click', () => createAccount());
document.getElementById('sidebarToggle').addEventListener('click', toggleSidebar);
document.getElementById('sidebarToggleLeft').addEventListener('click', toggleSidebar);

// ── IPC from Main Process ───────────────────────────────────

window.wapp.onToggleSidebar(() => toggleSidebar());
window.wapp.onTabPositionChanged((pos) => {
  tabPosition = pos;
  document.body.className = `layout-${tabPosition}`;
  saveAccounts();
});

// ── Init ────────────────────────────────────────────────────

async function init() {
  config = await window.wapp.getConfig();

  // Restore saved tab position
  const savedPosition = localStorage.getItem('wapp-tab-position');
  if (savedPosition === 'left' || savedPosition === 'top') {
    tabPosition = savedPosition;
    document.body.className = `layout-${tabPosition}`;
  }

  // Restore saved accounts (reuse same partitions for session persistence)
  const saved = loadSavedAccounts();
  if (saved.length > 0) {
    const savedActive = localStorage.getItem('wapp-active');
    for (const acc of saved) {
      await createAccount(acc.name, acc.id, acc.partition);
    }
    // Restore active tab
    if (savedActive && accounts.find(a => a.id === savedActive)) {
      switchTo(savedActive);
    }
  } else {
    // First launch — create default account
    await createAccount('Account 1');
  }

  updateStatusBar();
}

init();
