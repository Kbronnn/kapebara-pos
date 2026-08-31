document.addEventListener('DOMContentLoaded', () => {
  const API_BASE = '/api';
  let currentCustomerId = null;
  let calCurrentYear = new Date().getFullYear();
  let calCurrentMonth = new Date().getMonth();

  // DOM Elements
  const welcomeMessage   = document.getElementById('welcome-message');
  const tierBadge        = document.getElementById('tier-badge');
  const pointsDisplay    = document.getElementById('points-display');
  const benefitsList     = document.getElementById('benefits-list');
  const eventsGrid       = document.getElementById('events-grid');
  const hostEventForm    = document.getElementById('host-event-form');
  const formMessage      = document.getElementById('form-message');

  const tierBenefits = {
    'Bronze': ['Free Wi-Fi', '10% off pastry on birthday'],
    'Silver': ['Free Wi-Fi', '10% off pastry on birthday', 'Free upsize on Wednesdays'],
    'Gold':   ['Free Wi-Fi', '15% off all items', 'Free upsize any day', 'Priority seating']
  };

  // Auth Views
  const landingView           = document.getElementById('landing-view');
  const authView              = document.getElementById('auth-view');
  const portalView            = document.getElementById('portal-view');
  const portalHeader          = document.getElementById('portal-header');
  const loginFormContainer    = document.getElementById('login-form-container');
  const registerFormContainer = document.getElementById('register-form-container');
  const authTitle             = document.getElementById('auth-title');
  const authMessage           = document.getElementById('auth-message');
  const logoutBtn             = document.getElementById('logout-btn');

  let shopSettings = { max_people_per_event: 30, shop_open_time: '14:00', shop_close_time: '00:00' };

  async function loadShopSettings() {
    try {
      const res = await fetch(`${API_BASE}/settings`);
      if (!res.ok) return;
      shopSettings = await res.json();

      const maxLabel = document.getElementById('host-max-guests-label');
      const hoursLabel = document.getElementById('host-hours-label');
      const guestsInput = document.getElementById('event-max');

      if (maxLabel) maxLabel.textContent = `${shopSettings.max_people_per_event} guests`;
      if (guestsInput) {
        guestsInput.max = shopSettings.max_people_per_event;
        guestsInput.placeholder = `e.g. ${Math.min(20, shopSettings.max_people_per_event)}`;
      }
      if (hoursLabel) {
        const openStr = typeof formatTime12 === 'function' ? formatTime12(shopSettings.shop_open_time) : shopSettings.shop_open_time;
        const closeStr = typeof formatTime12 === 'function' ? formatTime12(shopSettings.shop_close_time) : shopSettings.shop_close_time;
        hoursLabel.textContent = `${openStr} - ${closeStr}`;
      }
    } catch (err) {
      console.error('Failed to load shop settings', err);
    }
  }

  // ── Auth ───────────────────────────────────────────────────────────────────
  function checkAuth() {
    loadShopSettings();
    if (typeof loadMenu === 'function') loadMenu();
    const savedId = sessionStorage.getItem('customerId');
    if (savedId) {
      currentCustomerId = savedId;
      if (landingView) landingView.style.display  = 'none';
      if (authView) authView.style.display     = 'none';
      if (portalView) portalView.style.display   = 'block';
      if (portalHeader) portalHeader.style.display = 'flex';
      // Reset active tab to benefits by default
      document.querySelectorAll('.portal-tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.portal-tab-panel').forEach(p => p.classList.remove('active'));
      const ptabBenefits = document.getElementById('ptab-benefits');
      const tabBenefits = document.getElementById('tab-benefits');
      if (ptabBenefits) ptabBenefits.classList.add('active');
      if (tabBenefits) tabBenefits.classList.add('active');

      if (typeof loadCustomerInfo === 'function') loadCustomerInfo();
      if (typeof loadEvents === 'function') loadEvents();
      if (typeof loadRatings === 'function') loadRatings();
      if (typeof renderCalendar === 'function') renderCalendar();
      if (typeof checkApprovalNotifications === 'function') checkApprovalNotifications();
    } else {
      if (landingView) landingView.style.display  = 'flex';
      if (authView) authView.style.display     = 'none';
      if (portalView) portalView.style.display   = 'none';
      if (portalHeader) portalHeader.style.display = 'none';
      if (welcomeMessage) welcomeMessage.innerHTML   = '';
      if (typeof loadEvents === 'function') loadEvents();
      if (typeof loadRatings === 'function') loadRatings();
    }
  }

  checkAuth();

  // Landing nav
  document.getElementById('nav-login-btn')?.addEventListener('click', () => {
    if (landingView) landingView.style.display          = 'none';
    if (authView) authView.style.display             = 'block';
    if (portalHeader) portalHeader.style.display         = 'flex';
    if (loginFormContainer) loginFormContainer.style.display   = 'block';
    if (registerFormContainer) registerFormContainer.style.display = 'none';
    if (authTitle) authTitle.textContent = 'Customer Login';
  });

  document.getElementById('hero-join-btn')?.addEventListener('click', () => {
    if (landingView) landingView.style.display           = 'none';
    if (authView) authView.style.display              = 'block';
    if (portalHeader) portalHeader.style.display          = 'flex';
    if (loginFormContainer) loginFormContainer.style.display    = 'none';
    if (registerFormContainer) registerFormContainer.style.display = 'block';
    if (authTitle) authTitle.textContent = 'Register Account';
  });

  document.getElementById('show-register')?.addEventListener('click', (e) => {
    e.preventDefault();
    if (loginFormContainer) loginFormContainer.style.display    = 'none';
    if (registerFormContainer) registerFormContainer.style.display = 'block';
    if (authTitle) authTitle.textContent = 'Register Account';
    if (authMessage) authMessage.textContent = '';
  });

  document.getElementById('show-login')?.addEventListener('click', (e) => {
    e.preventDefault();
    if (registerFormContainer) registerFormContainer.style.display = 'none';
    if (loginFormContainer) loginFormContainer.style.display    = 'block';
    if (authTitle) authTitle.textContent = 'Customer Login';
    if (authMessage) authMessage.textContent = '';
  });

  logoutBtn?.addEventListener('click', () => {
    sessionStorage.removeItem('customerId');
    sessionStorage.removeItem('customerName');
    checkAuth();
  });

  // Login form
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email    = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const btn      = e.target.querySelector('button');
    btn.disabled   = true;
    try {
      const res  = await fetch(`${API_BASE}/customer/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      sessionStorage.setItem('customerId', data.customerId);
      sessionStorage.setItem('customerName', data.name);
      e.target.reset();
      authMessage.textContent = '';
      checkAuth();
    } catch (err) {
      authMessage.textContent = err.message;
    } finally { btn.disabled = false; }
  });

  // Register form
  document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name     = document.getElementById('reg-name').value;
    const email    = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const phone    = document.getElementById('reg-phone').value;
    const btn      = e.target.querySelector('button');
    btn.disabled   = true;
    try {
      const res  = await fetch(`${API_BASE}/customer/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, phone })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');
      sessionStorage.setItem('customerId', data.customerId);
      sessionStorage.setItem('customerName', name);
      e.target.reset();
      authMessage.textContent = '';
      checkAuth();
    } catch (err) {
      authMessage.textContent = err.message;
    } finally { btn.disabled = false; }
  });

  // ── Customer Info ──────────────────────────────────────────────────────────
  async function loadCustomerInfo() {
    try {
      const res = await fetch(`${API_BASE}/customer/info?id=${currentCustomerId}`);
      if (!res.ok) throw new Error('Failed to load customer');
      const customer = await res.json();

      welcomeMessage.innerHTML = `Welcome back, <strong>${customer.name}</strong>!`;
      tierBadge.textContent    = customer.loyalty_level;
      pointsDisplay.innerHTML  = `${customer.points} <span style="font-size: 0.4em; font-family: 'Inter', sans-serif;">Pts</span>`;

      // Display unique loyalty ID
      const lid = document.getElementById('loyalty-id-display');
      if (lid) lid.textContent = customer.unique_id || '------';

      const avatarImg = document.getElementById('user-avatar');
      if (customer.avatar_url) avatarImg.src = customer.avatar_url;

      document.getElementById('settings-name').value  = customer.name  || '';
      document.getElementById('settings-email').value = customer.email || '';
      document.getElementById('settings-birthdate').value = customer.birthdate || '';
      document.getElementById('settings-phone').value = customer.phone || '';

      if (customer.loyalty_level === 'Bronze') tierBadge.style.backgroundColor = '#cd7f32';
      if (customer.loyalty_level === 'Silver') tierBadge.style.backgroundColor = '#c0c0c0';
      if (customer.loyalty_level === 'Gold')   tierBadge.style.backgroundColor = '#ffd700';

      const benefits = tierBenefits[customer.loyalty_level] || tierBenefits['Bronze'];
      benefitsList.innerHTML = benefits.map(b => `<li>${b}</li>`).join('');
    } catch (err) {
      console.error(err);
      welcomeMessage.textContent = 'Welcome, Guest!';
    }
  }

  // ── Approval Notifications ─────────────────────────────────────────────────
  async function checkApprovalNotifications() {
    // Deprecated: Handled inside React CustomerApp notification bell
    return;
  }

  window.dismissNotification = (id, el) => {
    el.style.transition = 'opacity .3s';
    el.style.opacity    = '0';
    setTimeout(() => el.remove(), 300);
  };

  function formatDateShort(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr.split('T')[0] + 'T00:00:00');
    return d.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
  }

  // ── Menu Section ───────────────────────────────────────────────────────────
  let allMenuProducts = [];
  let menuFilter = 'all';    // 'all' | 'bestsellers' | 'special'
  let menuCatFilter = 'All';

  async function loadMenu() {
    try {
      const res = await fetch(`${API_BASE}/products`);
      if (!res.ok) return;
      allMenuProducts = await res.json();
      setupMenuControls();
      renderMenuProducts();
    } catch (err) {
      const grid = document.getElementById('menu-products-grid');
      if (grid) grid.innerHTML = `<p style="color:#999;text-align:center;grid-column:1/-1">Menu unavailable at the moment.</p>`;
      const portalGrid = document.getElementById('portal-menu-grid');
      if (portalGrid) portalGrid.innerHTML = `<p style="color:#999;text-align:center;grid-column:1/-1">Menu unavailable at the moment.</p>`;
    }
  }

  function setupMenuControls() {
    // Highlight filter cards on landing
    ['highlight-bestsellers', 'highlight-special', 'highlight-all'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('click', () => {
        document.querySelectorAll('.menu-highlight-card').forEach(c => c.classList.remove('active'));
        el.classList.add('active');
        menuFilter = id === 'highlight-bestsellers' ? 'bestsellers'
                   : id === 'highlight-special'     ? 'special'
                   :                                  'all';
        menuCatFilter = 'All';
        renderMenuProducts();
      });
    });

    // Portal menu filter pills
    const portalPills = document.querySelectorAll('.portal-menu-pill');
    portalPills.forEach(pill => {
      pill.addEventListener('click', () => {
        portalPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        menuFilter = pill.dataset.filter || 'all';
        menuCatFilter = 'All';
        renderMenuProducts();
      });
    });
  }

  function renderMenuProducts() {
    // Filter by highlight
    let products = allMenuProducts;
    if (menuFilter === 'bestsellers') products = products.filter(p => p.is_best_seller);
    if (menuFilter === 'special')     products = products.filter(p => p.is_special_edition);

    // Build category tabs from current filtered products
    const cats = ['All', ...new Set(products.map(p => p.category))];

    // Filter by category
    const displayed = menuCatFilter === 'All' ? products : products.filter(p => p.category === menuCatFilter);

    const renderGridContent = (items) => {
      if (!items.length) {
        return `<p style="color:#999;text-align:center;grid-column:1/-1;padding:40px 0">No items in this category right now.</p>`;
      }
      return items.map(p => {
        const bsTag = p.is_best_seller    ? `<span class="menu-item-badge bestseller">⭐ Best Seller</span>` : '';
        const spTag = p.is_special_edition ? `<span class="menu-item-badge special">✨ Special</span>` : '';
        const corner = (bsTag || spTag) ? `<div class="menu-badge-corner">${bsTag}${spTag}</div>` : '';
        return `
          <div class="menu-item-card">
            ${corner}
            <div class="menu-item-emoji-wrap">${p.emoji || '☕'}</div>
            <div class="menu-item-body">
              <div class="menu-item-name">${p.name}</div>
              <div class="menu-item-desc">${p.description || ''}</div>
              <div class="menu-item-footer">
                <div class="menu-item-price">₱${parseFloat(p.price).toFixed(2)}</div>
                <span style="font-size:0.72rem;color:#aaa;">${p.category}</span>
              </div>
            </div>
          </div>`;
      }).join('');
    };

    const catTabsHtml = cats.map(c => `<button class="menu-cat-tab ${c === menuCatFilter ? 'active' : ''}" onclick="window._menuSetCat('${c}')">${c}</button>`).join('');

    // Update Landing page menu if present
    const grid = document.getElementById('menu-products-grid');
    const catTabEl = document.getElementById('menu-cat-tabs');
    if (grid) grid.innerHTML = renderGridContent(displayed);
    if (catTabEl) catTabEl.innerHTML = catTabsHtml;

    // Update Portal page menu if present
    const portalGrid = document.getElementById('portal-menu-grid');
    const portalCatTabEl = document.getElementById('portal-menu-cat-tabs');
    if (portalGrid) portalGrid.innerHTML = renderGridContent(displayed);
    if (portalCatTabEl) portalCatTabEl.innerHTML = catTabsHtml;
  }

  // Expose category setter globally so inline onclick can call it
  window._menuSetCat = function(cat) {
    menuCatFilter = cat;
    renderMenuProducts();
  };

  // ── Live Shop Calendar ─────────────────────────────────────────────────────
  async function renderCalendar() {
    const container = document.getElementById('shop-calendar-container');
    if (!container) return;
    try {
      const res      = await fetch(`${API_BASE}/events/calendar`);
      const calendar = await res.json();  // { "2026-07-25": [{...}], ... }

      const today  = new Date();
      const year   = calCurrentYear;
      const month  = calCurrentMonth;

      const firstDay    = new Date(year, month, 1);
      const lastDay     = new Date(year, month + 1, 0);
      const startOffset = firstDay.getDay(); // 0=Sun
      const monthName   = firstDay.toLocaleString('en-PH', { month: 'long' });

      // Generate options for Month selector dropdown
      const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
      ];
      
      const monthOptionsHtml = monthNames.map((name, index) => 
        `<option value="${index}" ${index === month ? 'selected' : ''}>${name}</option>`
      ).join('');

      // Generate options for Year selector dropdown (current year to next 2 years)
      const currentYearNum = new Date().getFullYear();
      const yearOptionsHtml = [currentYearNum, currentYearNum + 1, currentYearNum + 2].map(yr =>
        `<option value="${yr}" ${yr === year ? 'selected' : ''}>${yr}</option>`
      ).join('');

      let html = `
        <div class="shop-calendar">
          <div class="cal-header-container">
            <div class="cal-header" style="margin: 0; text-align: left;">${monthName} ${year}</div>
            <div class="cal-controls">
              <button class="cal-nav-btn" id="cal-prev-month">◀</button>
              <select class="cal-select" id="cal-month-select">
                ${monthOptionsHtml}
              </select>
              <select class="cal-select" id="cal-year-select">
                ${yearOptionsHtml}
              </select>
              <button class="cal-nav-btn" id="cal-next-month">▶</button>
            </div>
          </div>
          <div class="cal-grid">
            <div class="cal-day-label">Sun</div>
            <div class="cal-day-label">Mon</div>
            <div class="cal-day-label">Tue</div>
            <div class="cal-day-label">Wed</div>
            <div class="cal-day-label">Thu</div>
            <div class="cal-day-label">Fri</div>
            <div class="cal-day-label">Sat</div>`;

      // Empty cells before month starts
      for (let i = 0; i < startOffset; i++) {
        html += `<div class="cal-cell cal-empty"></div>`;
      }

      for (let d = 1; d <= lastDay.getDate(); d++) {
        const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const events  = calendar[dateKey] || [];
        const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
        const isPast  = new Date(year, month, d) < new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const isBooked = events.length > 0;

        let cellClass = 'cal-cell';
        if (isToday)  cellClass += ' cal-today';
        if (isPast)   cellClass += ' cal-past';
        if (isBooked) cellClass += ' cal-booked';

        const eventDots = events.map(ev => {
          return `<div class="cal-event-dot">●</div>`;
        }).join('');

        // Build tooltip content
        let tooltipHtml = '';
        if (isBooked) {
          tooltipHtml = `
            <div class="cal-cell-tooltip">
              <div class="tooltip-title">📅 ${monthName} ${d}, ${year}</div>
              ${events.map(ev => {
                const title = ev.is_private ? '🔒 Private Event' : ev.title;
                const time = ev.preferred_time ? formatTime12(ev.preferred_time) : 'All Day';
                return `
                  <div style="margin-bottom: 6px; font-size: 0.75rem;">
                    <div class="tooltip-time">🕐 ${time}</div>
                    <div style="font-weight: 500;">${title}</div>
                  </div>
                `;
              }).join('<hr style="border-top:1px solid rgba(255,255,255,0.1); margin:4px 0;">')}
            </div>`;
        }

        html += `
          <div class="${cellClass}">
            <span class="cal-day-num">${d}</span>
            ${isBooked ? `<div class="cal-event-dots">${eventDots}</div>` : ''}
            ${isBooked ? `<div class="cal-booked-label">Booked</div>` : ''}
            ${tooltipHtml}
          </div>`;
      }

      // Pad to complete last row
      const totalCells = startOffset + lastDay.getDate();
      const remaining  = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
      for (let i = 0; i < remaining; i++) {
        html += `<div class="cal-cell cal-empty"></div>`;
      }

      html += `</div>
        <div class="cal-legend">
          <span class="cal-legend-item"><span class="cal-legend-dot booked">●</span> Booked</span>
          <span class="cal-legend-item"><span class="cal-legend-dot today">●</span> Today</span>
          <span class="cal-legend-item"><span class="cal-legend-dot past">●</span> Past</span>
        </div>
        </div>`;

      container.innerHTML = html;

      // Add event listeners for month controls
      document.getElementById('cal-prev-month').addEventListener('click', () => {
        calCurrentMonth--;
        if (calCurrentMonth < 0) {
          calCurrentMonth = 11;
          calCurrentYear--;
        }
        renderCalendar();
      });

      document.getElementById('cal-next-month').addEventListener('click', () => {
        calCurrentMonth++;
        if (calCurrentMonth > 11) {
          calCurrentMonth = 0;
          calCurrentYear++;
        }
        renderCalendar();
      });

      document.getElementById('cal-month-select').addEventListener('change', (e) => {
        calCurrentMonth = parseInt(e.target.value);
        renderCalendar();
      });

      document.getElementById('cal-year-select').addEventListener('change', (e) => {
        calCurrentYear = parseInt(e.target.value);
        renderCalendar();
      });

    } catch (err) {
      if (container) container.innerHTML = '<p style="color:var(--text-light)">Calendar unavailable.</p>';
    }
  }

  // ── Load Events ────────────────────────────────────────────────────────────
  async function loadEvents() {
    const landingEventsGrid = document.getElementById('events-grid-landing');
    try {
      const res    = await fetch(`${API_BASE}/events`);
      if (!res.ok) throw new Error('Failed to load events');
      const events = await res.json();

      const dNow = new Date();
      const todayStr = `${dNow.getFullYear()}-${String(dNow.getMonth() + 1).padStart(2, '0')}-${String(dNow.getDate()).padStart(2, '0')}`;

      const visibleEvents = events.filter(event => {
        if (event.status === 'pending_approval') return false;  // hide unapproved
        if (event.is_private) {
          // Show if the customer who booked it is the current logged-in customer
          if (!currentCustomerId || event.customer_id !== currentCustomerId) {
            return false;
          }
        }
        const dStr = event.date ? event.date.split('T')[0] : '';
        return dStr >= todayStr;
      }).sort((a, b) => {
        const keyA = `${a.date ? a.date.split('T')[0] : '9999-99-99'}T${a.preferred_time || '00:00'}`;
        const keyB = `${b.date ? b.date.split('T')[0] : '9999-99-99'}T${b.preferred_time || '00:00'}`;
        return keyA.localeCompare(keyB);
      });

      if (visibleEvents.length === 0) {
        const noEventsHtml = '<p style="text-align:center; width:100%; grid-column: 1/-1;">No upcoming events at the moment.</p>';
        if (eventsGrid)       eventsGrid.innerHTML       = noEventsHtml;
        if (landingEventsGrid) landingEventsGrid.innerHTML = noEventsHtml;
        return;
      }

      const isLoggedIn = !!sessionStorage.getItem('customerId');

      const eventsHtml = visibleEvents.map(event => {
        const dateObj      = new Date(event.date);
        const formattedDate = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        const isShop       = event.type === 'shop';
        const typeLabel    = isShop ? 'Shop Event' : 'Community Event';
        const timeLabel    = event.preferred_time ? `<div class="event-time">🕐 ${formatTime12(event.preferred_time)}</div>` : '';
        const spotsLeft    = event.max_participants - (event.participants ? event.participants.length : 0);
        const isFull       = spotsLeft <= 0;

        let btnHtml;
        if (!isLoggedIn) {
          btnHtml = `<button onclick="alert('Please login to join events!')" id="join-btn-${event.id}">Login to Join</button>`;
        } else if (isFull) {
          btnHtml = `<button disabled style="opacity:.6;cursor:not-allowed" id="join-btn-${event.id}">Event Full</button>`;
        } else {
          btnHtml = `<button onclick="joinEvent('${event.id}')" id="join-btn-${event.id}">Join</button>`;
        }

        return `
          <div class="event-card">
            <div class="event-type">${typeLabel}</div>
            <div class="event-date">${formattedDate}</div>
            ${timeLabel}
            <h3 class="event-title">${event.title}</h3>
            <p class="event-desc">${event.description || 'No description provided.'}</p>
            <p style="font-size: 0.8em; color: var(--text-light); margin-bottom: 6px;">Hosted by: ${event.host_name}</p>
            <p style="font-size: 0.8em; color: var(--text-light); margin-bottom: 15px;">
              👥 <strong>${spotsLeft}</strong> of ${event.max_participants} spots remaining
            </p>
            ${btnHtml}
          </div>`;
      }).join('');

      if (eventsGrid)        eventsGrid.innerHTML        = eventsHtml;
      if (landingEventsGrid) landingEventsGrid.innerHTML = eventsHtml;

    } catch (err) {
      console.error(err);
      if (eventsGrid)        eventsGrid.innerHTML        = '<p>Error loading events.</p>';
      if (landingEventsGrid) landingEventsGrid.innerHTML = '<p>Error loading events.</p>';
    }
  }

  function formatTime12(time24) {
    if (!time24) return '';
    const [h, m] = time24.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const hour   = h % 12 || 12;
    return `${hour}:${String(m).padStart(2, '0')} ${period}`;
  }

  // ── Join Event ─────────────────────────────────────────────────────────────
  window.joinEvent = async (eventId) => {
    const btn          = document.getElementById(`join-btn-${eventId}`);
    const participantName = prompt('Enter your name (or the name of your group representative):');
    if (participantName === null) return; // cancelled

    const originalText = btn.textContent;
    btn.textContent    = 'Joining…';
    btn.disabled       = true;

    try {
      const res  = await fetch(`${API_BASE}/events/${eventId}/join`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ customerId: currentCustomerId, participant_name: participantName.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to join event');

      btn.textContent          = 'Joined ✓';
      btn.style.backgroundColor = 'var(--success)';
      btn.style.cursor          = 'default';

      // Refresh spots count
      loadEvents();
    } catch (err) {
      alert(err.message);
      btn.textContent = originalText;
      btn.disabled    = false;
    }
  };

  // ── Host Event Submit ──────────────────────────────────────────────────────
  hostEventForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const title          = document.getElementById('event-title').value;
    const date           = document.getElementById('event-date').value;
    const preferred_time = document.getElementById('event-time').value;
    const phone          = document.getElementById('event-phone').value;
    const description    = document.getElementById('event-desc').value;
    const is_private     = document.getElementById('event-private').checked;
    const max_val        = parseInt(document.getElementById('event-max').value) || 30;
    const max_participants = Math.min(shopSettings.max_people_per_event || 30, Math.max(1, max_val));
    const btn            = hostEventForm.querySelector('button[type="submit"]');

    btn.disabled         = true;
    btn.textContent      = 'Submitting…';
    formMessage.textContent = '';

    try {
      const hostName = sessionStorage.getItem('customerName') || 'Customer';
      const res = await fetch(`${API_BASE}/events`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          title, date, preferred_time, phone, description, hostName,
          is_private, max_participants, customer_id: currentCustomerId
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed');

      formMessage.style.color = 'var(--success)';
      formMessage.innerHTML   = `
        <strong>✅ Request submitted!</strong><br>
        We'll review your event and notify you once a decision is made.
        You may check back here or wait for an update on your portal.`;
      hostEventForm.reset();
      renderCalendar(); // Refresh calendar
    } catch (err) {
      formMessage.style.color = '#c0392b';
      formMessage.textContent = err.message;
    } finally {
      btn.disabled    = false;
      btn.textContent = 'Submit Request';
    }
  });

  // ── Ratings ────────────────────────────────────────────────────────────────
  async function loadRatings() {
    const ratingsGrid = document.getElementById('ratings-display-grid');
    try {
      const res     = await fetch(`${API_BASE}/ratings`);
      if (!res.ok) throw new Error('Failed to load ratings');
      const ratings = await res.json();

      if (ratings.length === 0) {
        ratingsGrid.innerHTML = '<p style="text-align:center; width:100%;">No reviews yet. Be the first to rate us!</p>';
        return;
      }
      ratingsGrid.innerHTML = ratings.map(r => {
        const date  = new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const stars = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);
        return `
          <div class="rating-card">
            <div class="rating-stars">${stars}</div>
            <div class="rating-author">${r.customer_name}</div>
            <p class="rating-comment">"${r.comment || 'No comment provided.'}"</p>
            <div class="rating-date">${date}</div>
          </div>`;
      }).join('');
    } catch (err) {
      console.error(err);
      ratingsGrid.innerHTML = '<p>Error loading reviews.</p>';
    }
  }

  const ratingForm = document.getElementById('rating-form');
  if (ratingForm) {
    ratingForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const rating  = ratingForm.querySelector('input[name="rating"]:checked')?.value;
      const comment = document.getElementById('rating-comment').value;
      const msg     = document.getElementById('rating-message');
      const btn     = ratingForm.querySelector('button');

      if (!rating) { msg.style.color = 'red'; msg.textContent = 'Please select a star rating.'; return; }
      btn.disabled    = true;
      btn.textContent = 'Submitting…';
      try {
        const loggedInId = sessionStorage.getItem('customerId');
        const res  = await fetch(`${API_BASE}/ratings`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customerId: loggedInId || null, rating: parseInt(rating), comment })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Submission failed');
        msg.style.color = 'var(--success)';
        msg.textContent = 'Thank you for your feedback!';
        ratingForm.reset();
        loadRatings();
      } catch (err) {
        msg.style.color = 'red'; msg.textContent = err.message;
      } finally {
        btn.disabled    = false;
        btn.textContent = 'Submit Rating';
      }
    });
  }

  // ── Account Settings ───────────────────────────────────────────────────────
  const settingsForm = document.getElementById('account-settings-form');
  if (settingsForm) {
    settingsForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name        = document.getElementById('settings-name').value;
      const email       = document.getElementById('settings-email').value;
      const birthdate   = document.getElementById('settings-birthdate').value;
      const phone       = document.getElementById('settings-phone').value;
      const avatarInput = document.getElementById('settings-avatar');
      const password    = document.getElementById('settings-password').value;
      const msg         = document.getElementById('settings-message');
      const btn         = settingsForm.querySelector('button');
      btn.disabled      = true;
      btn.textContent   = 'Updating…';
      try {
        const formData = new FormData();
        if (name)      formData.append('name',      name);
        if (email)     formData.append('email',     email);
        if (birthdate !== undefined) formData.append('birthdate', birthdate);
        if (phone !== undefined)     formData.append('phone',     phone);
        if (password)  formData.append('password',  password);
        if (avatarInput.files.length > 0) formData.append('avatar', avatarInput.files[0]);

        const res  = await fetch(`${API_BASE}/customer/update?id=${currentCustomerId}`, { method: 'PUT', body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Update failed');

        msg.style.color = 'var(--success)';
        msg.textContent = 'Account details updated successfully!';
        if (password) document.getElementById('settings-password').value = '';
        loadCustomerInfo();
      } catch (err) {
        msg.style.color = 'red'; msg.textContent = err.message;
      } finally {
        btn.disabled    = false;
        btn.textContent = 'Update Account Details';
      }
    });
  }

  // Restrict all telephone/contact inputs to digits only and standardize format (0919-xxx-xxxx)
  function formatPhoneNumber(val) {
    const digits = val.replace(/\D/g, '');
    if (digits.length <= 4) {
      return digits;
    } else if (digits.length <= 7) {
      return `${digits.slice(0, 4)}-${digits.slice(4)}`;
    } else {
      return `${digits.slice(0, 4)}-${digits.slice(4, 7)}-${digits.slice(7, 11)}`;
    }
  }

  document.querySelectorAll('input[type="tel"]').forEach(input => {
    input.addEventListener('input', function() {
      this.value = formatPhoneNumber(this.value);
    });
  });

  // Portal Tab Switching
  document.querySelectorAll('.portal-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.portal-tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.portal-tab-panel').forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetId = btn.dataset.tab;
      const targetPanel = document.getElementById(targetId);
      if (targetPanel) targetPanel.classList.add('active');
    });
  });
});
