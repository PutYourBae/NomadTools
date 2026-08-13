/**
 * NomadTools — UI Rendering
 */

import { state } from './app.js';
import { formatPlayerCount, highlightMatch, escapeHtml, formatRelativeTime } from './utils.js';
import { openAddEditModal, openPlayerPanel, openSettings, showFivemWarningModal } from './modals.js';
import * as api from './api.js';
import { connectToServer } from './api.js';

// ─── Server Grid ──────────────────────────────────────────────────────────────

/**
 * Render (or re-render) the entire server card grid
 */
export function renderServerCards() {
  const grid = document.getElementById('server-grid');
  const emptyState = document.getElementById('empty-state');
  const query = document.getElementById('global-search')?.value?.toLowerCase() ?? '';

  const allServers = state.config?.servers ?? [];
  const servers = allServers
    .filter(s => !query || s.name.toLowerCase().includes(query))
    .sort((a, b) => {
      // Active server always first
      const aActive = state.config?.activeServerId === a.id;
      const bActive = state.config?.activeServerId === b.id;
      if (aActive && !bActive) return -1;
      if (!aActive && bActive) return 1;
      // Then by lastPlayed (most recent first)
      if (a.lastPlayed && b.lastPlayed) return new Date(b.lastPlayed) - new Date(a.lastPlayed);
      if (a.lastPlayed) return -1;
      if (b.lastPlayed) return 1;
      // Alphabetical for rest
      return a.name.localeCompare(b.name);
    });

  let localhostCardHtml = '';
  if (state.localhostInfo && !state.localhostInfo.offline) {
    localhostCardHtml = buildLocalhostCard(state.localhostInfo);
  }

  if (!state.config || (!state.config.servers || state.config.servers.length === 0) && !localhostCardHtml) {
    grid.innerHTML = '';
    emptyState.style.display = 'flex';
    return;
  }

  emptyState.style.display = 'none';

  const cards = servers.map(server => buildServerCard(server)).join('');

  grid.innerHTML = localhostCardHtml + cards;

  // Bind event for localhost play button if present
  if (state.localhostInfo && !state.localhostInfo.offline) {
    document.getElementById('btn-play-localhost')?.addEventListener('click', () => {
      api.connectToServer('127.0.0.1:30120');
    });
  }

  // Bind events for each card
  servers.forEach(server => bindCardEvents(server.id));
}

/**
 * Build HTML for auto-detected Localhost FXServer card (Position #1)
 */
function buildLocalhostCard(info) {
  const clients = info ? info.clients : 0;
  const maxClients = info ? info.maxClients : 32;
  const hostname = info && info.hostname ? info.hostname : 'Localhost FXServer';

  return `
    <div class="server-card card-active card-localhost" id="card-localhost-dev" style="border-color: rgba(16,185,129,0.5); background: rgba(16,185,129,0.08);">
      <div class="card-accent-bar" style="background: linear-gradient(to bottom, #10b981, #059669); box-shadow: 0 0 12px rgba(16,185,129,0.6);"></div>
      
      <div class="card-icon-wrap" style="background: rgba(16,185,129,0.15); border-color: rgba(16,185,129,0.3);">
        <div class="card-icon-initials" style="background: linear-gradient(135deg, rgba(16,185,129,0.3), rgba(5,150,105,0.4)); color: #10b981; font-size:16px;">⚡</div>
      </div>
      
      <div class="card-info">
        <div class="card-name" title="${escapeHtml(hostname)}" style="color: #6ee7b7; font-weight: 700;">${escapeHtml(hostname)}</div>
        <div class="card-meta">
          <span class="card-joincode" style="color: #10b981; font-weight: 600;">127.0.0.1:30120</span>
        </div>
        <div class="card-status-row">
          <div class="status-dot online"></div>
          <span class="card-player-count">${clients}/${maxClients}</span>
          <span class="card-player-label">pemain</span>
          <span class="badge-active" style="background: rgba(16,185,129,0.2); color: #10b981; border: 1px solid rgba(16,185,129,0.4);">⚡ LOCALHOST DEV</span>
        </div>
      </div>
      
      <div class="card-actions">
        <button class="btn-play" id="btn-play-localhost" style="background: linear-gradient(135deg, #10b981, #059669);" aria-label="Play Localhost">
          <span class="play-text">▶ Play</span>
        </button>
      </div>
    </div>
  `;
}

/**
 * Build HTML for a single server card
 */
function buildServerCard(server) {
  const info = state.serverInfoMap[server.joinCode];
  const isActive = state.config?.activeServerId === server.id;
  const isSwapping = state.swappingProfileId === server.id;

  const online = info && !info.offline;
  
  const playBtnContent = isSwapping
    ? `<div class="play-spinner"><div class="spinner"></div><span>Menukar...</span></div>`
    : `<span class="play-text">▶ Play</span>`;

  const activeClass = isActive ? 'card-active' : '';
  const loadingClass = isSwapping ? 'is-loading' : '';
  const lastPlayedText = server.lastPlayed ? `Terakhir: ${formatRelativeTime(server.lastPlayed)}` : '';

  const initials = server.name ? server.name.substring(0, 2).toUpperCase() : '??';
  let iconHtml = '';
  if (info && info.iconUrl) {
    iconHtml = `<img src="${escapeHtml(info.iconUrl)}" class="card-icon-img" alt="Logo" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" /><div class="card-icon-initials" style="display:none">${escapeHtml(initials)}</div>`;
  } else {
    iconHtml = `<div class="card-icon-initials">${escapeHtml(initials)}</div>`;
  }

  const clients = info ? info.clients : 0;
  const maxClients = info ? info.maxClients : 0;

  return `
    <div class="server-card ${activeClass} ${loadingClass}" id="card-${server.id}" data-server-id="${server.id}">
      <div class="card-accent-bar"></div>
      
      <div class="card-icon-wrap">
        ${iconHtml}
      </div>
      
      <div class="card-info">
        <div class="card-name" title="${escapeHtml(server.name)}">${escapeHtml(server.name)}</div>
        <div class="card-meta">
          <span class="card-joincode">${escapeHtml(server.joinCode)}</span>
          ${lastPlayedText ? `<span class="card-last-played">${lastPlayedText}</span>` : ''}
        </div>
        <div class="card-status-row">
          <div class="status-dot ${online ? 'online' : 'offline'}"></div>
          <span class="card-player-count">${clients}/${maxClients}</span>
          <span class="card-player-label">pemain</span>
          ${isActive ? `<span class="badge-active">● AKTIF</span>` : ''}
        </div>
      </div>
      
      <div class="card-actions">
        <button class="btn-play ${isSwapping ? 'loading' : ''}" id="btn-play-${server.id}" ${isSwapping ? 'disabled' : ''} aria-label="Play ${escapeHtml(server.name)}">
          ${playBtnContent}
        </button>
        <button class="btn-players" id="btn-players-${server.id}" aria-label="Lihat daftar player ${escapeHtml(server.name)}" title="Lihat player">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        </button>
      </div>
    </div>
  `;
}

/**
 * Bind click events for buttons inside a card
 */
function bindCardEvents(serverId) {
  // Play button
  document.getElementById(`btn-play-${serverId}`)?.addEventListener('click', () => {
    handlePlayClick(serverId);
  });

  // Players button
  document.getElementById(`btn-players-${serverId}`)?.addEventListener('click', () => {
    openPlayerPanel(serverId);
  });

  // Options button
  const optBtn = document.getElementById(`btn-options-${serverId}`);
  optBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleContextMenu(serverId, optBtn);
  });
}

// ─── Context Menu ─────────────────────────────────────────────────────────────

let openMenuServerId = null;

function toggleContextMenu(serverId, anchorBtn) {
  // Close existing menu
  closeOpenMenu();

  if (openMenuServerId === serverId) return;

  openMenuServerId = serverId;
  const server = state.config.servers.find(s => s.id === serverId);
  const card = document.getElementById(`card-${serverId}`);

  const menu = document.createElement('div');
  menu.className = 'card-context-menu';
  menu.id = `menu-${serverId}`;
  menu.innerHTML = `
    <div class="context-menu-item" id="ctx-edit-${serverId}">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg>
      Edit Server
    <div class="context-menu-item" id="ctx-adopt-${serverId}">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 8v8M8 12h8"/>
      </svg>
      Hubungkan Cache Aktif Saat Ini
    </div>
    <div class="context-menu-item danger" id="ctx-delete-${serverId}">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="3 6 5 6 21 6"/>
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
        <path d="M10 11v6"/><path d="M14 11v6"/>
        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
      </svg>
      Hapus Server
    </div>
  `;

  card.style.position = 'relative';
  card.appendChild(menu);

  // Adopt
  document.getElementById(`ctx-adopt-${serverId}`)?.addEventListener('click', async () => {
    closeOpenMenu();
    try {
      showToast('Menghubungkan cache aktif...', 'info');
      const updatedConfig = await invoke('adopt_active_cache', { profileId: serverId, config: state.config });
      state.config = updatedConfig;
      renderServerGrid();
      showToast(`✓ Cache FiveM di PC kamu saat ini berhasil dihubungkan ke '${server.name}'!`, 'success');
    } catch (err) {
      showToast(`Gagal menghubungkan cache: ${err}`, 'error');
    }
  });

  // Edit
  document.getElementById(`ctx-edit-${serverId}`)?.addEventListener('click', () => {
    closeOpenMenu();
    openAddEditModal(server);
  });

  // Delete
  document.getElementById(`ctx-delete-${serverId}`)?.addEventListener('click', () => {
    closeOpenMenu();
    handleDeleteServer(serverId);
  });

  // Close menu on outside click
  setTimeout(() => {
    document.addEventListener('click', closeOpenMenu, { once: true });
  }, 10);
}

function closeOpenMenu() {
  if (openMenuServerId) {
    const menu = document.getElementById(`menu-${openMenuServerId}`);
    menu?.remove();
    openMenuServerId = null;
  }
}

// ─── Delete Server ─────────────────────────────────────────────────────────────

async function handleDeleteServer(serverId) {
  const server = state.config.servers.find(s => s.id === serverId);
  if (!server) return;

  // Confirm
  const confirmed = await showConfirmModal(
    `Hapus server '${server.name}'?`,
    'Data cache tidak akan dihapus, hanya entri server yang dihapus dari daftar.',
    'Hapus',
    'danger'
  );
  if (!confirmed) return;

  // If deleting the active server, clear activeServerId
  if (state.config.activeServerId === serverId) {
    state.config.activeServerId = null;
  }

  state.config.servers = state.config.servers.filter(s => s.id !== serverId);
  await (await import('./app.js')).saveState();
  renderServerCards();
  showToast(`Server '${server.name}' dihapus.`, 'success');
}

// ─── Generic Confirm Modal ────────────────────────────────────────────────────

let confirmResolve = null;

function showConfirmModal(title, body, confirmLabel, type = 'warn') {
  return new Promise((resolve) => {
    confirmResolve = resolve;

    const modal = document.getElementById('confirm-modal');
    const titleEl = document.getElementById('confirm-modal-title');
    const bodyEl = document.getElementById('confirm-modal-body');
    const confirmBtn = document.getElementById('btn-confirm-ok');
    const iconWrap = document.getElementById('confirm-icon-wrap');

    if (titleEl) titleEl.textContent = title;
    if (bodyEl) bodyEl.textContent = body;
    if (confirmBtn) {
      confirmBtn.textContent = confirmLabel;
      confirmBtn.className = `btn btn-solid-${type === 'danger' ? 'danger' : 'warning'}`;
    }
    if (iconWrap) {
      iconWrap.className = `confirm-icon-wrap ${type}`;
    }

    modal.classList.add('visible');

    const overlay = document.getElementById('overlay');
    overlay.classList.add('visible');
    overlay.addEventListener('click', () => resolveConfirm(false), { once: true });
  });
}

function resolveConfirm(confirmed) {
  const modal = document.getElementById('confirm-modal');
  modal.classList.remove('visible');
  document.getElementById('overlay').classList.remove('visible');
  if (confirmResolve) {
    confirmResolve(confirmed);
    confirmResolve = null;
  }
}

document.getElementById('btn-confirm-cancel')?.addEventListener('click', () => resolveConfirm(false));
document.getElementById('btn-confirm-ok')?.addEventListener('click', () => resolveConfirm(true));

// ─── Play / Swap Handler ──────────────────────────────────────────────────────

export async function handlePlayClick(serverId) {
  if (state.isSwapping) return;

  const server = state.config.servers.find(s => s.id === serverId);
  if (!server) return;

  // Step 1: Check FiveM running
  let fivemRunning = false;
  try {
    fivemRunning = await api.isFivemRunning();
  } catch {}

  if (fivemRunning) {
    const proceed = await showFivemWarningModal();
    if (!proceed) return;
  }

  // Step 2: Swap langsung tanpa cek integrity

  state.isSwapping = true;
  state.swappingProfileId = serverId;
  setCardLoading(serverId, true);

  // Show persistent loading toast dengan progress bar di kanan bawah
  const { toastEl, setProgress } = showLoadingToast(`⚡ Menghubungkan ke '${server.name}'`);

  // Listen to real-time progress events from Rust
  let unlisten = null;
  try {
    if (window.__TAURI__?.event?.listen) {
      unlisten = await window.__TAURI__.event.listen('swap-progress', (event) => {
        const { percent, label } = event.payload;
        setProgress(percent, label);
      });
    }
  } catch {}

  try {
    const result = await api.swapCache(serverId, state.config);

    // Stop listening
    if (unlisten) { try { unlisten(); } catch {} }
    hideLoadingToast(toastEl);

    if (result.success) {
      // Reload config to get updated activeServerId and lastPlayed
      const { reloadConfig, refreshAllServers } = await import('./app.js');
      await reloadConfig();

      showToast(`✓ Berhasil pindah ke '${server.name}'`, 'success');

      // Animate new active card
      setTimeout(() => {
        const card = document.getElementById(`card-${serverId}`);
        card?.classList.add('just-activated');
        card?.addEventListener('animationend', () => card.classList.remove('just-activated'), { once: true });
      }, 50);

      // Auto-connect if enabled
      if (state.config.settings.autoConnectAfterSwap) {
        try {
          await connectToServer(server.joinCode);
        } catch {}
      }
    } else {
      showToast(`✗ ${result.message}`, 'error');
    }
  } catch (err) {
    if (unlisten) { try { unlisten(); } catch {} }
    hideLoadingToast(toastEl);
    showToast(`✗ Gagal swap cache: ${err}`, 'error');
  } finally {
    state.isSwapping = false;
    state.swappingProfileId = null;
    renderServerCards();
  }
}

function setCardLoading(serverId, loading) {
  const btn = document.getElementById(`btn-play-${serverId}`);
  const card = document.getElementById(`card-${serverId}`);
  if (!btn || !card) return;

  if (loading) {
    btn.classList.add('loading');
    btn.disabled = true;
    card.classList.add('is-loading');
    btn.innerHTML = `<div class="play-spinner"><div class="spinner"></div><span>Menukar...</span></div>`;
  } else {
    btn.classList.remove('loading');
    btn.disabled = false;
    card.classList.remove('is-loading');
    btn.innerHTML = `<span class="play-text">▶ Play</span>`;
  }
}

// ─── Player List Render ───────────────────────────────────────────────────────

/**
 * Render player list inside the side panel
 * @param {Array<{id, name, ping}>} players
 * @param {string} query
 */
export function renderPlayerList(players, query) {
  const listEl = document.getElementById('panel-player-list');
  const footerEl = document.getElementById('panel-footer');

  const q = query.toLowerCase().trim();
  const filtered = q
    ? players.filter(p => p.name.toLowerCase().includes(q) || String(p.id).includes(q))
    : players;

  if (filtered.length === 0) {
    listEl.innerHTML = `
      <div class="panel-empty">
        ${q
          ? `Tidak ada player dengan nama mengandung "<strong>${escapeHtml(q)}</strong>"`
          : 'Tidak ada player online.'
        }
      </div>
    `;
    footerEl.textContent = q
      ? `0 dari ${players.length} pemain cocok`
      : `${players.length} pemain online`;
    return;
  }

  listEl.innerHTML = filtered.map((p, i) => `
    <div class="player-item" style="animation-delay:${Math.min(i * 12, 300)}ms">
      <div class="player-dot"></div>
      <span class="player-id">#${p.id}</span>
      <span class="player-name">${highlightMatch(p.name, query)}</span>
      <span class="player-ping">${p.ping}ms</span>
    </div>
  `).join('');

  footerEl.textContent = q
    ? `${filtered.length} dari ${players.length} pemain cocok dengan "${q}"`
    : `${players.length} pemain online`;
}

// ─── Toast ────────────────────────────────────────────────────────────────────

const TOAST_ICONS = {
  success: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>`,
  error:   `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
  warning: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
};

/**
 * Show a toast notification
 * @param {string} message
 * @param {'success'|'error'|'warning'} type
 * @param {number} durationMs
 */
export function showToast(message, type = 'success', durationMs = 3500) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${TOAST_ICONS[type] ?? ''}</span>
    <span class="toast-msg">${escapeHtml(message)}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fade-out');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }, durationMs);
}

/**
 * Show a persistent loading toast with progress bar (stays until dismissed).
 * Returns { toastEl, setProgress } — call setProgress(percent, label) to update.
 */
export function showLoadingToast(title) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast toast-loading';
  toast.innerHTML = `
    <div class="loading-toast-inner">
      <div class="loading-toast-header">
        <div class="spinner toast-spinner"></div>
        <span class="loading-toast-title">${escapeHtml(title)}</span>
      </div>
      <div class="loading-toast-bar-wrap">
        <div class="loading-toast-bar" style="width:0%"></div>
      </div>
      <div class="loading-toast-meta">
        <span class="loading-toast-label">Memulai...</span>
        <span class="loading-toast-percent">0%</span>
      </div>
    </div>
  `;
  container.appendChild(toast);

  const bar = toast.querySelector('.loading-toast-bar');
  const labelEl = toast.querySelector('.loading-toast-label');
  const percentEl = toast.querySelector('.loading-toast-percent');

  function setProgress(percent, label) {
    bar.style.width = `${percent}%`;
    labelEl.textContent = label ?? '';
    percentEl.textContent = `${percent}%`;
  }

  return { toastEl: toast, setProgress };
}

/** Dismiss a loading toast created by showLoadingToast */
export function hideLoadingToast(toastEl) {
  if (!toastEl || !toastEl.parentNode) return;
  toastEl.classList.add('fade-out');
  toastEl.addEventListener('animationend', () => toastEl.remove(), { once: true });
}

// ─── Skeleton Loaders ─────────────────────────────────────────────────────────

export function renderSkeletonCards(count = 3) {
  const grid = document.getElementById('server-grid');
  const skeletons = Array.from({ length: count }).map(() => `
    <div class="server-card" style="pointer-events:none">
      <div style="display:flex; flex-direction:column; gap:12px">
        <div class="skeleton" style="height:16px; width:70%"></div>
        <div class="skeleton" style="height:12px; width:40%"></div>
        <div class="skeleton" style="height:36px; width:100%"></div>
      </div>
    </div>
  `).join('');
  grid.innerHTML = skeletons;
}
