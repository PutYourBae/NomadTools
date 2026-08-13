/**
 * NomadTools — Tauri Invoke Wrappers
 * All Tauri backend command calls go through this module safely.
 */

function getInvoke() {
  if (window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke) {
    return window.__TAURI__.core.invoke;
  }
  if (window.__TAURI_INTERNALS__ && window.__TAURI_INTERNALS__.invoke) {
    return window.__TAURI_INTERNALS__.invoke;
  }
  return null;
}

async function safeInvoke(cmd, args) {
  const invoke = getInvoke();
  if (!invoke) {
    throw new Error("Tauri API tidak ditemukan. Pastikan aplikasi berjalan di dalam Tauri.");
  }
  return invoke(cmd, args);
}

// ─── Config ──────────────────────────────────────────────────────────────────

/** Load config from disk */
export async function loadConfig() {
  return safeInvoke('load_config');
}

/** Save full config to disk */
export async function saveConfig(config) {
  return safeInvoke('save_config', { config });
}

/** Get the default FiveM cache path */
export async function getDefaultFivemPath() {
  return safeInvoke('get_default_fivem_path');
}

/** Export config JSON to user-chosen path */
export async function exportConfig(destPath) {
  return safeInvoke('export_config', { destPath });
}

/** Import config JSON from user-chosen path */
export async function importConfig(srcPath) {
  return safeInvoke('import_config', { srcPath });
}

/** Load preset Indonesian FiveM server profiles */
export async function loadDefaultPresets(config) {
  return safeInvoke('load_default_presets', { config });
}

/** Open native folder picker; returns path string or null */
export async function pickFolder() {
  return safeInvoke('pick_folder');
}

/** Open native file picker (JSON); returns path string or null */
export async function pickFile() {
  return safeInvoke('pick_file');
}

/** Open native save dialog; returns path string or null */
export async function pickSavePath() {
  return safeInvoke('pick_save_path');
}

// ─── Cache Operations ─────────────────────────────────────────────────────────

/**
 * Perform cache swap for given profile
 * @param {string} profileId
 * @param {object} config - full AppConfig
 * @returns {Promise<{success: boolean, message: string, error?: string}>}
 */
export async function swapCache(profileId, config) {
  return safeInvoke('swap_cache', { profileId, config });
}

// ─── Storage Analytics & Folder Management ────────────────────────────────────

export async function getStorageAnalytics(config) {
  return safeInvoke('get_storage_analytics', { config });
}

export async function openFolderInExplorer(folderPath) {
  return safeInvoke('open_folder_in_explorer', { folderPath });
}

export async function deleteServerCacheFolder(cachePath) {
  return safeInvoke('delete_server_cache_folder', { cachePath });
}

// ─── Process ──────────────────────────────────────────────────────────────────

/** Returns true if FiveM.exe is currently running */
export async function isFivemRunning() {
  return safeInvoke('is_fivem_running');
}

// ─── FiveM API ────────────────────────────────────────────────────────────────

/**
 * Fetch live server info for a single join code
 * @param {string} joinCode
 * @returns {Promise<{joinCode, clients, maxClients, hostname, offline}>}
 */
export async function fetchServerInfo(joinCode) {
  return safeInvoke('fetch_server_info', { joinCode });
}

/**
 * Fetch player list for a single server
 * @param {string} joinCode
 * @returns {Promise<Array<{id, name, ping}>>}
 */
export async function fetchPlayerList(joinCode) {
  return safeInvoke('fetch_player_list', { joinCode });
}

/**
 * Fetch server info for multiple servers concurrently
 * @param {string[]} joinCodes
 * @returns {Promise<Array<{joinCode, clients, maxClients, hostname, offline}>>}
 */
export async function fetchAllServersInfo(joinCodes) {
  return safeInvoke('fetch_all_servers_info', { joinCodes });
}

/** Clear the resolved endpoint cache in Rust */
export async function clearEndpointCache() {
  return safeInvoke('clear_endpoint_cache');
}

// ─── Shell ────────────────────────────────────────────────────────────────────

/**
 * Open fivem:// URL to connect to a server
 * @param {string} joinCode
 */
export async function connectToServer(joinCode) {
  if (window.__TAURI__ && window.__TAURI__.shell && window.__TAURI__.shell.open) {
    return window.__TAURI__.shell.open(`fivem://connect/${joinCode}`);
  }
  return safeInvoke('plugin:shell|open', { path: `fivem://connect/${joinCode}` });
}

// ─── Remote Sync ──────────────────────────────────────────────────────────────

/**
 * Fetch remote servers.json from GitHub and merge new servers into local config.
 * Returns { added, updated, error } — never throws.
 * @param {object} config - current AppConfig
 * @returns {Promise<{added: number, updated: number, error: string|null}>}
 */
export async function syncRemoteServers(config) {
  return safeInvoke('sync_remote_servers', { config });
}

/** Check if a local FiveM FXServer is running on 127.0.0.1:30120 */
export async function checkLocalhostServer() {
  return safeInvoke('check_localhost_server');
}
