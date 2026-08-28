import React, { useState, useEffect, useCallback } from 'react';
import Dashboard from './components/Dashboard';
import POS from './components/POS';
import Inventory from './components/Inventory';
import Forecast from './components/Forecast';
import Reports from './components/Reports';
import Events from './components/Events';
import Menu from './components/Menu';
import AuditLogs from './components/AuditLogs';
import Customers from './components/Customers';
import TransactionHistory from './components/TransactionHistory';
import { API, toast } from './api';
import logoImg from '../assets/logo.jpg';

const VIEWS = {
  dashboard:    { title: 'Dashboard',           component: Dashboard },
  pos:          { title: 'Point of Sale',       component: POS },
  inventory:    { title: 'Inventory',           component: Inventory },
  forecast:     { title: 'Forecast',            component: Forecast },
  reports:      { title: 'Reports',             component: Reports },
  transactions: { title: 'Transaction History', component: TransactionHistory },
  events:       { title: 'Events',              component: Events },
  customers:    { title: 'Customers',           component: Customers },
  menu:         { title: 'Menu',                component: Menu },
  'audit-logs': { title: 'Audit Logs',          component: AuditLogs },
};

const NAV_ITEMS = [
  { view: 'dashboard',    icon: '📊', label: 'Dashboard' },
  { view: 'pos',          icon: '🛒', label: 'Point of Sale' },
  { view: 'inventory',    icon: '📦', label: 'Inventory' },
  { view: 'forecast',     icon: '🔮', label: 'Forecast' },
  { view: 'reports',      icon: '📈', label: 'Reports' },
  { view: 'transactions', icon: '🧾', label: 'Transactions' },
  { view: 'events',       icon: '📅', label: 'Events' },
  { view: 'customers',    icon: '👥', label: 'Customers' },
  { view: 'menu',         icon: '🍽️', label: 'Menu' },
  { view: 'audit-logs',   icon: '🔐', label: 'Audit Logs', adminOnly: true },
];

function useClock() {
  const [time, setTime] = useState({ time: '', date: '' });
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime({
        time: now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }),
        date: now.toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' }),
      });
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

export default function StaffApp() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(!!sessionStorage.getItem('adminToken'));
  const [username, setUsername] = useState(sessionStorage.getItem('adminUsername') || '');
  const [role, setRole] = useState(sessionStorage.getItem('adminRole') || 'staff');

  // Login form
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginMsg, setLoginMsg] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // SPA navigation
  const [currentView, setCurrentView] = useState('dashboard');

  // Low stock alerts
  const [alerts, setAlerts] = useState([]);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  const clock = useClock();

  // Check session on mount
  useEffect(() => {
    const token = sessionStorage.getItem('adminToken');
    if (token) {
      setIsAuthenticated(true);
      setUsername(sessionStorage.getItem('adminUsername') || 'unknown');
      setRole(sessionStorage.getItem('adminRole') || 'staff');
    }
  }, []);

  const [portalCount, setPortalCount] = useState(0);

  // Poll low-stock alerts and portal orders when authenticated
  const checkAlerts = useCallback(async () => {
    try {
      const data = await API.get('/inventory/alerts');
      setAlerts(data);
      if (data.length > 0 && !bannerDismissed) setShowBanner(true);
      else if (data.length === 0) setShowBanner(false);
    } catch {}
  }, [bannerDismissed]);

  const checkPortalOrders = useCallback(async () => {
    try {
      const data = await API.get('/orders/portal-pending');
      setPortalCount(data.length);
    } catch {}
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    setBannerDismissed(false);
    checkAlerts();
    checkPortalOrders();
    const id = setInterval(() => {
      checkAlerts();
      checkPortalOrders();
    }, 5000);
    return () => clearInterval(id);
  }, [isAuthenticated, checkAlerts, checkPortalOrders]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginMsg('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUser, password: loginPass }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');

      sessionStorage.setItem('adminToken', data.adminId);
      sessionStorage.setItem('adminUsername', data.username);
      sessionStorage.setItem('adminRole', data.role || 'staff');

      setUsername(data.username);
      setRole(data.role || 'staff');
      setIsAuthenticated(true);
      setLoginUser('');
      setLoginPass('');
      setCurrentView('dashboard');
    } catch (err) {
      setLoginMsg(err.message);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('adminToken');
    sessionStorage.removeItem('adminUsername');
    sessionStorage.removeItem('adminRole');
    setIsAuthenticated(false);
    setUsername('');
    setRole('staff');
    setAlerts([]);
    setShowBanner(false);
  };

  const navigateTo = (view) => {
    if (view === 'audit-logs' && role !== 'admin') {
      toast('Access restricted to admins only', 'error');
      return;
    }
    setCurrentView(view);
    setSidebarOpen(false);
  };

  const dismissBanner = () => {
    setShowBanner(false);
    setBannerDismissed(true);
  };

  // ── Login Screen ─────────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div id="admin-login-overlay">
        <div className="login-box">
          <div className="login-brand">
            <img src={logoImg} alt="KapeBara Logo" className="login-logo" />
            <h1 className="login-title">KapeBara</h1>
            <p className="login-subtitle">Staff POS System</p>
          </div>
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label">Username</label>
              <input type="text" className="form-control" required value={loginUser}
                onChange={e => setLoginUser(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input type="password" className="form-control" required value={loginPass}
                onChange={e => setLoginPass(e.target.value)} />
            </div>
            <button type="submit" className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', marginTop: '10px' }}
              disabled={loginLoading}>
              {loginLoading ? 'Logging in…' : 'Login'}
            </button>
          </form>
          {loginMsg && (
            <div style={{ marginTop: '15px', color: 'var(--danger)', textAlign: 'center', fontSize: '0.85rem', fontWeight: 500 }}>
              {loginMsg}
            </div>
          )}
        </div>

        {/* Toast container for login errors */}
        <div id="toast-container"></div>
      </div>
    );
  }

  // ── Main App ─────────────────────────────────────────────────────────────────
  const ViewComponent = VIEWS[currentView]?.component;
  const pageTitle = VIEWS[currentView]?.title || 'Dashboard';
  const criticalAlerts = alerts.filter(a => a.status === 'critical');
  const lowAlerts = alerts.filter(a => a.status === 'low');

  return (
    <div id="app-content" style={{ display: 'flex' }}>
      {/* Mobile Sidebar Backdrop */}
      <div className={`sidebar-backdrop ${sidebarOpen ? 'active' : ''}`} onClick={() => setSidebarOpen(false)} />

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`} id="sidebar">
        <div className="sidebar-brand">
          <img src={logoImg} alt="KapeBara Logo" className="brand-icon" />
          <div className="brand-text">
            <span className="brand-name">KapeBara</span>
            <span className="brand-tagline">Coffee Shop POS</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map(item => {
            if (item.adminOnly && role !== 'admin') return null;
            return (
              <a
                key={item.view}
                href="#"
                className={`nav-item ${currentView === item.view ? 'active' : ''}`}
                id={`nav-${item.view}`}
                onClick={e => { e.preventDefault(); navigateTo(item.view); }}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
                {item.view === 'inventory' && alerts.length > 0 && (
                  <span className="nav-badge" id="alert-badge">!</span>
                )}
                {item.view === 'pos' && portalCount > 0 && (
                  <span className="nav-badge" id="portal-badge" style={{ background: '#d4a373', color: '#fff', fontWeight: 800 }}>{portalCount}</span>
                )}
              </a>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-time" id="sidebar-time">{clock.time}</div>
          <div className="sidebar-date" id="sidebar-date">{clock.date}</div>
          <div id="sidebar-user-info" style={{ marginTop: '10px', padding: '8px 0', borderTop: '1px solid rgba(241,214,171,.15)' }}>
            <div style={{ fontSize: '.75rem', color: 'rgba(241,214,171,.5)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '4px' }}>
              Logged in as
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span id="sidebar-username" style={{ fontSize: '.85rem', fontWeight: 600, color: 'var(--tan)' }}>{username}</span>
              <span id="sidebar-role-badge" style={role === 'admin'
                ? { fontSize: '.65rem', fontWeight: 700, padding: '2px 7px', borderRadius: '10px', background: 'var(--tan)', color: 'var(--mocha)' }
                : { fontSize: '.65rem', fontWeight: 700, padding: '2px 7px', borderRadius: '10px', background: 'var(--mocha-light)', color: 'rgba(241,214,171,.7)' }
              }>
                {role === 'admin' ? 'Admin' : 'Staff'}
              </span>
            </div>
          </div>
          <button id="admin-logout-btn" onClick={handleLogout}
            style={{ marginTop: '12px', width: '100%', padding: '8px', background: 'transparent', border: '1px solid rgba(241,214,171,.5)', color: 'var(--tan)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', fontWeight: 600, transition: 'all 0.2s', cursor: 'pointer' }}>
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content" id="main-content">
        <header className="top-bar">
          <div className="top-bar-left" style={{ display: 'flex', alignItems: 'center' }}>
            <button className="mobile-nav-toggle" style={{ display: 'none' }} onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button>
            <h1 className="page-title" id="page-title">{pageTitle}</h1>
          </div>
          <div className="top-bar-right">
            {alerts.length > 0 && (
              <div className="top-bar-badge" id="low-stock-top" style={{ display: 'flex', cursor: 'pointer' }}
                onClick={() => navigateTo('inventory')}>
                ⚠️ <span id="low-stock-count">{alerts.length}</span> low stock
              </div>
            )}
          </div>
        </header>

        {/* Low-stock banner */}
        {showBanner && (
          <div id="low-stock-banner" className="low-stock-banner banner-show" role="alert" aria-live="polite">
            <div className="low-stock-banner-inner">
              <span className="low-stock-banner-icon">🚨</span>
              <div className="low-stock-banner-text">
                <strong>Low Stock Alert</strong>
                <span id="low-stock-banner-msg">
                  {criticalAlerts.length > 0 && <> — <strong>{criticalAlerts.map(a => a.name).join(', ')}</strong> critically low</>}
                  {criticalAlerts.length > 0 && lowAlerts.length > 0 && ' · '}
                  {lowAlerts.length > 0 && <> <strong>{lowAlerts.map(a => a.name).join(', ')}</strong> running low</>}
                </span>
              </div>
            </div>
            <button className="low-stock-banner-close" onClick={dismissBanner} aria-label="Dismiss alert">✕</button>
          </div>
        )}

        {/* View container */}
        <div id={`view-${currentView}`} className="view active">
          {ViewComponent && <ViewComponent navigateTo={navigateTo} />}
        </div>
      </main>

      {/* Toast Container */}
      <div id="toast-container"></div>
    </div>
  );
}
