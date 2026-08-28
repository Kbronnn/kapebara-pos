/* ── Audit Logs View ─────────────────────────────────────────────────────── */

async function initAuditLogs() {
  // Guard: only admins may view audit logs
  if (sessionStorage.getItem('adminRole') !== 'admin') {
    document.getElementById('view-audit-logs').innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔒</div>
        <p>Access restricted. Admin role required.</p>
      </div>`;
    return;
  }

  const el = document.getElementById('view-audit-logs');
  el.innerHTML = `<div class="flex-center" style="height:200px"><div class="spinner"></div></div>`;

  try {
    const [logsRes, accountsRes] = await Promise.all([
      API.get('/auth/audit-logs?limit=200'),
      API.get('/auth/accounts')
    ]);

    renderAuditLogs(logsRes.logs || [], accountsRes || []);
  } catch (err) {
    el.innerHTML = `<div class="empty-state"><p>${err.message}</p></div>`;
  }
}

function renderAuditLogs(logs, accounts) {
  const el = document.getElementById('view-audit-logs');

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">

      <!-- Account Manager Card -->
      <div class="card">
        <div class="section-header">
          <span class="card-title" style="margin:0">👥 Account Management</span>
          <button class="btn btn-primary btn-sm" onclick="auditShowAddAccount()">+ Add Account</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Username</th>
                <th>Role</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${accounts.map(a => `
                <tr>
                  <td class="font-bold">${escHtml(a.username)}</td>
                  <td>
                    <span class="badge ${a.role === 'admin' ? 'badge-critical' : 'badge-low'}" style="${a.role === 'admin' ? 'background:#e8d5f7;color:#6b2fa0;' : ''}">
                      ${a.role === 'admin' ? '🔑 Admin' : '👤 Staff'}
                    </span>
                  </td>
                  <td style="font-size:.8rem;color:var(--text-muted)">${formatDate(a.created_at)}</td>
                  <td>
                    <button class="btn btn-sm btn-danger" onclick="auditDeleteAccount('${a.id}','${escHtml(a.username)}')" ${a.username === sessionStorage.getItem('adminUsername') ? 'disabled title="Cannot delete yourself"' : ''}>Delete</button>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Login Stats Card -->
      <div class="card">
        <div class="card-title">📊 Login Overview</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:8px;">
          <div class="audit-stat-box">
            <div class="audit-stat-num">${logs.length}</div>
            <div class="audit-stat-label">Total Login Events</div>
          </div>
          <div class="audit-stat-box">
            <div class="audit-stat-num">${new Set(logs.map(l => l.username)).size}</div>
            <div class="audit-stat-label">Unique Users</div>
          </div>
          <div class="audit-stat-box">
            <div class="audit-stat-num">${logs.filter(l => l.role === 'admin').length}</div>
            <div class="audit-stat-label">Admin Logins</div>
          </div>
          <div class="audit-stat-box">
            <div class="audit-stat-num">${logs.filter(l => {
              const d = new Date(l.created_at);
              const today = new Date();
              return d.toDateString() === today.toDateString();
            }).length}</div>
            <div class="audit-stat-label">Logins Today</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Audit Log Table -->
    <div class="card">
      <div class="section-header">
        <span class="card-title" style="margin:0">🔐 Login History</span>
        <div style="display:flex;gap:8px;align-items:center;">
          <select class="form-control" style="width:130px" id="audit-role-filter" onchange="auditFilterLogs()">
            <option value="all">All Roles</option>
            <option value="admin">Admin</option>
            <option value="staff">Staff</option>
          </select>
        </div>
      </div>
      <div class="table-wrap" id="audit-log-table">
        ${renderAuditTable(logs)}
      </div>
    </div>`;

  // Store logs for filtering
  window._auditLogs = logs;
}

function renderAuditTable(logs) {
  if (!logs.length) return `<div class="empty-state" style="padding:24px"><div class="empty-state-icon">📋</div><p>No login events recorded yet.</p></div>`;
  return `
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Username</th>
          <th>Role</th>
          <th>Action</th>
          <th>IP Address</th>
          <th>Date &amp; Time</th>
        </tr>
      </thead>
      <tbody>
        ${logs.map((l, i) => `
          <tr>
            <td style="color:var(--text-muted);font-size:.8rem">${i + 1}</td>
            <td class="font-bold">${escHtml(l.username)}</td>
            <td>
              <span class="badge ${l.role === 'admin' ? '' : 'badge-low'}" style="${l.role === 'admin' ? 'background:#e8d5f7;color:#6b2fa0;' : ''}">
                ${l.role === 'admin' ? '🔑 Admin' : '👤 Staff'}
              </span>
            </td>
            <td><span class="badge badge-ok">✅ ${l.action}</span></td>
            <td style="font-family:monospace;font-size:.8rem">${escHtml(l.ip)}</td>
            <td style="font-size:.82rem;color:var(--text-muted)">${formatDateTime(l.created_at)}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

function auditFilterLogs() {
  const filter = document.getElementById('audit-role-filter')?.value || 'all';
  const logs   = window._auditLogs || [];
  const filtered = filter === 'all' ? logs : logs.filter(l => l.role === filter);
  document.getElementById('audit-log-table').innerHTML = renderAuditTable(filtered);
}

function auditShowAddAccount() {
  openModal('Add Account', `
    <div class="form-group">
      <label class="form-label">Username</label>
      <input class="form-control" type="text" id="new-acc-username" placeholder="e.g. barista01" />
    </div>
    <div class="form-group">
      <label class="form-label">Password</label>
      <input class="form-control" type="password" id="new-acc-password" placeholder="Min. 6 characters" />
    </div>
    <div class="form-group">
      <label class="form-label">Role</label>
      <select class="form-control" id="new-acc-role">
        <option value="staff">👤 Staff</option>
        <option value="admin">🔑 Admin</option>
      </select>
    </div>
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="auditCreateAccount()">Create Account</button>
    </div>`);
}

async function auditCreateAccount() {
  const username = document.getElementById('new-acc-username')?.value?.trim();
  const password = document.getElementById('new-acc-password')?.value;
  const role     = document.getElementById('new-acc-role')?.value;
  if (!username || !password) { toast('Username and password are required', 'error'); return; }
  if (password.length < 6)    { toast('Password must be at least 6 characters', 'error'); return; }
  try {
    await API.post('/auth/accounts', { username, password, role });
    toast(`Account "${username}" created!`, 'success');
    closeModal();
    initAuditLogs();
  } catch (err) { toast(err.message, 'error'); }
}

async function auditDeleteAccount(id, username) {
  if (!confirm(`Delete account "${username}"? This cannot be undone.`)) return;
  try {
    await API.delete('/auth/accounts/' + id);
    toast(`Account "${username}" deleted`, 'success');
    initAuditLogs();
  } catch (err) { toast(err.message, 'error'); }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
}
