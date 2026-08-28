import React, { useState, useEffect } from 'react';
import { API, toast } from '../api';

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function AuditLogs() {
  const role = sessionStorage.getItem('adminRole');
  const currentUser = sessionStorage.getItem('adminUsername');

  const [logs, setLogs] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('all');

  // Add Account modal
  const [addAccOpen, setAddAccOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('staff');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (role !== 'admin') return;
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [logsRes, accountsRes] = await Promise.all([
        API.get('/auth/audit-logs?limit=200'),
        API.get('/auth/accounts')
      ]);
      setLogs(logsRes.logs || []);
      setAccounts(accountsRes || []);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAccount = async (e) => {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword) { toast('Username and password are required', 'error'); return; }
    if (newPassword.length < 6) { toast('Password must be at least 6 characters', 'error'); return; }
    setCreating(true);
    try {
      await API.post('/auth/accounts', { username: newUsername.trim(), password: newPassword, role: newRole });
      toast(`Account "${newUsername.trim()}" created!`, 'success');
      setAddAccOpen(false);
      setNewUsername(''); setNewPassword(''); setNewRole('staff');
      loadData();
    } catch (err) { toast(err.message, 'error'); }
    finally { setCreating(false); }
  };

  const handleDeleteAccount = async (id, username) => {
    if (!window.confirm(`Delete account "${username}"? This cannot be undone.`)) return;
    try {
      await API.delete('/auth/accounts/' + id);
      toast(`Account "${username}" deleted`, 'success');
      loadData();
    } catch (err) { toast(err.message, 'error'); }
  };

  if (role !== 'admin') {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🔒</div>
        <p>Access restricted. Admin role required.</p>
      </div>
    );
  }

  if (loading) return <div className="flex-center" style={{ height: '400px' }}><div className="spinner"></div></div>;

  const filteredLogs = roleFilter === 'all' ? logs : logs.filter(l => l.role === roleFilter);
  const todayStr = new Date().toDateString();
  const loginsToday = logs.filter(l => new Date(l.created_at).toDateString() === todayStr).length;

  return (
    <div>
      {/* Top grid: Account Manager + Login Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>

        {/* Account Management */}
        <div className="card">
          <div className="section-header">
            <span className="card-title" style={{ margin: 0 }}>👥 Account Management</span>
            <button className="btn btn-primary btn-sm" onClick={() => setAddAccOpen(true)}>+ Add Account</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Username</th><th>Role</th><th>Created</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {accounts.map(a => (
                  <tr key={a.id}>
                    <td className="font-bold">{a.username}</td>
                    <td>
                      <span className="badge" style={a.role === 'admin'
                        ? { background: '#e8d5f7', color: '#6b2fa0' }
                        : { background: '#e0f0ff', color: '#1a5276' }}>
                        {a.role === 'admin' ? '🔑 Admin' : '👤 Staff'}
                      </span>
                    </td>
                    <td style={{ fontSize: '.8rem', color: 'var(--text-muted)' }}>{formatDate(a.created_at)}</td>
                    <td>
                      <button
                        className="btn btn-sm btn-danger"
                        disabled={a.username === currentUser}
                        title={a.username === currentUser ? 'Cannot delete yourself' : ''}
                        onClick={() => handleDeleteAccount(a.id, a.username)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Login Stats */}
        <div className="card">
          <div className="card-title">📊 Login Overview</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '8px' }}>
            {[
              { num: logs.length, label: 'Total Login Events' },
              { num: new Set(logs.map(l => l.username)).size, label: 'Unique Users' },
              { num: logs.filter(l => l.role === 'admin').length, label: 'Admin Logins' },
              { num: loginsToday, label: 'Logins Today' },
            ].map((stat, i) => (
              <div className="audit-stat-box" key={i}>
                <div className="audit-stat-num">{stat.num}</div>
                <div className="audit-stat-label">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="card">
        <div className="section-header">
          <span className="card-title" style={{ margin: 0 }}>🔐 Login History</span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select className="form-control" style={{ width: '130px' }} value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="staff">Staff</option>
            </select>
          </div>
        </div>
        <div className="table-wrap">
          {filteredLogs.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px' }}>
              <div className="empty-state-icon">📋</div>
              <p>No login events recorded yet.</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr><th>#</th><th>Username</th><th>Role</th><th>Action</th><th>IP Address</th><th>Date &amp; Time</th></tr>
              </thead>
              <tbody>
                {filteredLogs.map((l, i) => (
                  <tr key={l.id || i}>
                    <td style={{ color: 'var(--text-muted)', fontSize: '.8rem' }}>{i + 1}</td>
                    <td className="font-bold">{l.username}</td>
                    <td>
                      <span className="badge" style={l.role === 'admin'
                        ? { background: '#e8d5f7', color: '#6b2fa0' }
                        : { background: '#e0f0ff', color: '#1a5276' }}>
                        {l.role === 'admin' ? '🔑 Admin' : '👤 Staff'}
                      </span>
                    </td>
                    <td><span className="badge badge-ok">✅ {l.action}</span></td>
                    <td style={{ fontFamily: 'monospace', fontSize: '.8rem' }}>{l.ip}</td>
                    <td style={{ fontSize: '.82rem', color: 'var(--text-muted)' }}>{formatDateTime(l.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add Account Modal */}
      {addAccOpen && (
        <div className="modal-overlay" style={{ display: 'flex' }} onClick={e => e.target.classList.contains('modal-overlay') && setAddAccOpen(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Add Account</h2>
              <button className="modal-close" onClick={() => setAddAccOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateAccount}>
              <div className="modal-body" style={{ display: 'grid', gap: '14px' }}>
                <div className="form-group">
                  <label className="form-label">Username</label>
                  <input className="form-control" type="text" placeholder="e.g. barista01" required value={newUsername} onChange={e => setNewUsername(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <input className="form-control" type="password" placeholder="Min. 6 characters" required value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Role</label>
                  <select className="form-control" value={newRole} onChange={e => setNewRole(e.target.value)}>
                    <option value="staff">👤 Staff</option>
                    <option value="admin">🔑 Admin</option>
                  </select>
                </div>
              </div>
              <div className="modal-actions" style={{ padding: '0 20px 20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setAddAccOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={creating}>{creating ? 'Creating...' : 'Create Account'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
