/**
 * NomadTools — App State & Lifecycle
 * Entry point for the frontend SPA
 */

import * as api from './api.js';
import { renderServerCards, renderSkeletonCards, showToast } from './ui.js';
import { openAddEditModal, openSettings } from './modals.js';
import { debounce, formatTimestamp, formatRelativeTime, highlightMatch, escapeHtml } from './utils.js';
import { initTabSwitcher, bindStorageButtons } from './storage.js';

// ─── Global State ─────────────────────────────────────────────────────────────

export const state = {
  /** @type {import('./api.js').AppConfig|null} */
  config: null,

  /** @type {Object.<string, {clients: number, maxClients: number, hostname: string, offline: boolean}>} */
  serverInfoMap: {},

  /** @type {Object.<string, Array<{id: number, name: string, ping: number}>>} */
  playerListCache: {},

  /** @type {boolean} */
  isSwapping: false,

  /** @type {string|null} */
  swappingProfileId: null,

  /** @type {ReturnType<typeof setInterval>|null} */
  refreshTimer: null,
};

// Expose utils for use in modals.js dynamic imports
window._nomadUtils = { formatTimestamp, formatRelativeTime, highlightMatch, escapeHtml };

// ─── Config Persistence ───────────────────────────────────────────────────────

/**
 * Save current state.config to disk via Rust
 */
export async function saveState() {
  if (!state.config) return;
  try {
    await api.saveConfig(state.config);
  } catch (err) {
    console.error('Failed to save config:', err);
    showToast(`Gagal menyimpan config: ${err}`, 'error');
  }
}

/**
 * Reload config from disk and re-render
 */
export async function reloadConfig() {
  state.config = await api.loadConfig();
  renderServerCards();
}

/**
 * Re-render everything based on current state
 */
export function renderAll() {
  renderServerCards();
}

// ─── Player Count Refresh ─────────────────────────────────────────────────────

/**
 * Fetch player counts for all configured servers and update cards
 */
export async function refreshAllServers() {
  if (!state.config) return;

  // Auto-detect running localhost FXServer (127.0.0.1:30120)
  try {
    const localhost = await api.checkLocalhostServer();
    state.localhostInfo = localhost;
  } catch (e) {
    state.localhostInfo = null;
  }

  if (state.config.servers.length === 0 && !state.localhostInfo) {
    renderServerCards();
    return;
  }

  const joinCodes = state.config.servers.map(s => s.joinCode);

  try {
    const results = await api.fetchAllServersInfo(joinCodes);
    results.forEach(info => {
      state.serverInfoMap[info.joinCode] = info;
    });
  } catch (err) {
    console.warn('Failed to refresh server info:', err);
  } finally {
    renderServerCards();
  }
}

/**
 * Start the auto-refresh timer
 */
export function startRefreshTimer() {
  stopRefreshTimer();
  const intervalMs = (state.config?.settings?.refreshIntervalSeconds ?? 30) * 1000;
  state.refreshTimer = setInterval(refreshAllServers, intervalMs);
}

/**
 * Stop the auto-refresh timer
 */
export function stopRefreshTimer() {
  if (state.refreshTimer) {
    clearInterval(state.refreshTimer);
    state.refreshTimer = null;
  }
}

/**
 * Restart refresh timer (called when interval changes in settings)
 */
export function restartRefreshTimer() {
  startRefreshTimer();
}

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  // Show skeleton while loading
  renderSkeletonCards(3);

  try {
    // Load config
    state.config = await api.loadConfig();

    // Initial render
    renderServerCards();

    // Fetch initial player counts
    refreshAllServers();

    // Start refresh timer
    startRefreshTimer();

    // Init storage tab
    initTabSwitcher();
    bindStorageButtons();

    // Background: sync remote server list from GitHub (silent — tidak blokir UI)
    syncFromRemote();

  } catch (err) {
    console.error('Init failed:', err);
    showToast(`Gagal load config: ${err}`, 'error');
    renderServerCards(); // Render empty state
  }
}

/**
 * Silently sync server list from GitHub remote.
 * Called on startup and when user manually triggers sync.
 * Shows toast only if new servers were added.
 */
export async function syncFromRemote() {
  if (!state.config) return;
  try {
    const result = await api.syncRemoteServers(state.config);
    if (result && (result.added > 0 || result.updated > 0)) {
      // Reload config dari disk karena remote.rs sudah save ke file
      state.config = await api.loadConfig();
      renderServerCards();
      if (result.added > 0) {
        showToast(`✨ ${result.added} server baru ditambahkan dari update terbaru!`, 'success');
      }
    }
  } catch (err) {
    // Silent fail — jangan ganggu pengguna
    console.warn('Remote sync failed (offline?):', err);
  }
}

// ─── Event Bindings ───────────────────────────────────────────────────────────

// Global server search
document.getElementById('global-search')?.addEventListener('input', debounce(() => {
  renderServerCards();
}, 200));

// Add server button in top bar
document.getElementById('btn-add-server')?.addEventListener('click', () => {
  openAddEditModal();
});

// Settings button
document.getElementById('btn-settings')?.addEventListener('click', () => {
  openSettings();
});

// Keyboard shortcut: Escape → close topmost panel/modal
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    // Check which is open and close it
    const settingsPanel = document.getElementById('settings-panel');
    const playerPanel = document.getElementById('player-panel');
    const addEditModal = document.getElementById('add-edit-modal');
    const warningModal = document.getElementById('warning-modal');

    if (warningModal.classList.contains('visible')) {
      document.getElementById('btn-warning-cancel')?.click();
    } else if (addEditModal.classList.contains('visible')) {
      document.getElementById('btn-modal-cancel')?.click();
    } else if (playerPanel.classList.contains('visible')) {
      document.getElementById('btn-close-panel')?.click();
    } else if (settingsPanel.classList.contains('visible')) {
      document.getElementById('btn-close-settings')?.click();
    }
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────

// Wire main app toast event for storage.js
window.addEventListener('nomad-toast', (e) => {
  showToast(e.detail.msg, e.detail.type);
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
