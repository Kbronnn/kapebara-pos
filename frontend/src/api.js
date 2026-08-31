/* API helper — all calls go through here.
   Automatically attaches JWT tokens (staff or customer) to every request. */

// ── Token helpers ────────────────────────────────────────────────────────────
function getStaffToken()    { return sessionStorage.getItem('adminToken')    || ''; }
function getCustomerToken() { return sessionStorage.getItem('customerToken') || ''; }

/** Returns the best available auth token (staff first, then customer) */
function getAuthToken() {
  return getStaffToken() || getCustomerToken();
}

/** Build standard auth headers */
function authHeaders(extra = {}) {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...extra
  };
}

// ── Error helper: parse JSON error body cleanly ───────────────────────────────
async function parseError(r) {
  try {
    const body = await r.json();
    return new Error(body.error || body.message || `Request failed (${r.status})`);
  } catch {
    return new Error(`Request failed (${r.status})`);
  }
}

// ── Main API object ───────────────────────────────────────────────────────────
export const API = {
  base: '/api',

  async get(path) {
    const r = await fetch(this.base + path, {
      headers: authHeaders({ 'Content-Type': undefined })
    });
    if (!r.ok) throw await parseError(r);
    return r.json();
  },

  async post(path, data) {
    const r = await fetch(this.base + path, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data)
    });
    if (!r.ok) throw await parseError(r);
    return r.json();
  },

  async put(path, data) {
    const r = await fetch(this.base + path, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(data)
    });
    if (!r.ok) throw await parseError(r);
    return r.json();
  },

  async patch(path, data) {
    const r = await fetch(this.base + path, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(data)
    });
    if (!r.ok) throw await parseError(r);
    return r.json();
  },

  async del(path) {
    const r = await fetch(this.base + path, {
      method: 'DELETE',
      headers: authHeaders({ 'Content-Type': undefined })
    });
    if (!r.ok) throw await parseError(r);
    return r.json();
  },

  async delete(path) { return this.del(path); },

  /** Upload form-data (for file uploads) — does NOT set Content-Type so browser sets boundary */
  async upload(path, formData) {
    const token = getAuthToken();
    const r = await fetch(this.base + path, {
      method: 'PUT',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      body: formData
    });
    if (!r.ok) throw await parseError(r);
    return r.json();
  }
};

// ── Toast notifications ───────────────────────────────────────────────────────
export function toast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) {
    console.log(`[Toast ${type}] ${msg}`);
    return;
  }
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  const icons = { success: '✓', error: '✕', warning: '⚠' };
  t.innerHTML = `<span>${icons[type] || '✓'}</span> ${msg}`;
  container.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

// ── Formatters ────────────────────────────────────────────────────────────────
export function formatPHP(n) {
  return '₱' + Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function formatNum(n) {
  return Number(n).toLocaleString();
}
