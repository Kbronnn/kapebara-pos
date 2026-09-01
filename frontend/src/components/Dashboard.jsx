import React, { useState, useEffect, useRef } from 'react';
import { API, toast, formatPHP, formatNum } from '../api';
import Chart from 'chart.js/auto';

export default function Dashboard({ navigateTo }) {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [events, setEvents] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [showOrdersModal, setShowOrdersModal] = useState(false);
  const [ordersTab, setOrdersTab] = useState('pending'); // 'pending' or 'history'
  const [ordersToday, setOrdersToday] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);
  const [portalOrders, setPortalOrders] = useState([]);

  // Settings form states
  const [maxPeople, setMaxPeople] = useState(30);
  const [maxEvents, setMaxEvents] = useState(1);
  const [openTime, setOpenTime] = useState('14:00');
  const [closeTime, setCloseTime] = useState('00:00');
  const [settingsMsg, setSettingsMsg] = useState({ text: '', type: '' });
  const [savingSettings, setSavingSettings] = useState(false);

  const salesChartRef = useRef(null);
  const ordersChartRef = useRef(null);
  const salesChartInst = useRef(null);
  const ordersChartInst = useRef(null);

  const loadData = async () => {
    try {
      const [sumData, alertData, settingsData] = await Promise.all([
        API.get('/orders/summary/today'),
        API.get('/inventory/alerts'),
        API.get('/settings')
      ]);
      setSummary(sumData);
      setAlerts(alertData);
      setSettings(settingsData);
      setMaxPeople(settingsData.max_people_per_event || 30);
      setMaxEvents(settingsData.max_concurrent_events || 1);
      setOpenTime(settingsData.shop_open_time || '14:00');
      setCloseTime(settingsData.shop_close_time || '00:00');
      setLoading(false);
    } catch (err) {
      toast('Failed to load dashboard data: ' + err.message, 'error');
      setLoading(false);
    }
  };

  const loadEvents = async () => {
    setLoadingEvents(true);
    try {
      const evData = await API.get('/events');
      setEvents(evData);
    } catch (err) {
      toast('Failed to load events: ' + err.message, 'error');
    } finally {
      setLoadingEvents(false);
    }
  };

  const loadOrdersToday = async () => {
    setLoadingOrders(true);
    try {
      const ords = await API.get('/orders/today');
      setOrdersToday(ords);
    } catch (err) {
      toast('Failed to load today\'s orders: ' + err.message, 'error');
    } finally {
      setLoadingOrders(false);
    }
  };

  const loadPortalOrders = async () => {
    try {
      const data = await API.get('/orders/portal-pending');
      setPortalOrders(data);
    } catch {}
  };

  useEffect(() => {
    loadData();
    loadEvents();
    loadPortalOrders();

    const interval = setInterval(loadPortalOrders, 5000);
    return () => clearInterval(interval);
  }, []);

  // Initialize/Update Charts
  useEffect(() => {
    if (loading || !summary) return;

    const { weekRevenue } = summary;
    const labels = weekRevenue.map(d =>
      new Date(d.day).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' })
    );
    const revenueData = weekRevenue.map(d => d.revenue);
    const ordersData = weekRevenue.map(d => d.orders);

    const chartDefaults = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 } } },
        y: { grid: { color: '#f0e8da' }, ticks: { font: { size: 11 } } }
      }
    };

    // Sales Chart
    if (salesChartInst.current) salesChartInst.current.destroy();
    if (salesChartRef.current) {
      salesChartInst.current = new Chart(salesChartRef.current, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            data: revenueData,
            backgroundColor: 'rgba(74,44,10,.75)',
            borderRadius: 6,
            borderSkipped: false
          }]
        },
        options: chartDefaults
      });
    }

    // Orders Chart
    if (ordersChartInst.current) ordersChartInst.current.destroy();
    if (ordersChartRef.current) {
      ordersChartInst.current = new Chart(ordersChartRef.current, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            data: ordersData,
            borderColor: '#8b5e3c',
            backgroundColor: 'rgba(241,214,171,.3)',
            fill: true,
            tension: 0.4,
            pointBackgroundColor: '#4a2c0a',
            pointRadius: 4
          }]
        },
        options: chartDefaults
      });
    }

    return () => {
      if (salesChartInst.current) salesChartInst.current.destroy();
      if (ordersChartInst.current) ordersChartInst.current.destroy();
    };
  }, [loading, summary]);

  const handleUpdateEventStatus = async (id, status) => {
    try {
      if (status === 'rejected') {
        await API.patch(`/events/${id}/status`, { status: 'rejected' });
        toast('Event rejected. Customer notified.', 'warning');
      } else {
        await API.patch(`/events/${id}/status`, { status });
        toast('Event approved successfully!', 'success');
      }
      loadEvents();
    } catch (err) {
      toast('Failed to update event: ' + err.message, 'error');
    }
  };

  const handleSettingsSubmit = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsMsg({ text: '', type: '' });
    try {
      await API.put('/settings', {
        max_people_per_event: parseInt(maxPeople),
        max_concurrent_events: parseInt(maxEvents),
        shop_open_time: openTime,
        shop_close_time: closeTime,
      });
      setSettingsMsg({ text: '✅ Shop settings saved!', type: 'success' });
      setTimeout(() => setSettingsMsg({ text: '', type: '' }), 3000);
    } catch (err) {
      setSettingsMsg({ text: '❌ ' + err.message, type: 'danger' });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleOpenOrdersModal = () => {
    setShowOrdersModal(true);
    setOrdersTab('pending');
    loadOrdersToday();
  };

  const handleCancelOrder = async (orderId, orderNum = '') => {
    setUpdatingOrderId(orderId);
    try {
      await API.patch(`/orders/${orderId}/status`, { status: 'cancelled' });
      setOrdersToday(prev => prev.map(o => ((o._id === orderId || o.id === orderId) ? { ...o, status: 'cancelled' } : o)));
      toast(`Order ${orderNum || ''} cancelled successfully.`, 'warning');
      loadData();
    } catch (err) {
      toast('Failed to cancel order: ' + err.message, 'error');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleUpdateOrderStatus = async (orderId, newStatus, orderNum = '') => {
    if (newStatus === 'cancelled') {
      return handleCancelOrder(orderId, orderNum);
    }
    setUpdatingOrderId(orderId);
    try {
      await API.patch(`/orders/${orderId}/status`, { status: newStatus });
      setOrdersToday(prev => prev.map(o => ((o._id === orderId || o.id === orderId) ? { ...o, status: newStatus } : o)));
      toast(`Order status updated to ${newStatus === 'completed' ? 'Done' : newStatus === 'pending' ? 'Pending' : newStatus}!`, 'success');
      loadData();
    } catch (err) {
      toast('Failed to update order status: ' + err.message, 'error');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  if (loading) {
    return <div className="flex-center" style={{ height: '400px' }}><div className="spinner"></div></div>;
  }

  const { today, topItem } = summary;
  const pendingEvents = events.filter(e => e.status === 'pending_approval');
  const approvedDates = events.filter(e => e.status === 'approved').map(e => e.date ? e.date.split('T')[0] : '');

  return (
    <div>
      {/* Pending Portal Orders Notification Banner */}
      {portalOrders.length > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, #fff3cd 0%, #ffeeba 100%)',
          border: '1.5px solid #ffe8a1',
          borderRadius: '16px',
          padding: '18px 24px',
          marginBottom: '24px',
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center',
          boxShadow: '0 6px 20px rgba(133,100,4,0.12)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ fontSize: '2.2rem' }}>📥</div>
            <div>
              <h4 style={{ margin: 0, color: '#6d4c00', fontSize: '1.1rem', fontWeight: 800 }}>
                {portalOrders.length} New Customer Portal Order{portalOrders.length > 1 ? 's' : ''} Pending!
              </h4>
              <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: '#856404', fontWeight: 500 }}>
                Latest order: <strong>{portalOrders[0].customer_name || 'Customer'}</strong> {portalOrders[0].customer_unique_id ? `(ID: ${portalOrders[0].customer_unique_id})` : ''} — ₱{parseFloat(portalOrders[0].total).toFixed(2)} ({portalOrders[0].items_summary || ''})
              </p>
            </div>
          </div>
          <button
            onClick={() => navigateTo('pos')}
            style={{
              background: '#4a2c0a',
              color: '#f1d6ab',
              border: 'none',
              borderRadius: '10px',
              padding: '12px 20px',
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: '0.9rem',
              whiteSpace: 'nowrap',
              boxShadow: '0 4px 12px rgba(74,44,10,0.2)'
            }}
          >
            Go to POS to Process & Verify →
          </button>
        </div>
      )}

      {/* KPI Grid */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon">💰</div>
          <div className="kpi-value">{formatPHP(today?.revenue || 0)}</div>
          <div className="kpi-label">Today's Revenue</div>
        </div>
        <div
          className="kpi-card kpi-card-clickable"
          onClick={handleOpenOrdersModal}
          title="Click to view today's orders"
          style={{ cursor: 'pointer', position: 'relative' }}
        >
          <div className="kpi-icon">🧾</div>
          <div className="kpi-value">{today?.total_orders || 0}</div>
          <div className="kpi-label">Orders Today</div>
          <div className="kpi-sub">Avg {formatPHP(today?.avg_order_value || 0)}/order</div>
          <div style={{ position: 'absolute', top: '10px', right: '12px', fontSize: '0.7rem', color: 'var(--text-light)', opacity: 0.7 }}>View →</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon">⭐</div>
          <div className="kpi-value" style={{ fontSize: '1.2rem' }}>{topItem ? topItem.product_name : '—'}</div>
          <div className="kpi-label">Top Seller</div>
          <div className="kpi-sub">{topItem ? `${topItem.qty} sold today` : 'No sales yet'}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon">⚠️</div>
          <div className="kpi-value" style={{ color: alerts.length > 0 ? 'var(--danger)' : 'var(--success)' }}>{alerts.length}</div>
          <div className="kpi-label">Low Stock Items</div>
          <div className="kpi-sub">{alerts.length > 0 ? alerts.map(a => a.name).slice(0, 2).join(', ') : 'All stocked!'}</div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="charts-grid">
        <div className="card">
          <div className="card-title">Revenue — Last 7 Days</div>
          <div className="chart-container" style={{ height: '200px' }}>
            <canvas ref={salesChartRef}></canvas>
          </div>
        </div>
        <div className="card">
          <div className="card-title">Orders — Last 7 Days</div>
          <div className="chart-container" style={{ height: '200px' }}>
            <canvas ref={ordersChartRef}></canvas>
          </div>
        </div>
      </div>

      {/* Low Stock Alerts Table */}
      <div className="card">
        <div className="section-header">
          <span className="card-title" style={{ margin: 0 }}>Low Stock Alerts</span>
          <button className="btn btn-secondary btn-sm" onClick={() => navigateTo('inventory')}>Manage Inventory</button>
        </div>
        {alerts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">✅</div>
            <p>All ingredients are well stocked!</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Ingredient</th>
                  <th>Current</th>
                  <th>Minimum</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((a, idx) => (
                  <tr key={idx}>
                    <td className="font-bold">{a.name}</td>
                    <td>{formatNum(a.current_stock)} {a.unit}</td>
                    <td>{formatNum(a.min_stock)} {a.unit}</td>
                    <td><span className={`badge badge-${a.status}`}>{a.status.toUpperCase()}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Event Appointment Requests */}
      <div className="card" id="event-requests-card">
        <div className="section-header">
          <span className="card-title" style={{ margin: 0 }}>📅 Event Appointment Requests</span>
          <button className="btn btn-secondary btn-sm" onClick={loadEvents} disabled={loadingEvents}>
            {loadingEvents ? 'Refreshing...' : '↻ Refresh'}
          </button>
        </div>
        <div id="event-requests-body">
          {loadingEvents ? (
            <div className="flex-center" style={{ height: '80px' }}><div className="spinner"></div></div>
          ) : pendingEvents.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🎉</div>
              <p>No pending event requests right now.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table id="event-req-table">
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Host / Customer</th>
                    <th>Phone</th>
                    <th>Proposed Date</th>
                    <th>Time</th>
                    <th>Max Guests</th>
                    <th>Private</th>
                    <th>Availability</th>
                    <th>Description</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingEvents.map((e) => {
                    const dateStr = e.date ? e.date.split('T')[0] : '—';
                    const friendly = dateStr !== '—'
                      ? new Date(dateStr + 'T00:00:00').toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
                      : '—';
                    const conflict = approvedDates.includes(dateStr);
                    const availBadge = dateStr === '—'
                      ? <span className="badge" style={{ background: '#ccc', color: '#555' }}>No Date</span>
                      : conflict
                        ? <span className="badge badge-critical" title="Another event is already approved on this date">⚠️ Conflict</span>
                        : <span className="badge badge-ok" style={{ background: '#d4edda', color: '#155724' }}>✅ Available</span>;

                    const timeDisplay = e.preferred_time
                      ? (() => {
                          const [h, m] = e.preferred_time.split(':').map(Number);
                          const p = h >= 12 ? 'PM' : 'AM';
                          return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${p}`;
                        })()
                      : '—';

                    const privateBadge = e.is_private
                      ? <span className="badge" style={{ background: '#ede7f6', color: '#512da8' }}>🔒 Private</span>
                      : <span className="badge badge-ok">🌐 Public</span>;

                    const regCount = (e.participants && e.participants.length) || (e.participant_names && e.participant_names.length) || 0;
                    const regNames = e.participant_names && e.participant_names.length ? `Registered (${e.participant_names.length}): ${e.participant_names.join(', ')}` : `${regCount} registered`;

                    return (
                      <tr key={e.id}>
                        <td className="font-bold">{e.title || '—'}</td>
                        <td>{e.host_name || '—'}</td>
                        <td style={{ fontSize: '0.85rem' }}>{e.phone || '—'}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>{friendly}</td>
                        <td style={{ whiteSpace: 'nowrap', fontWeight: 6 }}>{timeDisplay}</td>
                        <td style={{ textAlign: 'center' }} title={regNames}>
                          <span style={{ fontWeight: 700, color: 'var(--espresso, #2c1810)' }}>{regCount}</span>
                          <span style={{ color: '#888', fontSize: '0.85em' }}> / {e.max_participants || 30}</span>
                        </td>
                        <td>{privateBadge}</td>
                        <td>{availBadge}</td>
                        <td style={{ maxWidth: '180px', fontSize: '0.85rem', color: 'var(--text-light)' }}>{e.description || '—'}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <button
                            className="btn btn-primary btn-sm"
                            style={{ marginRight: '6px' }}
                            onClick={() => handleUpdateEventStatus(e.id, 'approved')}
                          >
                            ✓ Approve
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
                            onClick={() => handleUpdateEventStatus(e.id, 'rejected')}
                          >
                            ✕ Reject
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Shop Settings Card */}
      <div className="card" id="shop-settings-card">
        <div className="section-header" style={{ marginBottom: '16px' }}>
          <span className="card-title" style={{ margin: 0 }}>⚙️ Shop Settings</span>
        </div>
        <form onSubmit={handleSettingsSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <div className="form-group">
            <label className="form-label">Max People per Event</label>
            <input
              type="number"
              className="form-control"
              min="1"
              value={maxPeople}
              onChange={(e) => setMaxPeople(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Max Concurrent Events per Day</label>
            <input
              type="number"
              className="form-control"
              min="1"
              value={maxEvents}
              onChange={(e) => setMaxEvents(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Shop Open Time</label>
            <input
              type="time"
              className="form-control"
              value={openTime}
              onChange={(e) => setOpenTime(e.target.value)}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>Default: 2:00 PM</span>
          </div>
          <div className="form-group">
            <label className="form-label">Shop Close Time</label>
            <input
              type="time"
              className="form-control"
              value={closeTime}
              onChange={(e) => setCloseTime(e.target.value)}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>Default: 12:00 AM</span>
          </div>
          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
            <button type="submit" className="btn btn-primary" disabled={savingSettings}>
              {savingSettings ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
        {settingsMsg.text && (
          <div style={{ marginTop: '10px', fontSize: '0.85rem', fontWeight: 500, color: `var(--${settingsMsg.type})` }}>
            {settingsMsg.text}
          </div>
        )}
      </div>

      {/* Orders Today Modal */}
      {showOrdersModal && (
        <div className="modal-overlay" style={{ display: 'flex' }} onClick={(e) => e.target.classList.contains('modal-overlay') && setShowOrdersModal(false)}>
          <div className="modal modal-wide">
            <div className="modal-header">
              <h2 className="modal-title">📋 Orders Today</h2>
              <button className="modal-close" onClick={() => setShowOrdersModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              {loadingOrders ? (
                <div className="flex-center" style={{ height: '120px' }}><div className="spinner"></div></div>
              ) : (
                <>
                  <div className="orders-tabs">
                    <button
                      className={`orders-tab-btn ${ordersTab === 'pending' ? 'active' : ''}`}
                      onClick={() => setOrdersTab('pending')}
                    >
                      ⏳ To Be Made <span className="tab-count">{ordersToday.filter(o => o.status === 'pending' || o.status === 'processing').length}</span>
                    </button>
                    <button
                      className={`orders-tab-btn ${ordersTab === 'history' ? 'active' : ''}`}
                      onClick={() => setOrdersTab('history')}
                    >
                      ✅ Order History <span className="tab-count">{ordersToday.filter(o => o.status === 'completed').length}</span>
                    </button>
                    <button
                      className={`orders-tab-btn ${ordersTab === 'cancelled' ? 'active' : ''}`}
                      onClick={() => setOrdersTab('cancelled')}
                    >
                      ❌ Cancelled <span className="tab-count" style={{ background: ordersTab === 'cancelled' ? 'var(--danger)' : '#fde8e8', color: ordersTab === 'cancelled' ? '#fff' : '#b03a2e' }}>{ordersToday.filter(o => o.status === 'cancelled').length}</span>
                    </button>
                  </div>

                  <div className="orders-tab-panel">
                    {ordersTab === 'pending' ? (
                      renderOrdersTable(ordersToday.filter(o => o.status === 'pending' || o.status === 'processing'), 'No pending orders right now — all caught up! 🎉', 'pending')
                    ) : ordersTab === 'cancelled' ? (
                      renderOrdersTable(ordersToday.filter(o => o.status === 'cancelled'), 'No cancelled orders today.', 'cancelled')
                    ) : (
                      renderOrdersTable(ordersToday.filter(o => o.status === 'completed'), 'No completed orders yet today.', 'history')
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function renderOrdersTable(ordersList, emptyMsg, tabType) {
    if (!ordersList.length) {
      return (
        <div className="empty-state" style={{ padding: '30px 0' }}>
          <div className="empty-state-icon">{tabType === 'cancelled' ? '🚫' : '☕'}</div>
          <p>{emptyMsg}</p>
        </div>
      );
    }

    return (
      <div className="table-wrap" style={{ maxHeight: '420px', overflowY: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Time</th>
              <th>Items</th>
              <th>Payment</th>
              <th>Discount</th>
              <th>Total</th>
              <th>Status & Action</th>
            </tr>
          </thead>
          <tbody>
            {ordersList.map((o, index) => {
              const time = new Date(o.created_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
              const itemsList = o.items && o.items.length
                ? o.items.map((item, itemIdx) => {
                    let label = `${item.quantity}× ${item.product_name}`;
                    try {
                      const c = typeof item.customizations === 'string' ? JSON.parse(item.customizations || '{}') : (item.customizations || {});
                      const extras = [];
                      if (c.temperature) extras.push(c.temperature);
                      if (c.size) extras.push(c.size);
                      if (c.sugar) extras.push(c.sugar);
                      if (c.milk && c.milk !== 'Regular') extras.push(c.milk + ' milk');
                      if (c.iceCream) extras.push('+ Ice Cream');
                      if (c.drinkaddon) extras.push(`+ ${c.drinkaddon}`);
                      if (c.addons && c.addons.length) extras.push(...c.addons);
                      if (extras.length) label += ` (${extras.join(', ')})`;
                    } catch {}
                    return <div key={itemIdx}>{label}</div>;
                  })
                : '—';

              const orderId = o._id || o.id;
              const isUpdating = updatingOrderId === orderId;
              const orderYear = o.created_at ? new Date(o.created_at).getFullYear() : new Date().getFullYear();
              const orderSeqNum = String(index + 1).padStart(4, '0');
              const displayOrderNum = o.order_number || `#ORD-${orderYear}-${orderSeqNum}`;
              const isCancelled = o.status === 'cancelled';
              const isCompleted = o.status === 'completed';

              return (
                <tr key={orderId || index} style={{ opacity: isCancelled ? 0.7 : 1, background: isCancelled ? '#fffafa' : 'transparent' }}>
                  <td className="font-bold" style={{ whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: '.82rem', textDecoration: isCancelled ? 'line-through' : 'none' }}>
                    {displayOrderNum}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>{time}</td>
                  <td style={{ fontSize: '0.85rem', lineHeight: '1.6' }}>{itemsList}</td>
                  <td>{o.payment_method || 'Cash'}</td>
                  <td>{o.discount > 0 ? '−' + formatPHP(o.discount) : '—'}</td>
                  <td className="font-bold" style={{ color: isCancelled ? 'var(--danger)' : 'var(--espresso)', textDecoration: isCancelled ? 'line-through' : 'none' }}>
                    {formatPHP(o.total)}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'nowrap' }}>
                      <select
                        value={o.status || 'pending'}
                        onChange={(e) => handleUpdateOrderStatus(orderId, e.target.value, displayOrderNum)}
                        disabled={isUpdating}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '6px',
                          border: `1.5px solid ${isCancelled ? '#f5c6c6' : isCompleted ? '#c3e6cb' : 'var(--border)'}`,
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          background: isCompleted ? 'var(--success-bg, #edf7f0)' : isCancelled ? '#fdecea' : o.status === 'processing' ? '#e8f4fd' : '#fef9ec',
                          color: isCompleted ? 'var(--success)' : isCancelled ? 'var(--danger, #b03a2e)' : o.status === 'processing' ? '#0066cc' : '#b87c00',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="pending">⏳ Pending</option>
                        <option value="processing">⚙️ Processing</option>
                        <option value="completed">✅ Done</option>
                        <option value="cancelled">❌ Cancelled</option>
                      </select>

                      {!isCompleted && !isCancelled && (
                        <>
                          <button
                            className="btn btn-sm btn-success"
                            style={{ padding: '4px 10px', fontSize: '0.78rem', whiteSpace: 'nowrap' }}
                            onClick={() => handleUpdateOrderStatus(orderId, 'completed', displayOrderNum)}
                            disabled={isUpdating}
                          >
                            {isUpdating ? '...' : '✅ Mark Done'}
                          </button>
                          <button
                            className="btn btn-sm btn-danger"
                            style={{ padding: '4px 8px', fontSize: '0.78rem', whiteSpace: 'nowrap' }}
                            onClick={() => handleCancelOrder(orderId, displayOrderNum)}
                            disabled={isUpdating}
                            title="Cancel Order"
                          >
                            ❌ Cancel
                          </button>
                        </>
                      )}

                      {isCompleted && (
                        <>
                          <button
                            className="btn btn-sm btn-secondary"
                            style={{ padding: '4px 8px', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
                            onClick={() => handleUpdateOrderStatus(orderId, 'pending', displayOrderNum)}
                            disabled={isUpdating}
                            title="Revert status to Pending"
                          >
                            {isUpdating ? '...' : '↩️ To Pending'}
                          </button>
                          <button
                            className="btn btn-sm btn-danger"
                            style={{ padding: '4px 8px', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
                            onClick={() => handleCancelOrder(orderId, displayOrderNum)}
                            disabled={isUpdating}
                            title="Cancel Order"
                          >
                            ❌ Cancel
                          </button>
                        </>
                      )}

                      {isCancelled && (
                        <button
                          className="btn btn-sm btn-secondary"
                          style={{ padding: '4px 10px', fontSize: '0.75rem', whiteSpace: 'nowrap', borderColor: '#2d7a4f', color: '#2d7a4f' }}
                          onClick={() => handleUpdateOrderStatus(orderId, 'pending', displayOrderNum)}
                          disabled={isUpdating}
                          title="Restore this order to Pending"
                        >
                          {isUpdating ? '...' : '↩️ Restore'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }
}
