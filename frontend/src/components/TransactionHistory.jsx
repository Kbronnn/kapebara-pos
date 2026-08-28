import React, { useState, useEffect, useCallback } from 'react';
import { API, toast, formatPHP } from '../api';

const PERIODS = [
  { value: '1d',  label: 'Today' },
  { value: '7d',  label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: '90d', label: 'Last 90 Days' },
];

const STATUS_BADGE = {
  completed:  { bg: '#d4edda', color: '#155724', label: 'Completed' },
  pending:    { bg: '#fff3cd', color: '#856404', label: 'Pending' },
  processing: { bg: '#cce5ff', color: '#004085', label: 'Processing' },
  cancelled:  { bg: '#f8d7da', color: '#721c24', label: 'Cancelled' },
};

const SOURCE_BADGE = {
  pos:    { bg: '#e8d5b7', color: '#4a2c0a', label: 'Walk-in POS' },
  portal: { bg: '#e9d8fd', color: '#44337a', label: 'Portal' },
};

function Badge({ style, children }) {
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: '20px',
      fontSize: '0.72rem', fontWeight: 700, ...style
    }}>
      {children}
    </span>
  );
}

function formatDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatCustomizations(c) {
  if (!c || typeof c !== 'object') return null;
  const parts = [];
  if (c.temperature)  parts.push(c.temperature);
  if (c.size)         parts.push(c.size);
  if (c.sugar)        parts.push(`Sugar: ${c.sugar}`);
  if (c.milk && c.milk !== 'Regular') parts.push(`Milk: ${c.milk}`);
  if (c.iceCream)     parts.push('+ Ice Cream');
  if (c.drinkaddon)   parts.push(`+ ${c.drinkaddon}`);
  if (Array.isArray(c.addons) && c.addons.length) parts.push(...c.addons);
  return parts.length ? parts.join(' · ') : null;
}

// ── Receipt Modal ──────────────────────────────────────────────────────────────
function ReceiptModal({ order, onClose }) {
  if (!order) return null;

  const statusInfo  = STATUS_BADGE[order.status]  || STATUS_BADGE.completed;
  const sourceInfo  = SOURCE_BADGE[order.source]   || SOURCE_BADGE.pos;

  const handlePrint = () => {
    const win = window.open('', '_blank', 'width=400,height=700');
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt — ${order.order_number || order._id}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Courier New', monospace; font-size: 13px; color: #1a1a1a; padding: 20px; max-width: 340px; margin: auto; }
          .logo-row { text-align: center; margin-bottom: 8px; }
          .logo-row h2 { font-size: 1.5rem; letter-spacing: 2px; }
          .logo-row p  { font-size: 0.75rem; color: #555; }
          .divider { border: none; border-top: 1px dashed #999; margin: 10px 0; }
          .info-row { display: flex; justify-content: space-between; margin: 3px 0; }
          .items-header { font-weight: bold; margin: 6px 0 4px; font-size: 0.8rem; }
          .item-row { display: flex; justify-content: space-between; margin: 3px 0; }
          .item-name { flex: 1; }
          .item-custom { font-size: 0.7rem; color: #555; margin-left: 8px; }
          .totals { margin-top: 8px; }
          .totals .row { display: flex; justify-content: space-between; margin: 3px 0; }
          .totals .grand { font-weight: bold; font-size: 1.05rem; }
          .footer { text-align: center; margin-top: 14px; font-size: 0.75rem; color: #777; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="logo-row">
          <h2>☕ KapeBara</h2>
          <p>Coffee Shop · Official Receipt</p>
        </div>
        <hr class="divider"/>
        <div class="info-row"><span>Order #</span><span>${order.order_number || '—'}</span></div>
        <div class="info-row"><span>Date</span><span>${formatDateTime(order.created_at)}</span></div>
        <div class="info-row"><span>Source</span><span>${sourceInfo.label}</span></div>
        <div class="info-row"><span>Status</span><span>${statusInfo.label}</span></div>
        ${order.customer_name ? `<div class="info-row"><span>Customer</span><span>${order.customer_name}</span></div>` : ''}
        ${order.table_number  ? `<div class="info-row"><span>Table</span><span>${order.table_number}</span></div>` : ''}
        ${order.payment_method ? `<div class="info-row"><span>Payment</span><span>${order.payment_method}</span></div>` : ''}
        <hr class="divider"/>
        <div class="items-header">ITEMS</div>
        ${(order.items || []).map(item => {
          const custom = formatCustomizations(item.customizations);
          return `
            <div class="item-row">
              <span class="item-name">${item.product_name} x${item.quantity}</span>
              <span>${formatPHP(item.subtotal)}</span>
            </div>
            ${custom ? `<div class="item-custom">${custom}</div>` : ''}
          `;
        }).join('')}
        <hr class="divider"/>
        <div class="totals">
          <div class="row"><span>Subtotal</span><span>${formatPHP(order.subtotal || 0)}</span></div>
          ${(order.discount || 0) > 0 ? `<div class="row"><span>Discount</span><span>-${formatPHP(order.discount)}</span></div>` : ''}
          <div class="row grand"><span>TOTAL</span><span>${formatPHP(order.total || 0)}</span></div>
        </div>
        ${order.notes ? `<hr class="divider"/><div style="font-size:0.8rem;color:#555">Note: ${order.notes}</div>` : ''}
        <hr class="divider"/>
        <div class="footer">
          <p>Thank you for visiting KapeBara! ☕</p>
          <p style="margin-top:4px">Please come again</p>
        </div>
      </body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(45,27,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: '20px'
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: '#fff', borderRadius: '18px', width: '100%', maxWidth: '520px',
        maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(45,27,0,0.25)',
        display: 'flex', flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          padding: '22px 28px 16px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div>
            <h2 style={{ fontFamily: "'Playfair Display',serif", color: 'var(--espresso)', fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
              Receipt
            </h2>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              {order.order_number || `#${order._id?.slice(-6)}`}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'var(--cream)', border: 'none', borderRadius: '50%',
            width: '36px', height: '36px', fontSize: '1.1rem', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: '22px 28px', flex: 1 }}>
          {/* Meta info */}
          <div style={{
            background: 'var(--cream)', borderRadius: '12px', padding: '14px 18px',
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px'
          }}>
            {[
              ['📅 Date', formatDateTime(order.created_at)],
              ['💳 Payment', order.payment_method || '—'],
              ['📍 Source', <Badge style={{ background: SOURCE_BADGE[order.source]?.bg || '#eee', color: SOURCE_BADGE[order.source]?.color || '#333' }}>{SOURCE_BADGE[order.source]?.label || order.source}</Badge>],
              ['🔖 Status', <Badge style={{ background: statusInfo.bg, color: statusInfo.color }}>{statusInfo.label}</Badge>],
              ...(order.customer_name ? [['👤 Customer', order.customer_name]] : []),
              ...(order.table_number  ? [['🪑 Table', order.table_number]] : []),
            ].map(([label, val], i) => (
              <div key={i}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>{label}</div>
                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--espresso)' }}>{val}</div>
              </div>
            ))}
          </div>

          {/* Items */}
          <div style={{ marginBottom: '18px' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
              Order Items
            </div>
            {(order.items || []).map((item, i) => {
              const custom = formatCustomizations(item.customizations);
              return (
                <div key={i} style={{
                  padding: '10px 0', borderBottom: i < order.items.length - 1 ? '1px solid var(--border)' : 'none',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: 'var(--espresso)', fontSize: '0.9rem' }}>
                      {item.product_name} <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>×{item.quantity}</span>
                    </div>
                    {custom && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>{custom}</div>
                    )}
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '1px' }}>
                      {formatPHP(item.unit_price)} each
                    </div>
                  </div>
                  <div style={{ fontWeight: 700, color: 'var(--espresso)', fontSize: '0.95rem', marginLeft: '16px' }}>
                    {formatPHP(item.subtotal)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Totals */}
          <div style={{ background: 'var(--cream)', borderRadius: '12px', padding: '14px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>Subtotal</span>
              <span style={{ fontWeight: 600 }}>{formatPHP(order.subtotal || 0)}</span>
            </div>
            {(order.discount || 0) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: 'var(--success)', fontSize: '0.88rem' }}>Discount</span>
                <span style={{ color: 'var(--success)', fontWeight: 600 }}>-{formatPHP(order.discount)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1.5px solid var(--border)', marginTop: '6px' }}>
              <span style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--espresso)' }}>TOTAL</span>
              <span style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--espresso)' }}>{formatPHP(order.total || 0)}</span>
            </div>
          </div>

          {order.notes && (
            <div style={{ marginTop: '14px', padding: '10px 14px', background: '#fff9ec', borderRadius: '10px', fontSize: '0.83rem', color: 'var(--text-muted)', borderLeft: '3px solid var(--tan-dark)' }}>
              📝 {order.notes}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div style={{
          padding: '16px 28px', borderTop: '1px solid var(--border)',
          display: 'flex', gap: '10px', justifyContent: 'flex-end'
        }}>
          <button onClick={onClose} style={{
            padding: '9px 20px', borderRadius: '10px', border: '1.5px solid var(--border)',
            background: '#fff', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer'
          }}>
            Close
          </button>
          <button onClick={handlePrint} style={{
            padding: '9px 22px', borderRadius: '10px', border: 'none',
            background: 'var(--espresso)', color: 'var(--cream)', fontWeight: 700, fontSize: '0.88rem',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '7px',
            boxShadow: '0 4px 12px rgba(74,44,10,0.2)'
          }}>
            🖨️ Print Receipt
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main TransactionHistory Component ─────────────────────────────────────────
export default function TransactionHistory() {
  const [orders, setOrders]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [period, setPeriod]         = useState('7d');
  const [search, setSearch]         = useState('');
  const [statusFilter, setStatus]   = useState('all');
  const [sourceFilter, setSource]   = useState('all');
  const [selectedOrder, setSelected]= useState(null);
  const [page, setPage]             = useState(1);
  const PER_PAGE = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await API.get(`/orders?period=${period}&limit=500`);
      setOrders(data);
      setPage(1);
    } catch (err) {
      toast('Failed to load transactions: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const filtered = orders.filter(o => {
    const q = search.toLowerCase();
    const matchSearch = !q
      || (o.order_number || '').toLowerCase().includes(q)
      || (o.customer_name || '').toLowerCase().includes(q)
      || (o.items_summary || '').toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || o.status === statusFilter;
    const matchSource = sourceFilter === 'all' || o.source === sourceFilter;
    return matchSearch && matchStatus && matchSource;
  });

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated  = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const totalRevenue   = filtered.filter(o => o.status === 'completed').reduce((s, o) => s + (o.total || 0), 0);
  const totalCompleted = filtered.filter(o => o.status === 'completed').length;

  const openReceipt = async (order) => {
    try {
      const full = await API.get(`/orders/${order._id}`);
      setSelected(full);
    } catch {
      setSelected(order);
    }
  };

  return (
    <div style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px', minHeight: '100%' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '4px', height: '36px', background: 'var(--tan-dark)', borderRadius: '2px' }} />
          <div>
            <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: '1.7rem', fontWeight: 700, color: 'var(--espresso)', margin: 0 }}>
              Transaction History
            </h2>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              {filtered.length} records · {totalCompleted} completed · {formatPHP(totalRevenue)} revenue
            </div>
          </div>
        </div>
        <button onClick={load} style={{
          padding: '9px 18px', borderRadius: '10px', border: '1.5px solid var(--border)',
          background: '#fff', color: 'var(--espresso)', fontWeight: 600, fontSize: '0.85rem',
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
        }}>
          ↻ Refresh
        </button>
      </div>

      {/* Filters Bar */}
      <div style={{
        background: '#fff', borderRadius: '14px', padding: '16px 20px',
        display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center',
        border: '1px solid var(--border)', boxShadow: '0 2px 8px rgba(45,27,0,0.05)'
      }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1', minWidth: '200px' }}>
          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.9rem', color: 'var(--text-muted)' }}>🔍</span>
          <input
            type="text"
            placeholder="Search by order #, customer, items…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            style={{
              width: '100%', paddingLeft: '34px', paddingRight: '12px', paddingTop: '9px', paddingBottom: '9px',
              borderRadius: '10px', border: '1.5px solid var(--border)', background: 'var(--cream)',
              fontSize: '0.88rem', color: 'var(--espresso)', outline: 'none'
            }}
          />
        </div>

        {/* Period */}
        <select value={period} onChange={e => { setPeriod(e.target.value); setPage(1); }}
          style={{ padding: '9px 12px', borderRadius: '10px', border: '1.5px solid var(--border)', background: '#fff', fontSize: '0.85rem', color: 'var(--espresso)', fontWeight: 600, cursor: 'pointer' }}>
          {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>

        {/* Status */}
        <select value={statusFilter} onChange={e => { setStatus(e.target.value); setPage(1); }}
          style={{ padding: '9px 12px', borderRadius: '10px', border: '1.5px solid var(--border)', background: '#fff', fontSize: '0.85rem', color: 'var(--espresso)', fontWeight: 600, cursor: 'pointer' }}>
          <option value="all">All Statuses</option>
          <option value="completed">Completed</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="cancelled">Cancelled</option>
        </select>

        {/* Source */}
        <select value={sourceFilter} onChange={e => { setSource(e.target.value); setPage(1); }}
          style={{ padding: '9px 12px', borderRadius: '10px', border: '1.5px solid var(--border)', background: '#fff', fontSize: '0.85rem', color: 'var(--espresso)', fontWeight: 600, cursor: 'pointer' }}>
          <option value="all">All Sources</option>
          <option value="pos">Walk-in POS</option>
          <option value="portal">Customer Portal</option>
        </select>
      </div>

      {/* Table */}
      <div style={{
        background: '#fff', borderRadius: '16px', border: '1px solid var(--border)',
        boxShadow: '0 2px 12px rgba(45,27,0,0.07)', overflow: 'hidden'
      }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px' }}>
            <div className="spinner" />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🧾</div>
            <div style={{ fontWeight: 600 }}>No transactions found</div>
            <div style={{ fontSize: '0.85rem', marginTop: '4px' }}>Try adjusting your filters or date range</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: 'var(--cream)', borderBottom: '2px solid var(--border)' }}>
                  {['Order #', 'Date & Time', 'Customer', 'Items', 'Payment', 'Source', 'Status', 'Total', ''].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: 'var(--espresso)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map((order, i) => {
                  const statusInfo = STATUS_BADGE[order.status] || STATUS_BADGE.completed;
                  const sourceInfo = SOURCE_BADGE[order.source] || SOURCE_BADGE.pos;
                  return (
                    <tr key={order._id} style={{
                      borderBottom: '1px solid var(--border)',
                      background: i % 2 === 0 ? '#fff' : '#fdfaf6',
                      transition: 'background 0.12s'
                    }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--cream)'}
                      onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#fdfaf6'}
                    >
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--espresso)', whiteSpace: 'nowrap' }}>
                        {order.order_number || `#${order._id?.slice(-6)}`}
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-muted)', whiteSpace: 'nowrap', fontSize: '0.82rem' }}>
                        {formatDateTime(order.created_at)}
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--espresso)' }}>
                        {order.customer_name || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Walk-in</span>}
                      </td>
                      <td style={{ padding: '12px 16px', maxWidth: '220px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                        <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {order.items_summary || '—'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>
                        {order.payment_method || '—'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <Badge style={{ background: sourceInfo.bg, color: sourceInfo.color }}>{sourceInfo.label}</Badge>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <Badge style={{ background: statusInfo.bg, color: statusInfo.color }}>{statusInfo.label}</Badge>
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--espresso)', whiteSpace: 'nowrap' }}>
                        {formatPHP(order.total || 0)}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <button
                          onClick={() => openReceipt(order)}
                          style={{
                            padding: '6px 14px', borderRadius: '8px', border: '1.5px solid var(--tan-dark)',
                            background: '#fff', color: 'var(--espresso)', fontWeight: 600, fontSize: '0.8rem',
                            cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s'
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--espresso)'; e.currentTarget.style.color = 'var(--cream)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = 'var(--espresso)'; }}
                        >
                          🧾 View Receipt
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{
            padding: '14px 20px', borderTop: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'var(--cream)'
          }}>
            <span style={{ fontSize: '0.83rem', color: 'var(--text-muted)' }}>
              Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)} of {filtered.length}
            </span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                style={{ padding: '6px 14px', borderRadius: '8px', border: '1.5px solid var(--border)', background: '#fff', color: 'var(--espresso)', fontWeight: 600, fontSize: '0.82rem', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.4 : 1 }}
              >← Prev</button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const pg = page <= 3 ? i + 1 : page + i - 2;
                if (pg < 1 || pg > totalPages) return null;
                return (
                  <button key={pg} onClick={() => setPage(pg)} style={{ padding: '6px 12px', borderRadius: '8px', border: '1.5px solid', borderColor: pg === page ? 'var(--espresso)' : 'var(--border)', background: pg === page ? 'var(--espresso)' : '#fff', color: pg === page ? 'var(--cream)' : 'var(--espresso)', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>
                    {pg}
                  </button>
                );
              })}
              <button
                disabled={page === totalPages}
                onClick={() => setPage(p => p + 1)}
                style={{ padding: '6px 14px', borderRadius: '8px', border: '1.5px solid var(--border)', background: '#fff', color: 'var(--espresso)', fontWeight: 600, fontSize: '0.82rem', cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.4 : 1 }}
              >Next →</button>
            </div>
          </div>
        )}
      </div>

      {/* Receipt Modal */}
      {selectedOrder && <ReceiptModal order={selectedOrder} onClose={() => setSelected(null)} />}
    </div>
  );
}
