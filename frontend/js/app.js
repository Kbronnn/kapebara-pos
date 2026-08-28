/* ── SPA Router ──────────────────────────────────────────────────────────── */
const views = {
  dashboard:  { title: 'Dashboard',      init: initDashboard  },
  pos:        { title: 'Point of Sale',  init: initPOS        },
  inventory:  { title: 'Inventory',      init: initInventory   },
  forecast:   { title: 'Forecast',       init: initForecast    },
  reports:    { title: 'Reports',        init: initReports     },
  events:     { title: 'Events',         init: initEvents      },
  menu:       { title: 'Menu',           init: initMenu        },
  'audit-logs': { title: 'Audit Logs',  init: initAuditLogs   },
};

let currentView = null;

function navigateTo(viewName) {
  if (!views[viewName]) return;
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.getElementById('nav-' + viewName)?.classList.add('active');
  document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
  document.getElementById('view-' + viewName)?.classList.add('active');
  document.getElementById('page-title').textContent = views[viewName].title;
  currentView = viewName;
  views[viewName].init();
}

// Sidebar clock
function updateClock() {
  const now = new Date();
  document.getElementById('sidebar-time').textContent =
    now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
  document.getElementById('sidebar-date').textContent =
    now.toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' });
}

// ── Low-stock banner logic ────────────────────────────────────────────────────
let bannerDismissed = false;

async function checkAlerts() {
  try {
    const alerts = await API.get('/inventory/alerts');
    const badge  = document.getElementById('alert-badge');
    const top    = document.getElementById('low-stock-top');
    const cnt    = document.getElementById('low-stock-count');
    const banner = document.getElementById('low-stock-banner');
    const msg    = document.getElementById('low-stock-banner-msg');

    if (alerts.length > 0) {
      badge.style.display = 'flex';
      top.style.display   = 'flex';
      cnt.textContent     = alerts.length;

      // Build banner message
      const critical = alerts.filter(a => a.status === 'critical');
      const low      = alerts.filter(a => a.status === 'low');
      const parts    = [];
      if (critical.length) parts.push(`<strong>${critical.map(a => a.name).join(', ')}</strong> critically low`);
      if (low.length)      parts.push(`<strong>${low.map(a => a.name).join(', ')}</strong> running low`);
      msg.innerHTML = ' — ' + parts.join(' · ');

      // Show banner (unless dismissed this session load)
      if (!bannerDismissed) {
        banner.style.display = 'flex';
        banner.classList.remove('banner-hide');
        banner.classList.add('banner-show');
      }
    } else {
      badge.style.display  = 'none';
      top.style.display    = 'none';
      banner.style.display = 'none';
    }
  } catch {}
}

function dismissBanner() {
  const banner = document.getElementById('low-stock-banner');
  banner.classList.remove('banner-show');
  banner.classList.add('banner-hide');
  bannerDismissed = true;
  setTimeout(() => { banner.style.display = 'none'; }, 400);
}

// ── Role / user UI helpers ───────────────────────────────────────────────────
function applyRoleUI(role) {
  const auditNav  = document.getElementById('nav-audit-logs');
  const roleBadge = document.getElementById('sidebar-role-badge');

  // All nav items are visible for both roles — only Audit Logs is admin-only
  if (role === 'admin') {
    auditNav.style.display = 'flex';
    roleBadge.textContent  = 'Admin';
    roleBadge.style.cssText = 'font-size:.65rem;font-weight:700;padding:2px 7px;border-radius:10px;background:var(--tan);color:var(--mocha);';
  } else {
    // Staff: hide only Audit Logs; POS, Forecast, Reports are all accessible
    auditNav.style.display = 'none';
    roleBadge.textContent  = 'Staff';
    roleBadge.style.cssText = 'font-size:.65rem;font-weight:700;padding:2px 7px;border-radius:10px;background:var(--mocha-light);color:rgba(241,214,171,.7);';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Nav click handlers
  document.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      const view = el.dataset.view;
      if (!view) return;
      // Guard audit-logs for staff
      if (view === 'audit-logs' && sessionStorage.getItem('adminRole') !== 'admin') {
        toast('Access restricted to admins only', 'error');
        return;
      }
      navigateTo(view);
    });
  });

  // Low-stock top badge → jump to inventory
  document.getElementById('low-stock-top')?.addEventListener('click', () => navigateTo('inventory'));

  // Banner dismiss button
  document.getElementById('low-stock-banner-close')?.addEventListener('click', dismissBanner);

  // Modal close
  document.getElementById('modal-close-btn').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-overlay')) closeModal();
  });

  updateClock();
  setInterval(updateClock, 1000);

  // Admin Auth Logic
  const adminLoginOverlay = document.getElementById('admin-login-overlay');
  const appContent        = document.getElementById('app-content');
  const loginForm         = document.getElementById('admin-login-form');
  const loginMessage      = document.getElementById('admin-login-message');

  function checkAdminAuth() {
    const adminToken = sessionStorage.getItem('adminToken');
    if (adminToken) {
      adminLoginOverlay.style.display = 'none';
      appContent.style.display = 'flex';

      // Populate sidebar user info
      const username = sessionStorage.getItem('adminUsername') || 'unknown';
      const role     = sessionStorage.getItem('adminRole')     || 'staff';
      document.getElementById('sidebar-username').textContent = username;
      applyRoleUI(role);

      bannerDismissed = false;   // reset on each login
      checkAlerts();
      setInterval(checkAlerts, 60000);
      navigateTo('dashboard');
    } else {
      adminLoginOverlay.style.display = 'flex';
      appContent.style.display = 'none';
    }
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('admin-username').value;
    const password = document.getElementById('admin-password').value;
    const btn      = e.target.querySelector('button');
    btn.disabled   = true;
    loginMessage.textContent = '';

    try {
      const res  = await fetch('/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');

      sessionStorage.setItem('adminToken',    data.adminId);
      sessionStorage.setItem('adminUsername', data.username);
      sessionStorage.setItem('adminRole',     data.role || 'staff');
      e.target.reset();
      checkAdminAuth();
    } catch (err) {
      loginMessage.textContent = err.message;
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById('admin-logout-btn')?.addEventListener('click', () => {
    sessionStorage.removeItem('adminToken');
    sessionStorage.removeItem('adminUsername');
    sessionStorage.removeItem('adminRole');
    checkAdminAuth();
  });

  // Initial Check
  checkAdminAuth();
});
