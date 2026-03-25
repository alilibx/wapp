const COLORS = ['#00a884', '#53bdeb', '#d97706', '#8b5cf6', '#ec4899', '#ef4444', '#06b6d4', '#84cc16'];

const SIDEBAR_HIDE_CSS = `
  #pane-side { display: none !important; }
  div[data-testid="chat-list"] { display: none !important; }
  ._akbu { display: none !important; }
  div._aigv > div:first-child { display: none !important; }
  div._aigv > div:last-child { flex: 1 !important; max-width: 100% !important; }
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

// ── Helpers ─────────────────────────────────────────────────

function getInitials(name) {
  return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
}

// ── Account Management ──────────────────────────────────────

async function createAccount(name) {
  if (!config) config = await window.wapp.getConfig();

  const id = `account-${Date.now()}`;
  const partition = `persist:whatsapp-${id}`;

  await window.wapp.setupSession(partition);

  const webview = document.createElement('webview');
  webview.setAttribute('src', config.whatsappUrl);
  webview.setAttribute('partition', partition);
  webview.setAttribute('useragent', config.userAgent);
  webview.setAttribute('id', `wv-${id}`);

  webview.addEventListener('did-finish-load', () => {
    if (sidebarHidden) injectSidebarCSS(webview, true);
  });

  container.appendChild(webview);

  const account = { id, name: name || `Account ${accounts.length + 1}`, partition, webview };
  accounts.push(account);
  switchTo(id);
  return account;
}

function switchTo(id) {
  activeAccountId = id;
  accounts.forEach(acc => {
    acc.webview.classList.toggle('active', acc.id === id);
  });
  renderTabs();
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
  }
}

// ── Sidebar Toggle ──────────────────────────────────────────

function toggleSidebar() {
  sidebarHidden = !sidebarHidden;
  accounts.forEach(acc => injectSidebarCSS(acc.webview, sidebarHidden));
  updateSidebarButtons();
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
});

// ── Init ────────────────────────────────────────────────────

createAccount('Account 1');
