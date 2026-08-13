/**
 * NomadTools — Utility Helpers
 */

/**
 * Format player count string
 * @param {number} current
 * @param {number} max
 * @param {boolean} offline
 * @returns {string}
 */
export function formatPlayerCount(current, max, offline) {
  if (offline) return 'Offline';
  if (max === 0) return `${current} pemain`;
  return `${current}/${max} pemain`;
}

/**
 * Format ISO timestamp to locale string
 * @param {string} iso
 * @returns {string}
 */
export function formatTimestamp(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

/**
 * Format relative time (e.g. "3 jam lalu")
 * @param {string} iso
 * @returns {string}
 */
export function formatRelativeTime(iso) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'baru saja';
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  return `${days} hari lalu`;
}

/**
 * Escape HTML special chars
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Highlight query occurrences inside a string (case-insensitive)
 * Returns HTML string with <mark> tags
 * @param {string} text
 * @param {string} query
 * @returns {string}
 */
export function highlightMatch(text, query) {
  if (!query) return escapeHtml(text);
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  return escapeHtml(text).replace(regex, '<mark>$1</mark>');
}

/**
 * Generate a random short ID (for new profile IDs)
 * @returns {string}
 */
export function generateId() {
  return Math.random().toString(36).slice(2, 9);
}

/**
 * Truncate a long path for display
 * @param {string} path
 * @param {number} maxLen
 * @returns {string}
 */
export function truncatePath(path, maxLen = 50) {
  if (!path || path.length <= maxLen) return path;
  const parts = path.replace(/\\/g, '/').split('/');
  if (parts.length <= 3) return path;
  return `${parts[0]}/.../${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
}

/**
 * Debounce a function
 * @param {Function} fn
 * @param {number} ms
 * @returns {Function}
 */
export function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}
