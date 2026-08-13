/**
 * NomadTools — Modal & Panel Controllers
 */

import { state, saveState } from './app.js';
import * as api from './api.js';
import { renderPlayerList, showToast } from './ui.js';
import { generateId } from './utils.js';

// ─── Helper: Create folder slug from server name ─────────────────────────────
function slugify(name) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'server';
}

function getDefaultProfileCachePath(serverName) {
  const baseDir = state.config?.settings?.globalCacheDir || 'D:\\NomadTools\\ServerCaches';
  const slug = slugify(serverName || 'server');
  return `${baseDir}\\${slug}`;
}

// ─── Overlay ─────────────────────────────────────────────────────────────────

const overlay = document.getElementById('overlay');

function showOverlay(onClick) {
  overlay.classList.add('visible');
  overlay._clickHandler = onClick;
  overlay.addEventListener('click', onClick, { once: true });
}

function hideOverlay() {
  overlay.classList.remove('visible');
  if (overlay._clickHandler) {
    overlay.removeEventListener('click', overlay._clickHandler);
    overlay._clickHandler = null;
  }
}

// ─── Add / Edit Server Modal ──────────────────────────────────────────────────

let editingProfileId = null;
let isCustomPathSelected = false;

export function openAddEditModal(profile = null) {
  editingProfileId = profile ? profile.id : null;
  isCustomPathSelected = false;

  const modal = document.getElementById('add-edit-modal');
  const titleEl = document.getElementById('modal-title');
  const nameInput = document.getElementById('field-server-name');
  const codeInput = document.getElementById('field-join-code');
  const pathInput = document.getElementById('field-cache-path');
  const saveBtn = document.getElementById('btn-modal-save');

  // Populate or clear fields
  if (profile) {
    titleEl.textContent = 'Edit Server';
    nameInput.value = profile.name || '';
    codeInput.value = profile.joinCode || '';
    pathInput.value = profile.cachePath || getDefaultProfileCachePath(profile.name);
    saveBtn.textContent = 'Simpan Perubahan';
    isCustomPathSelected = true;
  } else {
    titleEl.textContent = 'Tambah Server Baru';
    nameInput.value = '';
    codeInput.value = '';
    pathInput.value = getDefaultProfileCachePath('');
    saveBtn.textContent = 'Tambah Server';
  }

  // Live update cachePath when typing server name if not manually browsed
  const onNameInput = () => {
    if (!editingProfileId && !isCustomPathSelected) {
      pathInput.value = getDefaultProfileCachePath(nameInput.value);
    }
  };
  nameInput.removeEventListener('input', onNameInput);
  nameInput.addEventListener('input', onNameInput);

  // Clear error states
  clearFieldErrors();

  modal.classList.add('visible');
  showOverlay(() => closeAddEditModal());

  // Focus first field
  setTimeout(() => nameInput.focus(), 50);
}

export function closeAddEditModal() {
  const modal = document.getElementById('add-edit-modal');
  modal.classList.remove('visible');
  hideOverlay();
  editingProfileId = null;
  isCustomPathSelected = false;
}

// Browse folder for cache path
document.getElementById('btn-browse-cache')?.addEventListener('click', async () => {
  const folder = await api.pickFolder();
  if (folder) {
    document.getElementById('field-cache-path').value = folder;
    isCustomPathSelected = true;
  }
});

function sanitizeJoinCode(input) {
  let s = (input || '').trim();
  if (s.includes('/')) {
    s = s.substring(s.lastIndexOf('/') + 1);
  }
  if (s.includes('?')) {
    s = s.substring(0, s.indexOf('?'));
  }
  return s.trim();
}

// Save handler
document.getElementById('btn-modal-save')?.addEventListener('click', async () => {
  const name = document.getElementById('field-server-name').value.trim();
  const rawJoinCode = document.getElementById('field-join-code').value.trim();
  const joinCode = sanitizeJoinCode(rawJoinCode);
  let cachePath = document.getElementById('field-cache-path').value.trim();

  // Validation
  let valid = true;
  clearFieldErrors();

  if (!name) {
    setFieldError('field-server-name', 'Nama server wajib diisi');
    valid = false;
  }
  if (!joinCode) {
    setFieldError('field-join-code', 'Join code wajib diisi');
    valid = false;
  }
  if (!cachePath) {
    cachePath = getDefaultProfileCachePath(name);
  }
  if (!valid) return;

  if (editingProfileId) {
    // Edit existing
    const idx = state.config.servers.findIndex(s => s.id === editingProfileId);
    if (idx !== -1) {
      const old = state.config.servers[idx];
      state.config.servers[idx] = { ...old, name, joinCode, cachePath };
    }
  } else {
    // Add new
    state.config.servers.push({
      id: generateId(),
      name,
      joinCode,
      cachePath,
      lastPlayed: null,
    });
  }

  await saveState();
  closeAddEditModal();

  // Clear endpoint cache since join code might have changed
  await api.clearEndpointCache();

  // Trigger a refresh of the new/updated server
  const { refreshAllServers } = await import('./app.js');
  refreshAllServers();

  showToast(editingProfileId ? `Server diperbarui.` : `Server '${name}' ditambahkan.`, 'success');
});

// Cancel handler
document.getElementById('btn-modal-cancel')?.addEventListener('click', closeAddEditModal);

function clearFieldErrors() {
  document.querySelectorAll('.field-error').forEach(el => el.remove());
  document.querySelectorAll('.form-input.error').forEach(el => el.classList.remove('error'));
}

function setFieldError(fieldId, msg) {
  const field = document.getElementById(fieldId);
  if (!field) return;
  field.classList.add('error');
  const err = document.createElement('span');
  err.className = 'field-error';
  err.style.cssText = 'color: #f43f5e; font-size: 11px; margin-top: 3px;';
  err.textContent = msg;
  field.parentNode.insertAdjacentElement('afterend', err);
}

// ─── FiveM Running Warning Modal ──────────────────────────────────────────────

let warningResolve = null;

export function showFivemWarningModal() {
  return new Promise((resolve) => {
    warningResolve = resolve;
    const modal = document.getElementById('warning-modal');
    modal.classList.add('visible');
    showOverlay(() => {
      resolveWarning(false);
    });
  });
}

function resolveWarning(confirmed) {
  const modal = document.getElementById('warning-modal');
  modal.classList.remove('visible');
  hideOverlay();
  if (warningResolve) {
    warningResolve(confirmed);
    warningResolve = null;
  }
}

document.getElementById('btn-warning-cancel')?.addEventListener('click', () => resolveWarning(false));
document.getElementById('btn-warning-confirm')?.addEventListener('click', () => resolveWarning(true));


// ─── Player List Panel ────────────────────────────────────────────────────────

let currentPanelServerId = null;

export async function openPlayerPanel(serverId) {
  currentPanelServerId = serverId;
  const server = state.config.servers.find(s => s.id === serverId);
  if (!server) return;

  // Update panel title
  document.getElementById('panel-title').textContent = `${server.name}`;

  // Clear search
  const searchInput = document.getElementById('panel-search-input');
  if (searchInput) searchInput.value = '';

  // Show loading state
  const listEl = document.getElementById('panel-player-list');
  listEl.innerHTML = `
    <div class="panel-loading">
      <div class="spinner-lg"></div>
      <span>Memuat daftar player...</span>
    </div>
  `;

  // Update footer
  document.getElementById('panel-footer').textContent = 'Memuat...';

  // Open panel
  document.getElementById('player-panel').classList.add('visible');
  showOverlay(() => closePlayerPanel());

  // Fetch player list
  try {
    const players = await api.fetchPlayerList(server.joinCode);
    state.playerListCache[serverId] = players;
    renderPlayerList(players, '');
  } catch (err) {
    listEl.innerHTML = `
      <div class="panel-empty">
        <span>Tidak dapat memuat daftar player.</span>
        <span style="font-size:11px; margin-top:4px; color: var(--text-muted)">${err}</span>
      </div>
    `;
    document.getElementById('panel-footer').textContent = 'Gagal memuat';
  }
}

export function closePlayerPanel() {
  document.getElementById('player-panel').classList.remove('visible');
  hideOverlay();
  currentPanelServerId = null;
}

// Local search within player panel
document.getElementById('panel-search-input')?.addEventListener('input', (e) => {
  const query = e.target.value;
  if (currentPanelServerId && state.playerListCache[currentPanelServerId]) {
    renderPlayerList(state.playerListCache[currentPanelServerId], query);
  }
});

document.getElementById('btn-close-panel')?.addEventListener('click', closePlayerPanel);

// ─── Settings Panel ───────────────────────────────────────────────────────────

export function openSettings() {
  populateSettings();
  document.getElementById('settings-panel').classList.add('visible');
  showOverlay(() => closeSettings());
}

export function closeSettings() {
  document.getElementById('settings-panel').classList.remove('visible');
  hideOverlay();
}

document.getElementById('btn-close-settings')?.addEventListener('click', closeSettings);

function populateSettings() {
  if (!state.config) return;
  const { settings, fivemCachePath, history } = state.config;

  // FiveM path
  const pathDisplay = document.getElementById('settings-fivem-path');
  if (pathDisplay) pathDisplay.textContent = fivemCachePath;

  // Global cache storage path
  const globalCacheDisplay = document.getElementById('settings-global-cache-path');
  if (globalCacheDisplay) {
    globalCacheDisplay.textContent = settings.globalCacheDir || getDefaultProfileCachePath('');
  }

  // Refresh interval
  const intervalSelect = document.getElementById('settings-refresh-interval');
  if (intervalSelect) intervalSelect.value = String(settings.refreshIntervalSeconds);

  // Auto-connect toggle
  const autoToggle = document.getElementById('settings-auto-connect');
  if (autoToggle) autoToggle.checked = settings.autoConnectAfterSwap;

  // History table
  renderHistoryTable(history);
}

function renderHistoryTable(history) {
  const tbody = document.getElementById('history-tbody');
  if (!tbody) return;

  if (!history || history.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding: 16px;">Belum ada riwayat swap.</td></tr>`;
    return;
  }

  const { formatTimestamp } = window._nomadUtils;

  // Show most recent first
  const rows = [...history].reverse().map(h => {
    const fromName = h.from && h.from !== 'none'
      ? (state.config.servers.find(s => s.id === h.from)?.name ?? h.from)
      : '(baru)';
    const toName = state.config.servers.find(s => s.id === h.to)?.name ?? h.to;
    const statusHtml = h.status === 'success'
      ? '<span class="history-status-ok">✓ Berhasil</span>'
      : '<span class="history-status-fail">✗ Gagal</span>';

    return `
      <tr>
        <td>${formatTimestamp(h.timestamp)}</td>
        <td style="max-width:120px; overflow:hidden; text-overflow:ellipsis">${fromName}</td>
        <td style="max-width:120px; overflow:hidden; text-overflow:ellipsis">${toName}</td>
        <td>${statusHtml}</td>
      </tr>
    `;
  }).join('');

  tbody.innerHTML = rows;
}

// Settings change: FiveM path
document.getElementById('btn-change-fivem-path')?.addEventListener('click', async () => {
  const folder = await api.pickFolder();
  if (folder) {
    state.config.fivemCachePath = folder;
    await saveState();
    document.getElementById('settings-fivem-path').textContent = folder;
    showToast('Path FiveM cache diperbarui.', 'success');
  }
});

// Settings change: Global Cache Storage Path
document.getElementById('btn-change-global-cache-path')?.addEventListener('click', async () => {
  const folder = await api.pickFolder();
  if (folder) {
    state.config.settings.globalCacheDir = folder;
    await saveState();
    document.getElementById('settings-global-cache-path').textContent = folder;
    showToast('Folder storage cache utama diperbarui.', 'success');
  }
});

// Settings change: refresh interval
document.getElementById('settings-refresh-interval')?.addEventListener('change', async (e) => {
  const val = parseInt(e.target.value, 10);
  if (isNaN(val)) return;
  state.config.settings.refreshIntervalSeconds = val;
  await saveState();

  // Restart refresh timer
  const { restartRefreshTimer } = await import('./app.js');
  restartRefreshTimer();
  showToast(`Interval refresh diubah ke ${val} detik.`, 'success');
});

// Settings change: auto-connect
document.getElementById('settings-auto-connect')?.addEventListener('change', async (e) => {
  state.config.settings.autoConnectAfterSwap = e.target.checked;
  await saveState();
});

// Sync server list from GitHub remote
document.getElementById('btn-sync-remote')?.addEventListener('click', async () => {
  const btn = document.getElementById('btn-sync-remote');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Menyinkronkan...'; }
  try {
    const { syncFromRemote } = await import('./app.js');
    await syncFromRemote();
    showToast('Sinkronisasi server selesai!', 'success');
  } catch (err) {
    showToast(`Gagal sinkronisasi: ${err}`, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '🔄 Sync Server Online (GitHub)'; }
  }
});

// Load Indonesian server presets
document.getElementById('btn-load-presets')?.addEventListener('click', async () => {
  try {
    const updated = await api.loadDefaultPresets(state.config);
    state.config = updated;
    const { renderAll, refreshAllServers } = await import('./app.js');
    renderAll();
    refreshAllServers();
    showToast('Preset server Indonesia berhasil dimuat!', 'success');
  } catch (err) {
    showToast(`Gagal muat preset: ${err}`, 'error');
  }
});

// Export config
document.getElementById('btn-export-config')?.addEventListener('click', async () => {
  try {
    const savePath = await api.pickSavePath();
    if (!savePath) return;
    await api.exportConfig(savePath);
    showToast('Config berhasil diekspor.', 'success');
  } catch (err) {
    showToast(`Gagal ekspor config: ${err}`, 'error');
  }
});

// Import config
document.getElementById('btn-import-config')?.addEventListener('click', async () => {
  try {
    const filePath = await api.pickFile();
    if (!filePath) return;
    const newConfig = await api.importConfig(filePath);
    state.config = newConfig;

    // Re-render everything
    const { renderAll } = await import('./app.js');
    renderAll();
    populateSettings();
    showToast('Config berhasil diimport.', 'success');
  } catch (err) {
    showToast(`Gagal import config: ${err}`, 'error');
  }
});
