let dashCharts = {};

async function initDashboard() {
  const el = document.getElementById('view-dashboard');
  el.innerHTML = `<div class="flex-center" style="height:200px"><div class="spinner"></div></div>`;
  try {
    const [summary, alerts] = await Promise.all([
      API.get('/orders/summary/today'),
      API.get('/inventory/alerts')
    ]);
    const { today, topItem, weekRevenue } = summary;

    el.innerHTML = `
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-icon">💰</div>
          <div class="kpi-value">${formatPHP(today.revenue)}</div>
          <div class="kpi-label">Today's Revenue</div>
        </div>
        <div class="kpi-card kpi-card-clickable" onclick="showOrdersTodayModal()" title="Click to view today's orders" style="cursor:pointer;position:relative">
          <div class="kpi-icon">🧾</div>
          <div class="kpi-value">${today.total_orders}</div>
          <div class="kpi-label">Orders Today</div>
          <div class="kpi-sub">Avg ${formatPHP(today.avg_order_value)}/order</div>
          <div style="position:absolute;top:10px;right:12px;font-size:0.7rem;color:var(--text-light);opacity:0.7">View →</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon">⭐</div>
          <div class="kpi-value" style="font-size:1.2rem">${topItem ? topItem.product_name : '—'}</div>
          <div class="kpi-label">Top Seller</div>
          <div class="kpi-sub">${topItem ? topItem.qty + ' sold today' : 'No sales yet'}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon">⚠️</div>
          <div class="kpi-value" style="color:${alerts.length > 0 ? 'var(--danger)' : 'var(--success)'}">${alerts.length}</div>
          <div class="kpi-label">Low Stock Items</div>
          <div class="kpi-sub">${alerts.length > 0 ? alerts.map(a => a.name).slice(0, 2).join(', ') : 'All stocked!'}</div>
        </div>
      </div>

      <div class="charts-grid">
        <div class="card">
          <div class="card-title">Revenue — Last 7 Days</div>
          <div class="chart-container"><canvas id="dash-sales-chart"></canvas></div>
        </div>
        <div class="card">
          <div class="card-title">Orders — Last 7 Days</div>
          <div class="chart-container"><canvas id="dash-orders-chart"></canvas></div>
        </div>
      </div>

      <div class="card">
        <div class="section-header">
          <span class="card-title" style="margin:0">Low Stock Alerts</span>
          <button class="btn btn-secondary btn-sm" onclick="navigateTo('inventory')">Manage Inventory</button>
        </div>
        ${alerts.length === 0
        ? '<div class="empty-state"><div class="empty-state-icon">✅</div><p>All ingredients are well stocked!</p></div>'
        : `<div class="table-wrap"><table>
              <thead><tr><th>Ingredient</th><th>Current</th><th>Minimum</th><th>Status</th></tr></thead>
              <tbody>${alerts.map(a => `
                <tr>
                  <td class="font-bold">${a.name}</td>
                  <td>${formatNum(a.current_stock)} ${a.unit}</td>
                  <td>${formatNum(a.min_stock)} ${a.unit}</td>
                  <td><span class="badge badge-${a.status}">${a.status.toUpperCase()}</span></td>
                </tr>`).join('')}
              </tbody>
            </table></div>`
      }
      </div>

      <div class="card" id="event-requests-card">
        <div class="section-header">
          <span class="card-title" style="margin:0">📅 Event Appointment Requests</span>
          <button class="btn btn-secondary btn-sm" onclick="loadEventRequests()">↻ Refresh</button>
        </div>
        <div id="event-requests-body">
          <div class="flex-center" style="height:80px"><div class="spinner"></div></div>
        </div>
      </div>`;

    // Build charts
    Object.values(dashCharts).forEach(c => c.destroy());
    dashCharts = {};

    const labels = weekRevenue.map(d => new Date(d.day).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' }));
    const revenue = weekRevenue.map(d => d.revenue);
    const orders = weekRevenue.map(d => d.orders);

    const chartDefaults = {
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 } } },
        y: { grid: { color: '#f0e8da' }, ticks: { font: { size: 11 } } }
      }
    };

    dashCharts.sales = new Chart(document.getElementById('dash-sales-chart'), {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data: revenue,
          backgroundColor: 'rgba(74,44,10,.75)',
          borderRadius: 6,
          borderSkipped: false
        }]
      },
      options: { ...chartDefaults, plugins: { ...chartDefaults.plugins } }
    });

    dashCharts.orders = new Chart(document.getElementById('dash-orders-chart'), {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data: orders,
          borderColor: '#8b5e3c',
          backgroundColor: 'rgba(241,214,171,.3)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#4a2c0a',
          pointRadius: 4
        }]
      },
      options: { ...chartDefaults }
    });

    // Load event requests after dashboard renders
    loadEventRequests();

  } catch (err) {
    el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><p>${err.message}</p></div>`;
  }
}

async function loadEventRequests() {
  const body = document.getElementById('event-requests-body');
  if (!body) return;
  body.innerHTML = `<div class="flex-center" style="height:80px"><div class="spinner"></div></div>`;

  try {
    const events = await API.get('/events');

    // Separate pending requests and already-approved dates (for conflict detection)
    const pending = events.filter(e => e.status === 'pending_approval');
    const approved = events.filter(e => e.status === 'approved').map(e => e.date ? e.date.split('T')[0] : '');

    if (pending.length === 0) {
      body.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🎉</div><p>No pending event requests right now.</p></div>`;
      return;
    }

    body.innerHTML = `<div class="table-wrap">
      <table id="event-req-table">
        <thead>
          <tr>
            <th>Event</th>
            <th>Host / Customer</th>
            <th>Proposed Date</th>
            <th>Availability</th>
            <th>Description</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${pending.map(e => {
      const dateStr = e.date ? e.date.split('T')[0] : '—';
      const friendly = dateStr !== '—'
        ? new Date(dateStr + 'T00:00:00').toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
        : '—';
      const conflict = approved.includes(dateStr);
      const availBadge = dateStr === '—'
        ? `<span class="badge" style="background:#ccc;color:#555">No Date</span>`
        : conflict
          ? `<span class="badge badge-critical" title="Another event is already approved on this date">⚠️ Conflict</span>`
          : `<span class="badge badge-ok" style="background:#d4edda;color:#155724">✅ Available</span>`;
      return `<tr>
              <td class="font-bold">${e.title || '—'}</td>
              <td>${e.host_name || '—'}</td>
              <td style="white-space:nowrap">${friendly}</td>
              <td>${availBadge}</td>
              <td style="max-width:200px;font-size:0.85rem;color:var(--text-light)">${e.description || '—'}</td>
              <td style="white-space:nowrap">
                <button class="btn btn-primary btn-sm" style="margin-right:6px" onclick="updateEventStatus(${e.id},'approved')">✓ Approve</button>
                <button class="btn btn-secondary btn-sm" style="border-color:var(--danger);color:var(--danger)" onclick="updateEventStatus(${e.id},'rejected')">✕ Reject</button>
              </td>
            </tr>`;
    }).join('')}
        </tbody>
      </table>
    </div>`;
  } catch (err) {
    body.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><p>Failed to load event requests: ${err.message}</p></div>`;
  }
}

async function updateEventStatus(id, status) {
  try {
    await API.patch(`/events/${id}/status`, { status });
    toast(`Event ${status} successfully!`, status === 'approved' ? 'success' : 'warning');
    loadEventRequests();
  } catch (err) {
    toast('Failed to update event: ' + err.message, 'error');
  }
}

/* ── Orders Today Modal ─────────────────────────────────────────────────── */
async function showOrdersTodayModal() {
  openModal('📋 Orders Today', `<div class="flex-center" style="height:120px"><div class="spinner"></div></div>`);
  // Widen the modal for the table
  document.getElementById('modal').classList.add('modal-wide');


  try {
    const orders = await API.get('/orders/today');
    const completed = orders.filter(o => o.status === 'completed');
    const pending = orders.filter(o => o.status !== 'completed');

    const modalBody = document.getElementById('modal-body');
    modalBody.innerHTML = `
      <div class="orders-tabs">
        <button class="orders-tab-btn active" id="tab-btn-history" onclick="switchOrderTab('history')">
          ✅ Order History <span class="tab-count">${completed.length}</span>
        </button>
        <button class="orders-tab-btn" id="tab-btn-pending" onclick="switchOrderTab('pending')">
          ⏳ To Be Made <span class="tab-count">${pending.length}</span>
        </button>
      </div>

      <div id="orders-tab-history" class="orders-tab-panel">
        ${renderOrdersTable(completed, 'No completed orders yet today.')}
      </div>
      <div id="orders-tab-pending" class="orders-tab-panel" style="display:none">
        ${renderOrdersTable(pending, 'No pending orders right now — all caught up! 🎉')}
      </div>
    `;
  } catch (err) {
    document.getElementById('modal-body').innerHTML =
      `<div class="empty-state"><div class="empty-state-icon">⚠️</div><p>Failed to load orders: ${err.message}</p></div>`;
  }
}

function switchOrderTab(tab) {
  document.querySelectorAll('.orders-tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.orders-tab-panel').forEach(p => p.style.display = 'none');
  document.getElementById('tab-btn-' + tab).classList.add('active');
  document.getElementById('orders-tab-' + tab).style.display = 'block';
}

function renderOrdersTable(orders, emptyMsg) {
  if (!orders.length) {
    return `<div class="empty-state" style="padding:30px 0"><div class="empty-state-icon">☕</div><p>${emptyMsg}</p></div>`;
  }

  return `<div class="table-wrap" style="max-height:420px;overflow-y:auto">
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Time</th>
          <th>Items</th>
          <th>Payment</th>
          <th>Discount</th>
          <th>Total</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${orders.map(o => {
    const time = new Date(o.created_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
    const itemsList = o.items && o.items.length
      ? o.items.map(i => {
        let label = `${i.quantity}× ${i.product_name}`;
        try {
          const c = JSON.parse(i.customizations || '{}');
          const extras = [];
          if (c.sugar) extras.push(c.sugar);
          if (c.milk && c.milk !== 'Regular') extras.push(c.milk + ' milk');
          if (c.addons && c.addons.length) extras.push(...c.addons);
          if (extras.length) label += ` <span style="font-size:0.75rem;color:var(--text-light)">(${extras.join(', ')})</span>`;
        } catch { }
        return label;
      }).join('<br>')
      : '—';
    const statusColor = o.status === 'completed' ? 'var(--success)' :
      o.status === 'pending' ? '#e6a817' : 'var(--latte)';
    const statusLabel = o.status === 'completed' ? '✅ Done' :
      o.status === 'pending' ? '⏳ Pending' : '🔄 ' + o.status;
    return `<tr>
            <td class="font-bold">#${o.id}</td>
            <td style="white-space:nowrap">${time}</td>
            <td style="font-size:0.85rem;line-height:1.6">${itemsList}</td>
            <td>${o.payment_method || 'Cash'}</td>
            <td>${o.discount > 0 ? '−' + formatPHP(o.discount) : '—'}</td>
            <td class="font-bold" style="color:var(--espresso)">${formatPHP(o.total)}</td>
            <td><span style="font-size:0.8rem;font-weight:600;color:${statusColor}">${statusLabel}</span></td>
          </tr>`;
  }).join('')}
      </tbody>
    </table>
  </div>`;
}

