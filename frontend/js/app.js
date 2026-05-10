/* ── SPA Router ──────────────────────────────────────────────────────────── */
const views = {
  dashboard: { title: 'Dashboard',      init: initDashboard },
  pos:       { title: 'Point of Sale',  init: initPOS       },
  inventory: { title: 'Inventory',      init: initInventory  },
  forecast:  { title: 'Forecast',       init: initForecast   },
  reports:   { title: 'Reports',        init: initReports    },
  menu:      { title: 'Menu',           init: initMenu       },
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

// Check low-stock badge
async function checkAlerts() {
  try {
    const alerts = await API.get('/inventory/alerts');
    const badge  = document.getElementById('alert-badge');
    const top    = document.getElementById('low-stock-top');
    const cnt    = document.getElementById('low-stock-count');
    if (alerts.length > 0) {
      badge.style.display = 'flex';
      top.style.display   = 'flex';
      cnt.textContent     = alerts.length;
    } else {
      badge.style.display = 'none';
      top.style.display   = 'none';
    }
  } catch {}
}

document.addEventListener('DOMContentLoaded', () => {
  // Nav click handlers
  document.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      navigateTo(el.dataset.view);
    });
  });

  // Low-stock top badge → jump to inventory
  document.getElementById('low-stock-top')?.addEventListener('click', () => navigateTo('inventory'));

  // Modal close
  document.getElementById('modal-close-btn').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-overlay')) closeModal();
  });

  updateClock();
  setInterval(updateClock, 1000);

  // Admin Auth Logic
  const adminLoginOverlay = document.getElementById('admin-login-overlay');
  const appContent = document.getElementById('app-content');
  const loginForm = document.getElementById('admin-login-form');
  const loginMessage = document.getElementById('admin-login-message');

  function checkAdminAuth() {
    const adminToken = sessionStorage.getItem('adminToken');
    if (adminToken) {
      adminLoginOverlay.style.display = 'none';
      appContent.style.display = 'flex';
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
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    loginMessage.textContent = '';

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');

      sessionStorage.setItem('adminToken', data.adminId);
      sessionStorage.setItem('adminUsername', data.username);
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
    checkAdminAuth();
  });

  // Initial Check
  checkAdminAuth();
});
