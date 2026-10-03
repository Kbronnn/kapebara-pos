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
  const [activeStatFilter, setActiveStatFilter] = useState('all');
  const [showUniqueModal, setShowUniqueModal] = useState(false);
  const [showTodayModal, setShowTodayModal] = useState(false);

  // Add Account modal
  const [addAccOpen, setAddAccOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newConfirmPassword, setNewConfirmPassword] = useState('');
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
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
    if (newPassword !== newConfirmPassword) { toast('Passwords do not match', 'error'); return; }
    setCreating(true);
    try {
      await API.post('/auth/accounts', { username: newUsername.trim(), password: newPassword, role: newRole });
      toast(`Account "${newUsername.trim()}" created!`, 'success');
      setAddAccOpen(false);
      setNewUsername(''); setNewPassword(''); setNewConfirmPassword(''); setNewRole('staff');
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

  const todayStr = new Date().toDateString();
  const todayLogs = logs.filter(l => new Date(l.created_at).toDateString() === todayStr);
  const loginsToday = todayLogs.length;

  // Build unique users dictionary
  const uniqueUsersMap = {};
  logs.forEach(l => {
    if (!uniqueUsersMap[l.username]) {
      uniqueUsersMap[l.username] = {
        username: l.username,
        role: l.role,
        totalLogins: 0,
        todayLogins: 0,
        lastLogin: l.created_at,
        lastIp: l.ip
      };
    }
    uniqueUsersMap[l.username].totalLogins += 1;
    if (new Date(l.created_at).toDateString() === todayStr) {
      uniqueUsersMap[l.username].todayLogins += 1;
    }
    if (new Date(l.created_at) > new Date(uniqueUsersMap[l.username].lastLogin)) {
      uniqueUsersMap[l.username].lastLogin = l.created_at;
      uniqueUsersMap[l.username].lastIp = l.ip;
      uniqueUsersMap[l.username].role = l.role;
    }
  });
  const uniqueUsersList = Object.values(uniqueUsersMap).sort((a, b) => b.totalLogins - a.totalLogins);
  const uniqueUsersToday = [...new Set(todayLogs.map(l => l.username))];

  // Compute displayed logs based on stat filter and role filter
  let displayedLogs = logs;
  if (activeStatFilter === 'today') {
    displayedLogs = todayLogs;
  } else if (activeStatFilter === 'admin') {
    displayedLogs = logs.filter(l => l.role === 'admin');
  } else if (activeStatFilter === 'unique') {
    // Show the latest login entry for each unique user
    const seen = new Set();
    displayedLogs = logs.filter(l => {
      if (seen.has(l.username)) return false;
      seen.add(l.username);
      return true;
    });
  } else if (activeStatFilter && activeStatFilter !== 'all') {
    displayedLogs = logs.filter(l => l.username === activeStatFilter);
  }

  if (roleFilter !== 'all' && activeStatFilter !== 'admin') {
    displayedLogs = displayedLogs.filter(l => l.role === roleFilter);
  }

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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div className="card-title" style={{ margin: 0 }}>📊 Login Overview</div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Click cards to inspect</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '8px' }}>
            <div
              className={`audit-stat-box ${activeStatFilter === 'all' && roleFilter === 'all' ? 'active' : ''}`}
              onClick={() => { setActiveStatFilter('all'); setRoleFilter('all'); }}
              title="Click to view all login events"
            >
              <div className="audit-stat-num">{logs.length}</div>
              <div className="audit-stat-label">Total Login Events</div>
              <div className="audit-stat-hint">Show all</div>
            </div>

            <div
              className={`audit-stat-box ${activeStatFilter === 'unique' ? 'active' : ''}`}
              onClick={() => {
                setShowUniqueModal(true);
                setActiveStatFilter('unique');
              }}
              title="Click to see who the unique users are"
            >
              <div className="audit-stat-num">{uniqueUsersList.length}</div>
              <div className="audit-stat-label">Unique Users</div>
              <div className="audit-stat-hint" style={{ color: 'var(--latte)', fontWeight: 700 }}>🔍 Click to see who</div>
            </div>

            <div
              className={`audit-stat-box ${activeStatFilter === 'admin' || roleFilter === 'admin' ? 'active' : ''}`}
              onClick={() => {
                setActiveStatFilter('admin');
                setRoleFilter('admin');
              }}
              title="Click to filter admin logins"
            >
              <div className="audit-stat-num">{logs.filter(l => l.role === 'admin').length}</div>
              <div className="audit-stat-label">Admin Logins</div>
              <div className="audit-stat-hint">Filter admin</div>
            </div>

            <div
              className={`audit-stat-box ${activeStatFilter === 'today' ? 'active' : ''}`}
              onClick={() => {
                setShowTodayModal(true);
                setActiveStatFilter('today');
              }}
              title="Click to see who logged in today"
            >
              <div className="audit-stat-num" style={{ color: loginsToday > 0 ? 'var(--success)' : 'var(--espresso)' }}>{loginsToday}</div>
              <div className="audit-stat-label">Logins Today</div>
              <div className="audit-stat-hint" style={{ color: loginsToday > 0 ? 'var(--success)' : 'var(--latte)', fontWeight: 700 }}>🔍 Click to see who</div>
            </div>
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="card">
        <div className="section-header" style={{ flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span className="card-title" style={{ margin: 0 }}>🔐 Login History</span>
            {(activeStatFilter !== 'all' || roleFilter !== 'all') && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span className="badge" style={{ background: '#fdf3e3', color: 'var(--espresso)', border: '1px solid var(--border)' }}>
                  Filter: {
                    activeStatFilter === 'today' ? `📅 Today's Logins (${displayedLogs.length})` :
                    activeStatFilter === 'unique' ? `👥 Unique Users Latest Logins (${displayedLogs.length})` :
                    activeStatFilter === 'admin' ? `🔑 Admin Only (${displayedLogs.length})` :
                    `👤 User: ${activeStatFilter} (${displayedLogs.length})`
                  }
                </span>
                <button
                  className="btn btn-sm btn-secondary"
                  style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                  onClick={() => { setActiveStatFilter('all'); setRoleFilter('all'); }}
                >
                  ✕ Clear
                </button>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select
              className="form-control"
              style={{ width: '130px' }}
              value={roleFilter}
              onChange={e => {
                setRoleFilter(e.target.value);
                if (e.target.value === 'all' && activeStatFilter === 'admin') setActiveStatFilter('all');
              }}
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="staff">Staff</option>
            </select>
          </div>
        </div>
        <div className="table-wrap">
          {displayedLogs.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px' }}>
              <div className="empty-state-icon">📋</div>
              <p>No login events matching this filter.</p>
              <button
                className="btn btn-secondary btn-sm"
                style={{ marginTop: '10px' }}
                onClick={() => { setActiveStatFilter('all'); setRoleFilter('all'); }}
              >
                Reset Filter
              </button>
            </div>
          ) : (
            <table>
              <thead>
                <tr><th>#</th><th>Username</th><th>Role</th><th>Action</th><th>IP Address</th><th>Date &amp; Time</th></tr>
              </thead>
              <tbody>
                {displayedLogs.map((l, i) => (
                  <tr key={l.id || i}>
                    <td style={{ color: 'var(--text-muted)', fontSize: '.8rem' }}>{i + 1}</td>
                    <td className="font-bold">
                      <span
                        style={{ cursor: 'pointer', textDecoration: 'underline dotted' }}
                        title="Click to filter by this user"
                        onClick={() => setActiveStatFilter(l.username)}
                      >
                        {l.username}
                      </span>
                    </td>
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

      {/* Unique Users Modal */}
      {showUniqueModal && (
        <div className="modal-overlay" style={{ display: 'flex' }} onClick={e => e.target.classList.contains('modal-overlay') && setShowUniqueModal(false)}>
          <div className="modal" style={{ maxWidth: '680px' }}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">👥 Unique Users ({uniqueUsersList.length})</h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                  All accounts that have signed into the system with their login activity.
                </p>
              </div>
              <button className="modal-close" onClick={() => setShowUniqueModal(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ padding: '16px 20px' }}>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Role</th>
                      <th>Today</th>
                      <th>Total Logins</th>
                      <th>Last Seen</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uniqueUsersList.map(u => (
                      <tr key={u.username}>
                        <td className="font-bold">
                          <span style={{ fontSize: '1rem', marginRight: '6px' }}>👤</span>
                          {u.username}
                        </td>
                        <td>
                          <span className="badge" style={u.role === 'admin'
                            ? { background: '#e8d5f7', color: '#6b2fa0' }
                            : { background: '#e0f0ff', color: '#1a5276' }}>
                            {u.role === 'admin' ? '🔑 Admin' : '👤 Staff'}
                          </span>
                        </td>
                        <td>
                          {u.todayLogins > 0 ? (
                            <span style={{ color: 'var(--success)', fontWeight: 700, fontSize: '0.82rem' }}>
                              🟢 {u.todayLogins}x today
                            </span>
                          ) : (
                            <span style={{ color: '#aaa', fontSize: '0.82rem' }}>⚪ None</span>
                          )}
                        </td>
                        <td>
                          <strong style={{ color: 'var(--espresso)' }}>{u.totalLogins}</strong>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '4px' }}>times</span>
                        </td>
                        <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {formatDateTime(u.lastLogin)}
                        </td>
                        <td>
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => {
                              setActiveStatFilter(u.username);
                              setShowUniqueModal(false);
                            }}
                            title={`Filter history for ${u.username}`}
                          >
                            Filter Logs
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="modal-actions" style={{ padding: '0 20px 20px' }}>
              <button className="btn btn-secondary" onClick={() => setShowUniqueModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Logins Today Modal */}
      {showTodayModal && (
        <div className="modal-overlay" style={{ display: 'flex' }} onClick={e => e.target.classList.contains('modal-overlay') && setShowTodayModal(false)}>
          <div className="modal" style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">📅 Logins Today ({todayLogs.length})</h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                  {todayLogs.length > 0 ? (
                    <><strong>{uniqueUsersToday.length} unique user(s)</strong> logged in today: {uniqueUsersToday.join(', ')}</>
                  ) : (
                    'No logins recorded today.'
                  )}
                </p>
              </div>
              <button className="modal-close" onClick={() => setShowTodayModal(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ padding: '16px 20px' }}>
              {todayLogs.length === 0 ? (
                <div className="empty-state" style={{ padding: '30px' }}>
                  <div className="empty-state-icon">☀️</div>
                  <p>No accounts have logged in today yet.</p>
                </div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Username</th>
                        <th>Role</th>
                        <th>Time</th>
                        <th>IP Address</th>
                      </tr>
                    </thead>
                    <tbody>
                      {todayLogs.map((l, i) => (
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
                          <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                            {new Date(l.created_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </td>
                          <td style={{ fontFamily: 'monospace', fontSize: '.8rem' }}>{l.ip}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="modal-actions" style={{ padding: '0 20px 20px' }}>
              <button className="btn btn-secondary" onClick={() => setShowTodayModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

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
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input className="form-control" type={showNewPass ? 'text' : 'password'}
                      placeholder="Min. 6 characters" required value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      style={{ paddingRight: '42px', width: '100%' }}
                    />
                    <button type="button" onClick={() => setShowNewPass(!showNewPass)}
                      style={{ position: 'absolute', right: '10px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: '#888' }}>
                      {showNewPass ? '👁️' : '👁️‍🗨️'}
                    </button>
                  </div>
                  {newPassword && (
                    <div style={{ marginTop: '4px', fontSize: '0.72rem', color: newPassword.length < 6 ? '#c0392b' : newPassword.length < 10 ? '#b87c00' : '#2d7a4f', fontWeight: 600 }}>
                      {newPassword.length < 6 ? '⚠️ Too short (min 6 chars)' : newPassword.length < 10 ? '🟡 Moderate strength' : '✅ Strong password'}
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Confirm Password</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input className="form-control" type={showConfirmPass ? 'text' : 'password'}
                      placeholder="Re-enter password" required value={newConfirmPassword}
                      onChange={e => setNewConfirmPassword(e.target.value)}
                      style={{ paddingRight: '42px', width: '100%',
                        borderColor: newConfirmPassword && newConfirmPassword !== newPassword ? '#c0392b' : newConfirmPassword && newConfirmPassword === newPassword ? '#2d7a4f' : undefined }}
                    />
                    <button type="button" onClick={() => setShowConfirmPass(!showConfirmPass)}
                      style={{ position: 'absolute', right: '10px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: '#888' }}>
                      {showConfirmPass ? '👁️' : '👁️‍🗨️'}
                    </button>
                  </div>
                  {newConfirmPassword && (
                    <div style={{ marginTop: '4px', fontSize: '0.72rem', fontWeight: 600,
                      color: newConfirmPassword === newPassword ? '#2d7a4f' : '#c0392b' }}>
                      {newConfirmPassword === newPassword ? '✅ Passwords match' : '❌ Passwords do not match'}
                    </div>
                  )}
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
