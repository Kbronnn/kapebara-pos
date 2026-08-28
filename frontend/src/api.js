/* API helper — all calls go through here */
export const API = {
  base: '/api',
  async get(path) {
    const r = await fetch(this.base + path);
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async post(path, data) {
    const r = await fetch(this.base + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async put(path, data) {
    const r = await fetch(this.base + path, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async del(path) {
    const r = await fetch(this.base + path, { method: 'DELETE' });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async delete(path) { return this.del(path); },
  async patch(path, data) {
    const r = await fetch(this.base + path, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  }
};

export function toast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) {
    // If not mounted yet, console log or create
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

export function formatPHP(n) {
  return '₱' + Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function formatNum(n) {
  return Number(n).toLocaleString();
}
