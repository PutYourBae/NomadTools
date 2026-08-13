/**
 * NomadTools — Storage Cache Manager
 * Handles the "Kelola Cache" tab: analytics, list, folder actions, delete
 */

import * as api from './api.js';
import { state } from './app.js';
import { escapeHtml } from './utils.js';

let storageData = null;

// ─── Public: Load & render storage analytics ─────────────────────────────────

export async function loadStorageView() {
  setStorageLoading(true);
  try {
    storageData = await api.getStorageAnalytics(state.config);
    renderStorageSummary(storageData);
    renderStoragePath(storageData);
    renderStorageList(storageData);
  } catch (err) {
    document.getElementById('storage-server-list').innerHTML =
      `<div class="storage-loading" style="color:#f87171">Gagal memuat data: ${escapeHtml(String(err))}</div>`;
  } finally {
    setStorageLoading(false);
  }
}

// ─── Render summary stat cards ────────────────────────────────────────────────

function renderStorageSummary(data) {
  setVal('stat-total-val', data.totalSizeFormatted || '0 B');
  setVal('stat-active-val', data.activeSizeFormatted || '0 B');
  setVal('stat-stored-val', data.storageSizeFormatted || '0 B');
  setVal('stat-count-val', String(data.totalCachesCount ?? 0));
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ─── Render path row ──────────────────────────────────────────────────────────

function renderStoragePath(data) {
  const pathEl = document.getElementById('storage-path-text');
  if (pathEl) pathEl.textContent = data.globalCacheDir || '(belum diatur)';
}

// ─── Render server cache list ─────────────────────────────────────────────────

function renderStorageList(data) {
  const listEl = document.getElementById('storage-server-list');
  if (!data.servers || data.servers.length === 0) {
    listEl.innerHTML = `<div class="storage-loading">Tidak ada server yang dikonfigurasi.</div>`;
    return;
  }

  // Sort: active first → has cache → empty
  const sorted = [...data.servers].sort((a, b) => {
    if (a.isActive && !b.isActive) return -1;
    if (!a.isActive && b.isActive) return 1;
    if (a.sizeBytes !== b.sizeBytes) return b.sizeBytes - a.sizeBytes;
    return a.serverName.localeCompare(b.serverName);
  });

  listEl.innerHTML = sorted.map(s => buildServerRow(s)).join('');

  // Bind action buttons
  sorted.forEach(s => {
    const openBtn = document.getElementById(`btn-open-folder-${s.serverId}`);
    const deleteBtn = document.getElementById(`btn-delete-cache-${s.serverId}`);

    openBtn?.addEventListener('click', () => handleOpenFolder(s.cachePath));
    deleteBtn?.addEventListener('click', () => handleDeleteCache(s));
  });
}

function buildServerRow(s) {
  const badgeHtml = buildBadge(s);
  const sizeClass = s.sizeBytes > 0 ? 'has-data' : '';
  const rowClass = s.isActive ? 'is-active' : '';
  const fileText = s.exists ? `${s.fileCount.toLocaleString()} file` : '—';
  const sizeText = s.exists ? s.sizeFormatted : '—';

  const canDelete = !s.isActive && s.exists && s.sizeBytes > 0;

  return `
    <div class="storage-server-row ${rowClass}" data-server-id="${escapeHtml(s.serverId)}">
      <div>
        <div class="storage-server-name" title="${escapeHtml(s.serverName)}">${escapeHtml(s.serverName)}</div>
        <div class="storage-server-code">${escapeHtml(s.joinCode)}</div>
      </div>
      <div>${badgeHtml}</div>
      <div class="storage-file-count">${escapeHtml(fileText)}</div>
      <div class="storage-size ${sizeClass}">${escapeHtml(sizeText)}</div>
      <div class="storage-row-actions">
        <button class="btn-row-action" id="btn-open-folder-${escapeHtml(s.serverId)}" title="Buka di Explorer">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          Buka
        </button>
        ${canDelete ? `
        <button class="btn-row-action danger" id="btn-delete-cache-${escapeHtml(s.serverId)}" title="Hapus folder cache ini">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
          Hapus
        </button>` : ''}
      </div>
    </div>
  `;
}

function buildBadge(s) {
  if (s.isActive) {
    return `<span class="storage-badge active">🎮 Aktif</span>`;
  }
  if (!s.exists || s.fileCount === 0) {
    return `<span class="storage-badge empty">— Kosong</span>`;
  }
  if (!s.isValid) {
    return `<span class="storage-badge corrupt">⚠️ Corrupt</span>`;
  }
  return `<span class="storage-badge stored">💾 Tersimpan</span>`;
}

// ─── Action handlers ──────────────────────────────────────────────────────────

async function handleOpenFolder(cachePath) {
  if (!cachePath) return;
  try {
    await api.openFolderInExplorer(cachePath);
  } catch (err) {
    showStorageToast(`Gagal membuka folder: ${err}`, 'error');
  }
}

async function handleCleanCache(server) {
  if (!confirm(`Bersihkan semua file cache "${server.serverName}"?\n\nFile akan dihapus permanen. FiveM akan download ulang saat kamu main di server ini.`)) return;
  try {
    await api.cleanCache(server.cachePath);
    showStorageToast(`✅ Cache "${server.serverName}" berhasil dibersihkan.`, 'success');
    await loadStorageView();
  } catch (err) {
    showStorageToast(`Gagal bersihkan: ${err}`, 'error');
  }
}

async function handleDeleteCache(server) {
  if (!confirm(`HAPUS folder cache "${server.serverName}"?\n\nFolder:\n${server.cachePath}\n\nSemua file akan dihapus permanen!`)) return;
  try {
    await api.deleteServerCacheFolder(server.cachePath);
    showStorageToast(`🗑️ Folder cache "${server.serverName}" dihapus.`, 'success');
    await loadStorageView();
  } catch (err) {
    showStorageToast(`Gagal hapus: ${err}`, 'error');
  }
}

// ─── Bindings ─────────────────────────────────────────────────────────────────

export function bindStorageButtons() {
  document.getElementById('btn-open-storage-folder')?.addEventListener('click', async () => {
    const path = storageData?.globalCacheDir;
    if (path) await handleOpenFolder(path);
  });

  document.getElementById('btn-refresh-storage')?.addEventListener('click', async () => {
    await loadStorageView();
    showStorageToast('Data storage diperbarui.', 'success');
  });
}

// ─── Tab switching ────────────────────────────────────────────────────────────

export function initTabSwitcher() {
  const dashTab = document.getElementById('tab-btn-dashboard');
  const storageTab = document.getElementById('tab-btn-storage');
  const mainView = document.getElementById('main-content');
  const storageView = document.getElementById('storage-view');
  const searchWrap = document.getElementById('search-wrap-main');

  dashTab?.addEventListener('click', () => {
    dashTab.classList.add('active');
    storageTab?.classList.remove('active');
    mainView.style.display = '';
    storageView.style.display = 'none';
    if (searchWrap) searchWrap.style.display = '';
  });

  storageTab?.addEventListener('click', async () => {
    storageTab.classList.add('active');
    dashTab?.classList.remove('active');
    mainView.style.display = 'none';
    storageView.style.display = 'flex';
    if (searchWrap) searchWrap.style.display = 'none';
    await loadStorageView();
  });
}

// ─── Tiny toast helper (reuse main toast if available) ───────────────────────

function showStorageToast(msg, type = 'success') {
  const event = new CustomEvent('nomad-toast', { detail: { msg, type } });
  window.dispatchEvent(event);
}

function setStorageLoading(loading) {
  const listEl = document.getElementById('storage-server-list');
  if (loading && listEl) {
    listEl.innerHTML = `<div class="storage-loading">⏳ Menghitung ukuran cache...</div>`;
  }
}
