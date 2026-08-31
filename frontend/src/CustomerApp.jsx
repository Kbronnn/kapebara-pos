import React, { useState, useEffect, useCallback } from 'react';
import { ProductThumb } from './components/Menu';
import logoImg from '../assets/logo.jpg';

const API_BASE = '/api';

function StarRatingPicker({ value, onChange }) {
  const [hover, setHover] = useState(0);
  return (
    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '16px' }}>
      {[1, 2, 3, 4, 5].map(star => (
        <span
          key={star}
          onClick={() => onChange(String(star))}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          style={{
            fontSize: '2.5rem',
            cursor: 'pointer',
            color: (hover || parseInt(value) || 0) >= star ? '#d4a373' : '#ddd',
            transition: 'color 0.15s ease',
            userSelect: 'none'
          }}
        >
          ★
        </span>
      ))}
    </div>
  );
}
const TIER_BENEFITS = {
  'Bronze': ['Free Wi-Fi', '10% off pastry on birthday'],
  'Silver': ['Free Wi-Fi', '10% off pastry on birthday', 'Free upsize on Wednesdays'],
  'Gold':   ['Free Wi-Fi', '15% off all items', 'Free upsize any day', 'Priority seating']
};

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function formatTime12(time24) {
  if (!time24) return '';
  const [h, m] = time24.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

function getEventDuration(startTime) {
  if (!startTime) return 3;
  const [h] = startTime.split(':').map(Number);
  // 10:00 PM (22:00) onward is limited to 1 hour due to 12:00 MN closing
  if (h >= 22 || h === 0) return 1;
  return 3;
}

function getEventEndTime(startTime, durationHours = null) {
  if (!startTime) return '';
  const dur = durationHours || getEventDuration(startTime);
  const [h, m] = startTime.split(':').map(Number);
  const totalMin = h * 60 + m + dur * 60;
  const endH = Math.floor(totalMin / 60) % 24;
  const endM = totalMin % 60;
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
}

function formatTimeRange(time24, durationHours = null) {
  if (!time24) return '';
  const dur = durationHours || getEventDuration(time24);
  const end = getEventEndTime(time24, dur);
  return `${formatTime12(time24)} – ${formatTime12(end)}`;
}

function getEventTimeStatus(ev) {
  if (!ev.date) return 'upcoming';
  const dur = ev.duration_hours || getEventDuration(ev.preferred_time);
  const dateStr = ev.date.split('T')[0];
  const [sy, sm, sd] = dateStr.split('-').map(Number);
  const [sh, smin] = (ev.preferred_time || '00:00').split(':').map(Number);
  const startDate = new Date(sy, sm - 1, sd, sh, smin, 0);
  const endDate = new Date(startDate.getTime() + dur * 60 * 60 * 1000);
  const now = new Date();

  if (now > endDate) return 'ended';
  if (now >= startDate && now <= endDate) return 'ongoing';
  return 'upcoming';
}

function formatDateShort(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr.split('T')[0] + 'T00:00:00').toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatPhoneNumber(val) {
  const digits = val.replace(/\D/g, '');
  if (digits.length <= 4) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 7)}-${digits.slice(7, 11)}`;
}

// ── Shop Calendar Component ───────────────────────────────────────────────────
function ShopCalendar({ customerId }) {
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [calendar, setCalendar] = useState({});
  const currentYear = now.getFullYear();

  useEffect(() => {
    fetch(`${API_BASE}/events/calendar`)
      .then(r => r.ok ? r.json() : {})
      .then(data => setCalendar(data))
      .catch(() => {});
  }, []);

  const firstDay = new Date(calYear, calMonth, 1);
  const lastDay  = new Date(calYear, calMonth + 1, 0);
  const startOff = firstDay.getDay();
  const monthName = firstDay.toLocaleString('en-PH', { month: 'long' });

  const cells = [];
  for (let i = 0; i < startOff; i++) cells.push({ empty: true, key: 'e' + i });
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dateKey = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const evs = calendar[dateKey] || [];
    const isToday = d === now.getDate() && calMonth === now.getMonth() && calYear === now.getFullYear();
    const isPast  = new Date(calYear, calMonth, d) < new Date(now.getFullYear(), now.getMonth(), now.getDate());
    cells.push({ d, dateKey, evs, isToday, isPast, isBooked: evs.length > 0 });
  }
  const remaining = (cells.length % 7 === 0) ? 0 : 7 - (cells.length % 7);
  for (let i = 0; i < remaining; i++) cells.push({ empty: true, key: 'r' + i });

  const prevMonth = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
    else setCalMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
    else setCalMonth(m => m + 1);
  };

  return (
    <div className="shop-calendar">
      <div className="cal-header-container">
        <div className="cal-header" style={{ margin: 0, textAlign: 'left' }}>{monthName} {calYear}</div>
        <div className="cal-controls">
          <button className="cal-nav-btn" onClick={prevMonth}>◀</button>
          <select className="cal-select" value={calMonth} onChange={e => setCalMonth(parseInt(e.target.value))}>
            {MONTH_NAMES.map((n, i) => <option key={i} value={i}>{n}</option>)}
          </select>
          <select className="cal-select" value={calYear} onChange={e => setCalYear(parseInt(e.target.value))}>
            {[currentYear, currentYear + 1, currentYear + 2].map(yr => <option key={yr} value={yr}>{yr}</option>)}
          </select>
          <button className="cal-nav-btn" onClick={nextMonth}>▶</button>
        </div>
      </div>
      <div className="cal-grid">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => <div key={d} className="cal-day-label">{d}</div>)}
        {cells.map((cell, idx) => {
          if (cell.empty) return <div key={cell.key || idx} className="cal-cell cal-empty"></div>;
          let cls = 'cal-cell';
          if (cell.isToday) cls += ' cal-today';
          if (cell.isPast)  cls += ' cal-past';
          if (cell.isBooked) cls += ' cal-booked';
          return (
            <div key={cell.d} className={cls}>
              <span className="cal-day-num">{cell.d}</span>
              {cell.isBooked && (
                <>
                  <div className="cal-event-dots">{cell.evs.map((_, i) => <div key={i} className="cal-event-dot">●</div>)}</div>
                  <div className="cal-booked-label">Booked</div>
                  <div className="cal-cell-tooltip">
                    <div className="tooltip-title">📅 {monthName} {cell.d}, {calYear}</div>
                    {cell.evs.map((ev, i) => (
                      <div key={i} style={{ marginBottom: '6px', fontSize: '0.75rem' }}>
                        <div className="tooltip-time">🕐 {ev.preferred_time ? formatTimeRange(ev.preferred_time, ev.duration_hours) : 'All Day'}</div>
                        <div style={{ fontWeight: 500 }}>{ev.is_private ? '🔒 Private Event' : ev.title}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
      <div className="cal-legend">
        <span className="cal-legend-item"><span className="cal-legend-dot booked">●</span> Booked</span>
        <span className="cal-legend-item"><span className="cal-legend-dot today">●</span> Today</span>
        <span className="cal-legend-item"><span className="cal-legend-dot past">●</span> Past</span>
      </div>
    </div>
  );
}

// ── Events Grid Component ─────────────────────────────────────────────────────
function EventsGrid({ customerId, customerName, isLoggedIn, onLoginClick }) {
  const [events, setEvents] = useState([]);
  const [joinSuccess, setJoinSuccess] = useState(null); // eventId of just-joined event
  const [joiningId, setJoiningId] = useState(null);
  const [joinError, setJoinError] = useState(null);

  const loadEvents = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/events`);
      if (!res.ok) throw new Error();
      const all = await res.json();
      const dNow = new Date();
      const todayStr = `${dNow.getFullYear()}-${String(dNow.getMonth() + 1).padStart(2, '0')}-${String(dNow.getDate()).padStart(2, '0')}`;
      const visible = all.filter(ev => {
        if (ev.status === 'pending_approval') return false;
        if (ev.is_private && (!customerId || ev.customer_id !== customerId)) return false;
        const dStr = ev.date ? ev.date.split('T')[0] : '';
        return dStr >= todayStr;
      }).sort((a, b) => {
        const keyA = `${a.date ? a.date.split('T')[0] : '9999-99-99'}T${a.preferred_time || '00:00'}`;
        const keyB = `${b.date ? b.date.split('T')[0] : '9999-99-99'}T${b.preferred_time || '00:00'}`;
        return keyA.localeCompare(keyB);
      });
      setEvents(visible);
    } catch {}
  }, [customerId]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  const handleJoin = async (eventId) => {
    // Use the logged-in customer's name automatically — no prompt needed
    const participantName = customerName || 'Guest';
    setJoiningId(eventId);
    setJoinError(null);
    setJoinSuccess(null);
    try {
      const res = await fetch(`${API_BASE}/events/${eventId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, participant_name: participantName.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to join');
      setJoinSuccess(eventId);
      setTimeout(() => setJoinSuccess(null), 4000);
      loadEvents();
    } catch (err) {
      setJoinError(err.message);
      setTimeout(() => setJoinError(null), 4000);
    } finally {
      setJoiningId(null);
    }
  };

  if (!events.length) return <p style={{ textAlign: 'center', width: '100%', gridColumn: '1/-1' }}>No upcoming events at the moment.</p>;

  return (
    <>
      {joinSuccess && (
        <div style={{
          gridColumn: '1/-1',
          background: '#e8f5e9',
          border: '1.5px solid #a5d6a7',
          borderRadius: '12px',
          padding: '14px 20px',
          color: '#2e7d32',
          fontWeight: 600,
          fontSize: '0.95rem',
          marginBottom: '8px'
        }}>
          ✅ You've successfully joined the event! Your name ({customerName}) has been registered.
        </div>
      )}
      {joinError && (
        <div style={{
          gridColumn: '1/-1',
          background: '#fdecea',
          border: '1.5px solid #f5c6c6',
          borderRadius: '12px',
          padding: '14px 20px',
          color: '#c62828',
          fontWeight: 600,
          fontSize: '0.95rem',
          marginBottom: '8px'
        }}>
          ❌ {joinError}
        </div>
      )}
      {events.map(ev => {
        const spotsLeft = ev.max_participants - (ev.participants ? ev.participants.length : 0);
        const isFull = spotsLeft <= 0;
        const isJoining = joiningId === ev.id;
        const alreadyJoined = joinSuccess === ev.id;
        const dur = ev.duration_hours || getEventDuration(ev.preferred_time);
        const timeStatus = getEventTimeStatus(ev);
        const isOngoing = timeStatus === 'ongoing';
        const isEnded = timeStatus === 'ended';

        return (
          <div className="event-card" key={ev.id} style={isEnded ? { opacity: 0.75 } : {}}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div className="event-type">{ev.type === 'shop' ? 'Shop Event' : 'Community Event'}</div>
              {isOngoing && <span style={{ background: '#fff3cd', color: '#856404', padding: '2px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 700 }}>● Live Now</span>}
              {isEnded && <span style={{ background: '#e0e0e0', color: '#666', padding: '2px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 700 }}>Concluded</span>}
            </div>
            <div className="event-date">{new Date(ev.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
            {ev.preferred_time && (
              <div className="event-time">
                🕐 {formatTimeRange(ev.preferred_time, dur)} <span style={{ fontSize: '0.8em', color: 'var(--text-light)' }}>({dur} {dur === 1 ? 'hr' : 'hrs'})</span>
              </div>
            )}
            <h3 className="event-title">{ev.title}</h3>
            <p className="event-desc">{ev.description || 'No description provided.'}</p>
            <p style={{ fontSize: '0.8em', color: 'var(--text-light)', marginBottom: '6px' }}>Hosted by: {ev.host_name}</p>
            <p style={{ fontSize: '0.8em', color: 'var(--text-light)', marginBottom: '15px' }}>
              👥 <strong>{spotsLeft}</strong> of {ev.max_participants} spots remaining
            </p>
            {isEnded
              ? <button disabled style={{ opacity: .6, cursor: 'not-allowed', background: '#ccc', color: '#555' }}>Event Ended</button>
              : !isLoggedIn
              ? <button onClick={onLoginClick} id={`join-btn-${ev.id}`}>Login to Join</button>
              : isFull
              ? <button disabled style={{ opacity: .6, cursor: 'not-allowed' }}>Event Full</button>
              : alreadyJoined
              ? <button disabled style={{ background: '#a5d6a7', color: '#1b5e20', cursor: 'default', opacity: 1 }}>✅ Joined!</button>
              : <button onClick={() => handleJoin(ev.id)} id={`join-btn-${ev.id}`} disabled={isJoining}>
                  {isJoining ? 'Joining…' : 'Join'}
                </button>
            }
          </div>
        );
      })}
    </>
  );
}

// ── My Events List Component ──────────────────────────────────────────────────
function MyEventsList({ customerId, customerName }) {
  const [myEvents, setMyEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadMyEvents = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/events`);
      if (!res.ok) throw new Error();
      const all = await res.json();
      const filtered = all.filter(ev =>
        // Match by customer_id (events created through portal)
        (customerId && ev.customer_id === customerId) ||
        // OR match by host_name (events created by admin/staff on behalf of customer)
        (customerName && ev.host_name && ev.host_name.trim().toLowerCase() === customerName.trim().toLowerCase())
      );
      // Deduplicate in case both conditions match the same event
      const seen = new Set();
      const unique = filtered.filter(ev => { if (seen.has(ev._id || ev.id)) return false; seen.add(ev._id || ev.id); return true; });
      const dNow = new Date();
      const todayStr = `${dNow.getFullYear()}-${String(dNow.getMonth() + 1).padStart(2, '0')}-${String(dNow.getDate()).padStart(2, '0')}`;
      const getSortKey = (e) => {
        const dateStr = e.date ? e.date.split('T')[0] : '9999-99-99';
        const timeStr = e.preferred_time || '00:00';
        return `${dateStr}T${timeStr}`;
      };
      const upcoming = unique.filter(e => (e.date ? e.date.split('T')[0] : '') >= todayStr).sort((a, b) => getSortKey(a).localeCompare(getSortKey(b)));
      const pastArr  = unique.filter(e => (e.date ? e.date.split('T')[0] : '') < todayStr).sort((a, b) => getSortKey(b).localeCompare(getSortKey(a)));
      setMyEvents([...upcoming, ...pastArr]);
    } catch {}
    finally { setLoading(false); }
  }, [customerId, customerName]);

  useEffect(() => {
    if (customerId || customerName) loadMyEvents();
  }, [customerId, customerName, loadMyEvents]);

  if (loading) return <p style={{ color: '#aaa', fontSize: '0.9rem' }}>Loading your events...</p>;
  if (!myEvents.length) return <p style={{ color: '#aaa', fontSize: '0.9rem' }}>You haven't requested any events yet.</p>;

  return (
    <div style={{ display: 'grid', gap: '14px', marginTop: '10px' }}>
      {myEvents.map(ev => {
        const isApproved = ev.status === 'approved' || ev.status === 'upcoming';
        const isPending = ev.status === 'pending_approval';
        const isRejected = ev.status === 'rejected';

        let statusText = 'Pending Approval';
        let statusStyle = { background: '#fff3cd', color: '#856404' };
        if (isApproved) {
          statusText = 'Approved';
          statusStyle = { background: '#d4edda', color: '#155724' };
        } else if (isRejected) {
          statusText = 'Rejected';
          statusStyle = { background: '#f8d7da', color: '#721c24' };
        }

        return (
          <div key={ev.id} className="event-card" style={{
            background: '#fff',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '16px',
            boxShadow: 'var(--shadow)',
            display: 'block'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <h4 style={{ margin: 0, fontFamily: "'Playfair Display', serif", fontSize: '1.05rem', color: 'var(--espresso)', fontWeight: 700 }}>{ev.title}</h4>
              <span style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: '20px',
                ...statusStyle
              }}>
                {statusText}
              </span>
            </div>
            <p style={{ margin: '4px 0', fontSize: '0.82rem', color: 'var(--text-light)' }}>
              📅 {new Date(ev.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              {ev.preferred_time && ` • 🕐 ${formatTimeRange(ev.preferred_time, ev.duration_hours || getEventDuration(ev.preferred_time))}`}
            </p>
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px', fontSize: '0.75rem' }}>
              <span style={{
                background: ev.is_private ? '#efe5dc' : '#e3f2fd',
                color: ev.is_private ? '#5d4037' : '#0d47a1',
                padding: '2px 8px',
                borderRadius: '4px',
                fontWeight: 600
              }}>
                {ev.is_private ? '🔒 Private' : '🔓 Public'}
              </span>
              <span style={{ color: 'var(--text-light)', fontWeight: 500 }}>
                👥 {ev.max_participants} max guests
              </span>
            </div>
            {ev.description && (
              <p style={{ margin: '10px 0 0', fontSize: '0.78rem', color: '#777', borderTop: '1px solid #eee', paddingTop: '8px', fontStyle: 'italic' }}>
                "{ev.description}"
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main Customer App ─────────────────────────────────────────────────────────
export default function CustomerApp() {
  // Auth state
  const [customerId, setCustomerId] = useState(null);
  const [customerName, setCustomerName] = useState('');
  const [view, setView] = useState('landing'); // 'landing' | 'auth' | 'portal'
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register'
  const [authMsg, setAuthMsg] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Login fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');

  // Register fields
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPass, setRegPass] = useState('');
  const [regPhone, setRegPhone] = useState('');

  // Customer profile
  const [customer, setCustomer] = useState(null);
  const [notifications, setNotifications] = useState([]);

  // Menu state
  const [menuProducts, setMenuProducts] = useState([]);
  const [menuFilter, setMenuFilter] = useState('all');
  const [menuCatFilter, setMenuCatFilter] = useState('All');

  // Ratings
  const [ratings, setRatings] = useState([]);
  const [ratingValue, setRatingValue] = useState('');
  const [ratingComment, setRatingComment] = useState('');
  const [ratingMsg, setRatingMsg] = useState('');
  const [ratingLoading, setRatingLoading] = useState(false);

  // Host event form
  const [shopSettings, setShopSettings] = useState({ max_people_per_event: 30 });
  const [hostForm, setHostForm] = useState({ title: '', date: '', time: '14:00', phone: '', desc: '', isPrivate: false, maxGuests: 20 });
  const [hostMsg, setHostMsg] = useState({ text: '', color: '' });
  const [hostSubmitting, setHostSubmitting] = useState(false);

  // Account settings
  const [settForm, setSettForm] = useState({ name: '', email: '', phone: '', birthdate: '', password: '' });
  const [settMsg, setSettMsg] = useState('');
  const [settLoading, setSettLoading] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);

  // Portal tabs
  const [activeTab, setActiveTab] = useState('tab-benefits');

  // Portal ordering cart
  const [portalCart, setPortalCart] = useState([]);
  const [portalOrderMsg, setPortalOrderMsg] = useState('');
  const [portalOrderLoading, setPortalOrderLoading] = useState(false);
  const [myOrders, setMyOrders] = useState([]);
  const [myOrdersLoading, setMyOrdersLoading] = useState(false);

  // Customization modal states
  const [custModalOpen, setCustModalOpen] = useState(false);
  const [customizingProduct, setCustomizingProduct] = useState(null);
  const [custTemp, setCustTemp] = useState('Cold');
  const [custSugar, setCustSugar] = useState('100%');
  const [custMilk, setCustMilk] = useState('Whole');
  const [custIceCream, setCustIceCream] = useState(false);
  const [custDrinkAddon, setCustDrinkAddon] = useState('None');
  const [custAddons, setCustAddons] = useState([]);

  // ── Initial auth check & real-time stock polling ─────────────────────────────
  useEffect(() => {
    const savedId = sessionStorage.getItem('customerId');
    if (savedId) {
      setCustomerId(savedId);
      setCustomerName(sessionStorage.getItem('customerName') || '');
      setView('portal');
    }
    loadMenuProducts();
    loadRatings();
    loadShopSettings();

    // Poll real-time stock & menu products every 5 seconds
    const interval = setInterval(loadMenuProducts, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (customerId && view === 'portal') {
      loadCustomerInfo();
      loadApprovalNotifications();
    }
  }, [customerId, view]);

  // ── Loaders ───────────────────────────────────────────────────────────────
  const loadShopSettings = async () => {
    try {
      const res = await fetch(`${API_BASE}/settings`);
      if (res.ok) setShopSettings(await res.json());
    } catch {}
  };

  const loadMenuProducts = async () => {
    try {
      const [prodRes, invRes] = await Promise.all([
        fetch(`${API_BASE}/products`),
        fetch(`${API_BASE}/inventory`)
      ]);
      if (prodRes.ok && invRes.ok) {
        const productsData = await prodRes.json();
        const inventoryData = await invRes.json();

        const stockMap = {};
        inventoryData.forEach(item => {
          stockMap[item.id] = item.current_stock;
        });

        productsData.forEach(prod => {
          let isOut = false;
          if (prod.ingredients && prod.ingredients.length > 0) {
            prod.ingredients.forEach(ing => {
              const currentStock = stockMap[ing.ingredient_id] ?? 0;
              if (currentStock <= 0) {
                isOut = true;
              }
            });
          }
          prod.isOutOfStock = isOut;
        });

        setMenuProducts(productsData);
      }
    } catch {}
  };

  const loadRatings = async () => {
    try {
      const res = await fetch(`${API_BASE}/ratings`);
      if (res.ok) setRatings(await res.json());
    } catch {}
  };

  const loadCustomerInfo = async () => {
    try {
      const res = await fetch(`${API_BASE}/customer/info?id=${customerId}`);
      if (!res.ok) return;
      const data = await res.json();
      setCustomer(data);
      setSettForm({ name: data.name || '', email: data.email || '', phone: data.phone || '', birthdate: data.birthdate || '', password: '' });
      if (data.avatar_url) setAvatarPreview(data.avatar_url);
    } catch {}
  };

  const loadApprovalNotifications = async () => {
    try {
      const res = await fetch(`${API_BASE}/events/my/${customerId}`);
      if (!res.ok) return;
      const evs = await res.json();
      setNotifications(evs);
      evs.forEach(ev => {
        fetch(`${API_BASE}/events/${ev.id}/notified`, { method: 'PATCH' }).catch(() => {});
      });
    } catch {}
  };

  // ── Auth handlers ─────────────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthLoading(true); setAuthMsg('');
    try {
      const res = await fetch(`${API_BASE}/customer/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail.trim(), password: loginPass })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      sessionStorage.setItem('customerId', data.customerId);
      sessionStorage.setItem('customerName', data.name);
      setCustomerId(data.customerId);
      setCustomerName(data.name);
      setLoginEmail(''); setLoginPass('');
      setView('portal');
      setActiveTab('tab-benefits');
    } catch (err) { setAuthMsg(err.message); }
    finally { setAuthLoading(false); }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setAuthLoading(true); setAuthMsg('');
    try {
      const res = await fetch(`${API_BASE}/customer/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: regName.trim(), email: regEmail.trim(), password: regPass, phone: regPhone.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');
      const savedName = data.name || regName.trim();
      sessionStorage.setItem('customerId', data.customerId);
      sessionStorage.setItem('customerName', savedName);
      setCustomerId(data.customerId);
      setCustomerName(savedName);
      setRegName(''); setRegEmail(''); setRegPass(''); setRegPhone('');
      setView('portal');
      setActiveTab('tab-benefits');
    } catch (err) { setAuthMsg(err.message); }
    finally { setAuthLoading(false); }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('customerId');
    sessionStorage.removeItem('customerName');
    setCustomerId(null); setCustomerName(''); setCustomer(null);
    setNotifications([]);
    setView('landing');
  };

  // ── Ratings handler ───────────────────────────────────────────────────────
  const handleRatingSubmit = async (e) => {
    e.preventDefault();
    if (!ratingValue) { setRatingMsg('Please select a star rating.'); return; }
    setRatingLoading(true);
    try {
      const res = await fetch(`${API_BASE}/ratings`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: customerId || null, rating: parseInt(ratingValue), comment: ratingComment })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed');
      setRatingMsg('Thank you for your feedback!');
      setRatingValue(''); setRatingComment('');
      loadRatings();
    } catch (err) { setRatingMsg(err.message); }
    finally { setRatingLoading(false); }
  };

  // ── Host event handler ────────────────────────────────────────────────────
  const handleHostEvent = async (e) => {
    e.preventDefault();
    setHostSubmitting(true); setHostMsg({ text: '', color: '' });
    try {
      const maxAllowed = shopSettings.max_people_per_event || 30;
      const maxGuests = Math.min(maxAllowed, Math.max(1, parseInt(hostForm.maxGuests) || 20));
      const res = await fetch(`${API_BASE}/events`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: hostForm.title, date: hostForm.date, preferred_time: hostForm.time,
          duration_hours: getEventDuration(hostForm.time),
          phone: hostForm.phone, description: hostForm.desc, hostName: customerName || 'Customer',
          is_private: hostForm.isPrivate, max_participants: maxGuests, customer_id: customerId
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed');
      setHostMsg({ text: "✅ Request submitted! We'll review your event and notify you once a decision is made.", color: 'var(--success)' });
      setHostForm({ title: '', date: '', time: '14:00', phone: '', desc: '', isPrivate: false, maxGuests: 20 });
    } catch (err) { setHostMsg({ text: err.message, color: '#c0392b' }); }
    finally { setHostSubmitting(false); }
  };

  // ── Account settings handler ──────────────────────────────────────────────
  const handleAccountUpdate = async (e) => {
    e.preventDefault();
    setSettLoading(true); setSettMsg('');
    try {
      const formData = new FormData();
      if (settForm.name)      formData.append('name', settForm.name);
      if (settForm.email)     formData.append('email', settForm.email);
      formData.append('birthdate', settForm.birthdate);
      formData.append('phone',     settForm.phone);
      if (settForm.password)  formData.append('password', settForm.password);
      if (avatarFile)         formData.append('avatar', avatarFile);

      const res = await fetch(`${API_BASE}/customer/update?id=${customerId}`, { method: 'PUT', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed');
      setSettMsg('Account details updated successfully!');
      if (settForm.password) setSettForm(f => ({ ...f, password: '' }));
      loadCustomerInfo();
    } catch (err) { setSettMsg(err.message); }
    finally { setSettLoading(false); }
  };

  // Menu derived state
  const filteredMenuProducts = menuProducts.filter(p => {
    if (menuFilter === 'bestsellers') return p.is_best_seller;
    if (menuFilter === 'special') return p.is_special_edition;
    return true;
  });
  const menuCategories = ['All', ...new Set(filteredMenuProducts.map(p => p.category))];
  const displayedProducts = menuCatFilter === 'All' ? filteredMenuProducts : filteredMenuProducts.filter(p => p.category === menuCatFilter);

  const tierColor = customer?.loyalty_level === 'Bronze' ? '#cd7f32' : customer?.loyalty_level === 'Silver' ? '#c0c0c0' : '#ffd700';
  const benefits = TIER_BENEFITS[customer?.loyalty_level] || TIER_BENEFITS['Bronze'];

  // ── Portal ordering helpers ────────────────────────────────────────────────
  const openCustomizationModal = (product) => {
    if (product.isOutOfStock) return;
    setCustomizingProduct(product);
    setCustTemp('Cold');
    setCustSugar('100%');
    setCustMilk('Whole');
    setCustIceCream(false);
    setCustDrinkAddon('None');
    setCustAddons([]);
    setCustModalOpen(true);
  };

  const handleConfirmPortalCustomization = () => {
    if (!customizingProduct) return;
    let customizations = {};
    let extraCost = 0;

    const cat = customizingProduct.category;
    if (cat === 'Coffee' || cat === 'Non-Coffee') {
      customizations = { temperature: custTemp, sugar: custSugar, milk: custMilk };
      if (custTemp === 'Hot') extraCost += 20;
      if (custMilk === 'Oat') extraCost += 25;
      if (custMilk === 'Almond') extraCost += 30;
    } else if (cat === 'Blended') {
      customizations = { iceCream: custIceCream };
      if (custIceCream) extraCost += 50;
    } else if (cat === 'Food') {
      customizations = { drinkaddon: custDrinkAddon };
      if (custDrinkAddon === 'Iced Tea') extraCost += 20;
      if (custDrinkAddon === 'Soda') extraCost += 30;
    }

    const finalPrice = customizingProduct.price + extraCost;
    const cartKey = customizingProduct.id + '-' + JSON.stringify(customizations);

    setPortalCart(prev => {
      const existingIdx = prev.findIndex(item => item.cartKey === cartKey);
      if (existingIdx !== -1) {
        const updated = [...prev];
        updated[existingIdx].qty += 1;
        return updated;
      }
      return [
        ...prev,
        {
          id: customizingProduct.id,
          name: customizingProduct.name,
          price: finalPrice,
          basePrice: customizingProduct.price,
          emoji: customizingProduct.emoji,
          category: customizingProduct.category,
          qty: 1,
          customizations,
          cartKey
        }
      ];
    });

    setCustModalOpen(false);
  };

  const addToPortalCart = (product) => {
    if (product.isOutOfStock) return;
    const DIRECT_ADD_CATS = ['Classic Cans', 'Floating Chills', 'Fruit Soda'];
    if (DIRECT_ADD_CATS.includes(product.category) || product.name === 'Iced Tea') {
      const cartKey = product.id + '-default';
      setPortalCart(prev => {
        const idx = prev.findIndex(i => i.cartKey === cartKey);
        if (idx !== -1) {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], qty: updated[idx].qty + 1 };
          return updated;
        }
        return [...prev, {
          id: product.id,
          name: product.name,
          price: product.price,
          basePrice: product.price,
          emoji: product.emoji,
          category: product.category,
          qty: 1,
          customizations: null,
          cartKey
        }];
      });
    } else {
      openCustomizationModal(product);
    }
  };

  const updatePortalCartQty = (cartKey, delta) => {
    setPortalCart(prev => {
      const updated = prev.map(i => i.cartKey === cartKey ? { ...i, qty: i.qty + delta } : i)
        .filter(i => i.qty > 0);
      return updated;
    });
  };

  const handlePlacePortalOrder = async () => {
    if (portalCart.length === 0) return;
    setPortalOrderLoading(true);
    setPortalOrderMsg('');

    // Verify stock before placing order
    const outItem = portalCart.find(cartItem => {
      const prod = menuProducts.find(p => p.id === cartItem.id);
      return prod && prod.isOutOfStock;
    });
    if (outItem) {
      setPortalOrderMsg(`❌ '${outItem.name}' is currently out of stock.`);
      setPortalOrderLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'portal',
          customer_id: customerId,
          customer_name: customer?.name || '',
          items: portalCart.map(i => ({ product_id: i.id, quantity: i.qty, customizations: i.customizations || {} })),
          discount: 0,
          payment_method: 'Pay at Counter',
          notes: 'Order placed via Customer Portal'
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to place order');
      setPortalOrderMsg('✅ Order placed! Show this to the barista and pay at the counter.');
      setPortalCart([]);
      loadMyOrders();
    } catch (err) {
      setPortalOrderMsg('❌ ' + err.message);
    } finally {
      setPortalOrderLoading(false);
    }
  };

  const loadMyOrders = async () => {
    if (!customerId) return;
    setMyOrdersLoading(true);
    try {
      const res = await fetch(`${API_BASE}/orders/my-orders/${customerId}`);
      const data = await res.json();
      if (res.ok) setMyOrders(data);
    } catch {}
    finally { setMyOrdersLoading(false); }
  };

  const handleCancelOrder = async (orderId) => {
    try {
      const res = await fetch(`${API_BASE}/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' })
      });
      if (!res.ok) throw new Error('Failed to cancel order');
      loadMyOrders();
    } catch (err) {
      console.error(err);
    }
  };

  // Load my orders when opening the menu tab; also poll every 10s for status updates
  useEffect(() => {
    if (activeTab === 'tab-menu' && customerId) {
      loadMyOrders();
      const id = setInterval(loadMyOrders, 10000);
      return () => clearInterval(id);
    }
  }, [activeTab, customerId]);

  const portalCartTotal = portalCart.reduce((s, i) => s + i.price * i.qty, 0);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="portal-container">

      {/* Approval Notification Banner */}
      {notifications.length > 0 && (
        <div id="approval-banner" style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: '#6b5a4a', marginBottom: '8px' }}>📬 Event Updates</div>
          {notifications.map((ev, i) => {
            const isApproved = ev.status === 'approved';
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '14px 18px', borderRadius: '10px', background: isApproved ? '#d4edda' : '#fde8e8', border: `1.5px solid ${isApproved ? '#28a745' : '#e8a0a0'}`, marginBottom: '10px' }}>
                <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>{isApproved ? '🎉' : '❌'}</span>
                <div style={{ flex: 1, fontSize: '.88rem', color: isApproved ? '#155724' : '#922b2b', lineHeight: 1.5 }}
                  dangerouslySetInnerHTML={{ __html: isApproved
                    ? `Your event <strong>"${ev.title}"</strong> on ${formatDateShort(ev.date)} has been <strong>approved!</strong> See you at KapeBara ☕`
                    : `Your event <strong>"${ev.title}"</strong> on ${formatDateShort(ev.date)} was <strong>not approved</strong> at this time. Please contact us for details.`
                  }} />
                <button onClick={() => setNotifications(n => n.filter((_, idx) => idx !== i))} style={{ background: 'transparent', border: 'none', color: isApproved ? '#155724' : '#922b2b', fontSize: '1rem', cursor: 'pointer', flexShrink: 0 }}>✕</button>
              </div>
            );
          })}
        </div>
      )}

      {/* LANDING VIEW */}
      {view === 'landing' && (
        <div id="landing-view">
          <header className="landing-header">
            <div className="landing-brand">
              <img src={logoImg} alt="KapeBara Logo" className="landing-logo" />
              <span className="landing-name">KapeBara</span>
            </div>
            <nav className="landing-nav">
              <a href="#landing-view">Home</a>
              <a href="#about-us">About Us</a>
              <a href="#services">Services</a>
              <a href="#menu">Menu</a>
              <a href="#events-landing">Events</a>
              <a href="#rate-us">Rate Us</a>
              <a href="#contacts">Contacts</a>
            </nav>
            <button className="landing-login-btn" onClick={() => { setView('auth'); setAuthMode('login'); }}>Login</button>
          </header>

          <div className="landing-hero">
            <div className="hero-content">
              <h1>Experience the Cozy Charm of KapeBara</h1>
              <p>More than just a coffee shop—it's a peaceful sanctuary. Sip on artisanal brews, collect rewards, and find your calm in the company of our capybara spirit.</p>
              <button className="hero-cta" onClick={() => { setView('auth'); setAuthMode('register'); }}>Join our Loyalty Circle</button>
            </div>
          </div>

          <section id="about-us" className="landing-section">
            <div className="section-container">
              <h2 className="section-title">Our Story</h2>
              <div className="about-content">
                <p>KapeBara is a small enterprise that operates as a multifunctional community space, combining traditional retail and event-driven services. Founded in 2025, Kapebara expanded its café space in just one month. This progress strengthens the business's reputation.</p>
                <div className="hours-box">
                  <h3>Operating Hours</h3>
                  <p><strong>Mon - Fri:</strong> 2:00 PM - 12:00 MN</p>
                  <p><strong>Sat - Sun:</strong> 9:00 AM - 12:00 MN</p>
                  <p className="hours-note">Ensuring a reliable space for daily customers and event participants alike.</p>
                </div>
              </div>
            </div>
          </section>

          <section id="services" className="landing-section alt-bg">
            <div className="section-container">
              <h2 className="section-title">Our Services</h2>
              <div className="services-grid">
                {[
                  { icon: '☕', title: 'Artisanal Coffee', desc: 'Crafted brews from the finest beans.' },
                  { icon: '🎓', title: 'Workshops', desc: 'Workshops for coffeeshops and aspiring baristas.' },
                  { icon: '🤝', title: 'Community Space', desc: 'A reliable space for meetings and events.' },
                ].map((s, i) => (
                  <div key={i} className="service-card">
                    <div className="service-icon">{s.icon}</div>
                    <h3>{s.title}</h3>
                    <p>{s.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section id="events-landing" className="landing-section">
            <div className="section-container">
              <h2 className="section-title">Upcoming Events</h2>
              <div className="events-grid">
                <EventsGrid customerId={customerId} customerName={customer?.name} isLoggedIn={!!customerId} onLoginClick={() => { setView('auth'); setAuthMode('login'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
              </div>
            </div>
          </section>

          {/* Menu Section */}
          <section id="menu" className="landing-section alt-bg">
            <div className="section-container">
              <h2 className="section-title">Our Menu</h2>
              <div className="menu-highlights">
                {[
                  { id: 'all', label: '☕ Full Menu' },
                  { id: 'bestsellers', label: '⭐ Best Sellers' },
                  { id: 'special', label: '✨ Special Editions' },
                ].map(h => (
                  <div key={h.id} className={`menu-highlight-card ${menuFilter === h.id ? 'active' : ''}`} onClick={() => { setMenuFilter(h.id); setMenuCatFilter('All'); }}>
                    {h.label}
                  </div>
                ))}
              </div>
              <div className="menu-cat-tabs" id="menu-cat-tabs">
                {menuCategories.map(cat => (
                  <button key={cat} className={`menu-cat-tab ${menuCatFilter === cat ? 'active' : ''}`} onClick={() => setMenuCatFilter(cat)}>{cat}</button>
                ))}
              </div>
              <div className="menu-products-grid" id="menu-products-grid">
                {displayedProducts.length === 0 ? (
                  <p style={{ color: '#999', textAlign: 'center', gridColumn: '1/-1', padding: '40px 0' }}>No items in this category right now.</p>
                ) : displayedProducts.map(p => (
                  <div key={p.id} className="menu-item-card">
                    {(p.is_best_seller || p.is_special_edition) && (
                      <div className="menu-badge-corner">
                        {p.is_best_seller && <span className="menu-item-badge bestseller">⭐ Best Seller</span>}
                        {p.is_special_edition && <span className="menu-item-badge special">✨ Special</span>}
                      </div>
                    )}
                    <div className="menu-item-emoji-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <ProductThumb product={p} size={64} />
                    </div>
                    <div className="menu-item-body">
                      <div className="menu-item-name">{p.name}</div>
                      <div className="menu-item-desc">{p.description || ''}</div>
                      <div className="menu-item-footer">
                        <div className="menu-item-price">₱{parseFloat(p.price).toFixed(2)}</div>
                        <span style={{ fontSize: '0.72rem', color: '#aaa' }}>{p.category}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Rate Us Section */}
          <section id="rate-us" className="landing-section">
            <div className="section-container">
              <h2 className="section-title">Rate Us</h2>
              <div className="ratings-container">
                <div className="ratings-display-grid" id="ratings-display-grid">
                  {ratings.length === 0
                    ? <p style={{ textAlign: 'center', width: '100%' }}>No reviews yet. Be the first to rate us!</p>
                    : ratings.map((r, i) => (
                        <div key={i} className="rating-card">
                          <div className="rating-stars">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</div>
                          <div className="rating-author">{r.customer_name}</div>
                          <p className="rating-comment">"{r.comment || 'No comment provided.'}"</p>
                          <div className="rating-date">{new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                        </div>
                      ))
                  }
                </div>
                <div className="rating-form-container">
                  <h3>Leave a Review</h3>
                  <form className="rating-form" id="rating-form" onSubmit={handleRatingSubmit}>
                    <StarRatingPicker value={ratingValue} onChange={setRatingValue} />
                    <textarea id="rating-comment" placeholder="Share your experience..." rows="4" value={ratingComment} onChange={e => setRatingComment(e.target.value)} />
                    <button type="submit" disabled={ratingLoading} style={{ marginTop: '12px' }}>{ratingLoading ? 'Submitting…' : 'Submit Rating'}</button>
                    {ratingMsg && <div id="rating-message" style={{ marginTop: '10px', fontWeight: 500, color: ratingMsg.includes('Thank') ? 'var(--success)' : 'red' }}>{ratingMsg}</div>}
                  </form>
                </div>
              </div>
            </div>
          </section>

          {/* Connect with Us Section */}
          <section id="contacts" className="landing-section alt-bg" style={{ textAlign: 'center', padding: '80px 10%' }}>
            <div className="section-container">
              <h2 className="section-title" style={{ fontFamily: "'Playfair Display', serif", fontSize: '2.8rem', color: '#4a3728', marginBottom: '40px' }}>Connect with Us</h2>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '60px', flexWrap: 'wrap', marginTop: '40px' }}>
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#d4a373', letterSpacing: '1px', marginBottom: '8px' }}>EMAIL:</div>
                  <a href="mailto:kapebaraph@gmail.com" style={{ color: '#4a3728', fontWeight: 500, fontSize: '1.1rem', textDecoration: 'none' }}>kapebaraph@gmail.com</a>
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#d4a373', letterSpacing: '1px', marginBottom: '8px' }}>INSTAGRAM:</div>
                  <a href="https://instagram.com/kapebara_ph" target="_blank" rel="noreferrer" style={{ color: '#4a3728', fontWeight: 500, fontSize: '1.1rem', textDecoration: 'none' }}>@kapebara_ph</a>
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#d4a373', letterSpacing: '1px', marginBottom: '8px' }}>TIKTOK:</div>
                  <a href="https://tiktok.com/@KapeBara_ph" target="_blank" rel="noreferrer" style={{ color: '#4a3728', fontWeight: 500, fontSize: '1.1rem', textDecoration: 'none' }}>@KapeBara_ph</a>
                </div>
              </div>
            </div>
          </section>

          <footer className="landing-footer" style={{ padding: '30px', textAlign: 'center', background: '#4a3728', color: '#faf7f2', fontSize: '0.9rem' }}>
            © 2025 KapeBara. All rights reserved.
          </footer>
        </div>
      )}

      {/* AUTH VIEW */}
      {view === 'auth' && (
        <div id="auth-view">
          <div id="portal-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
            <div className="landing-brand" style={{ cursor: 'pointer' }} onClick={() => setView('landing')}>
              <img src={logoImg} alt="KapeBara Logo" className="landing-logo" style={{ width: '36px', height: '36px' }} />
              <span className="landing-name" style={{ fontSize: '1.2rem' }}>KapeBara</span>
            </div>
          </div>
          <div className="auth-container">
            <h2 id="auth-title">{authMode === 'login' ? 'Customer Login' : 'Register Account'}</h2>

            {authMode === 'login' ? (
              <form id="login-form" onSubmit={handleLogin}>
                <div className="form-group">
                  <label>Email</label>
                  <input type="email" id="login-email" required value={loginEmail} onChange={e => setLoginEmail(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Password</label>
                  <input type="password" id="login-password" required value={loginPass} onChange={e => setLoginPass(e.target.value)} />
                </div>
                <button type="submit" disabled={authLoading}>{authLoading ? 'Logging in…' : 'Login'}</button>
                <p>Don't have an account? <a href="#" onClick={e => { e.preventDefault(); setAuthMode('register'); setAuthMsg(''); }}>Register</a></p>
              </form>
            ) : (
              <form id="register-form" onSubmit={handleRegister}>
                <div className="form-group">
                  <label>Full Name</label>
                  <input type="text" id="reg-name" required value={regName} onChange={e => setRegName(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input type="email" id="reg-email" required value={regEmail} onChange={e => setRegEmail(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Password</label>
                  <input type="password" id="reg-password" required value={regPass} onChange={e => setRegPass(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Phone</label>
                  <input type="tel" id="reg-phone" value={regPhone} onChange={e => setRegPhone(formatPhoneNumber(e.target.value))} />
                </div>
                <button type="submit" disabled={authLoading}>{authLoading ? 'Registering…' : 'Register'}</button>
                <p>Already have an account? <a href="#" onClick={e => { e.preventDefault(); setAuthMode('login'); setAuthMsg(''); }}>Login</a></p>
              </form>
            )}
            {authMsg && <div id="auth-message" style={{ color: 'var(--danger)', marginTop: '10px', fontWeight: 500 }}>{authMsg}</div>}
          </div>
        </div>
      )}

      {/* PORTAL VIEW */}
      {view === 'portal' && customer && (
        <div id="portal-view" className="portal-container" style={{ display: 'block' }}>
          <div id="portal-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', marginBottom: '20px', borderBottom: '1px solid var(--border)' }}>
            <div className="landing-brand">
              <img src={logoImg} alt="KapeBara Logo" className="landing-logo" style={{ width: '40px', height: '40px' }} />
              <div>
                <span className="landing-name" style={{ fontSize: '1.4rem', display: 'block', lineHeight: 1 }}>KapeBara</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>Customer Portal</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div id="welcome-message" dangerouslySetInnerHTML={{ __html: `Welcome back, <strong>${customer.name}</strong>!` }} />
              <button id="logout-btn" className="landing-login-btn" style={{ padding: '8px 20px', fontSize: '0.85rem' }} onClick={handleLogout}>Logout</button>
            </div>
          </div>

          {/* Portal Tabs Header */}
          <div className="portal-tabs-header">
            <div className="portal-tab-bar">
              {[
                { id: 'tab-benefits', label: '💳 Account & Benefits' },
                { id: 'tab-settings', label: '⚙️ Account Settings' },
                { id: 'tab-events', label: '📅 Events & Calendar' },
                { id: 'tab-menu', label: '🍽️ Menu' },
                { id: 'tab-rate', label: '⭐ Rate Us' },
              ].map(tab => (
                <button
                  key={tab.id}
                  className={`portal-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Main Card Wrapper */}
          <div className="portal-main-card">
            {/* Benefits Tab */}
            {activeTab === 'tab-benefits' && (
              <div id="tab-benefits" className="portal-tab-panel active">
                <h2 className="section-title" style={{ textAlign: 'center', marginBottom: '30px', borderBottom: 'none' }}>Your Account & Benefits</h2>

                <div className="loyalty-card" style={{ marginBottom: '30px' }}>
                  <div className="loyalty-profile">
                    <img src={avatarPreview || 'https://placehold.co/80x80?text=CB'} alt="Avatar" id="user-avatar" className="user-avatar" />
                    <div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-dark)', marginBottom: '6px' }}>{customer.name}</div>
                      <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--accent)' }}>KapeBara Loyalty </span>
                      <span className="tier-badge" style={{ backgroundColor: tierColor }}>{customer.loyalty_level}</span>
                    </div>
                  </div>

                  <div className="points-display" id="points-display">
                    {customer.points} <span style={{ fontSize: '0.4em', fontFamily: "'Inter', sans-serif" }}>Pts</span>
                  </div>

                  {/* Loyalty ID box matching original layout */}
                  <div style={{
                    border: '1.5px dashed var(--accent)',
                    borderRadius: '12px',
                    padding: '16px 20px',
                    backgroundColor: 'rgba(255, 255, 255, 0.45)',
                    marginTop: '20px'
                  }}>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-dark)' }}>
                      Loyalty ID: <strong id="loyalty-id-display" style={{ letterSpacing: '1px' }}>{customer.unique_id || '------'}</strong>
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-light)', marginTop: '6px', lineHeight: 1.4 }}>
                      💡 Give this ID to the barista when you buy in the shop. Every ₱100 purchase earns you 10 points!
                    </div>
                  </div>
                </div>

                <div className="benefits-card">
                  <h3 style={{ fontFamily: "'Playfair Display', serif", color: 'var(--accent)', marginBottom: '16px', fontSize: '1.2rem' }}>Current Benefits:</h3>
                  <ul className="benefits-list" id="benefits-list">
                    {benefits.map((b, i) => <li key={i}>{b}</li>)}
                  </ul>
                </div>
              </div>
            )}

            {/* Settings Tab */}
            {activeTab === 'tab-settings' && (
              <div id="tab-settings" className="portal-tab-panel active">
                <h2 className="section-title" style={{ marginBottom: '24px', borderBottom: 'none' }}>Account Settings</h2>
                <div className="account-settings-card">
                  <form id="account-settings-form" onSubmit={handleAccountUpdate} style={{ maxWidth: '520px', display: 'grid', gap: '16px' }}>
                    <div className="form-group">
                      <label>Profile Photo</label>
                      {avatarPreview && <img src={avatarPreview} alt="Avatar" className="user-avatar" style={{ width: 72, height: 72, marginBottom: '10px', display: 'block' }} />}
                      <input type="file" id="settings-avatar" accept="image/*" onChange={e => {
                        const f = e.target.files[0];
                        setAvatarFile(f);
                        if (f) setAvatarPreview(URL.createObjectURL(f));
                      }} />
                    </div>
                    <div className="form-group">
                      <label>Full Name</label>
                      <input type="text" id="settings-name" value={settForm.name} onChange={e => setSettForm(f => ({ ...f, name: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label>Email</label>
                      <input type="email" id="settings-email" value={settForm.email} onChange={e => setSettForm(f => ({ ...f, email: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label>Phone</label>
                      <input type="tel" id="settings-phone" value={settForm.phone} onChange={e => setSettForm(f => ({ ...f, phone: formatPhoneNumber(e.target.value) }))} />
                    </div>
                    <div className="form-group">
                      <label>Birthdate</label>
                      <input type="date" id="settings-birthdate" value={settForm.birthdate} onChange={e => setSettForm(f => ({ ...f, birthdate: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label>New Password <span style={{ fontSize: '0.8em', color: '#aaa' }}>(leave blank to keep current)</span></label>
                      <input type="password" id="settings-password" value={settForm.password} onChange={e => setSettForm(f => ({ ...f, password: e.target.value }))} />
                    </div>
                    <button type="submit" disabled={settLoading}>{settLoading ? 'Updating…' : 'Update Account Details'}</button>
                    {settMsg && <div id="settings-message" style={{ fontWeight: 500, color: settMsg.includes('success') ? 'var(--success)' : 'red' }}>{settMsg}</div>}
                  </form>
                </div>
              </div>
            )}

            {/* Events Tab */}
            {activeTab === 'tab-events' && (
              <div id="tab-events" className="portal-tab-panel active">
                <h2 className="section-title" style={{ marginBottom: '24px', borderBottom: 'none' }}>Events & Booking</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '30px' }}>
                  <div>
                    <h3 style={{ fontFamily: "'Playfair Display', serif", color: 'var(--accent)', marginBottom: '16px' }}>Upcoming Events</h3>
                    <div className="events-grid" id="events-grid">
                      <EventsGrid customerId={customerId} customerName={customer?.name} isLoggedIn={true} />
                    </div>
                    
                    <div style={{ marginTop: '32px' }}>
                      <h3 style={{ fontFamily: "'Playfair Display', serif", color: 'var(--accent)', marginBottom: '16px' }}>Your Events & Bookings</h3>
                      <MyEventsList customerId={customerId} customerName={customer?.name} />
                    </div>
                  </div>
                  <div>
                    <h3 style={{ fontFamily: "'Playfair Display', serif", color: 'var(--accent)', marginBottom: '16px' }}>Live Booking Calendar</h3>
                    <div id="shop-calendar-container" style={{ background: '#faf7f2', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                      <ShopCalendar customerId={customerId} />
                    </div>
                    <div className="host-event-section" style={{ marginTop: '28px' }}>
                      <h3 style={{ fontFamily: "'Playfair Display', serif", color: 'var(--accent)', marginBottom: '16px' }}>Request a Private Event</h3>
                      <form id="host-event-form" onSubmit={handleHostEvent}>
                        <div className="form-group">
                          <label htmlFor="event-title">Event Title</label>
                          <input type="text" id="event-title" required placeholder="e.g. Birthday Party, Study Group" value={hostForm.title} onChange={e => setHostForm(f => ({ ...f, title: e.target.value }))} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                          <div className="form-group">
                            <label htmlFor="event-date">Proposed Date</label>
                            <input type="date" id="event-date" required value={hostForm.date} onChange={e => setHostForm(f => ({ ...f, date: e.target.value }))} />
                          </div>
                          <div className="form-group">
                            <label htmlFor="event-time">Preferred Start Time</label>
                            <select id="event-time" value={hostForm.time} onChange={e => setHostForm(f => ({ ...f, time: e.target.value }))}>
                              {['14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30','19:00','19:30','20:00','20:30','21:00','21:30','22:00','22:30','23:00','23:30','00:00'].map(t => {
                                const [h, m] = t.split(':').map(Number);
                                const label = `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
                                return <option key={t} value={t}>{label}</option>;
                              })}
                            </select>
                          </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                          <div className="form-group">
                            <label htmlFor="event-phone">Contact Phone Number</label>
                            <input type="tel" id="event-phone" required placeholder="e.g. 0919-xxx-xxxx" value={hostForm.phone} onChange={e => setHostForm(f => ({ ...f, phone: formatPhoneNumber(e.target.value) }))} />
                          </div>
                          <div className="form-group">
                            <label htmlFor="event-max" id="host-max-guests-label">Expected Guests (max {shopSettings.max_people_per_event})</label>
                            <input type="number" id="event-max" min="1" max={shopSettings.max_people_per_event} value={hostForm.maxGuests} onChange={e => setHostForm(f => ({ ...f, maxGuests: e.target.value }))} />
                          </div>
                        </div>
                        <div className="form-group">
                          <label htmlFor="event-desc">Description</label>
                          <textarea id="event-desc" rows="3" placeholder="Tell us more about your event..." value={hostForm.desc} onChange={e => setHostForm(f => ({ ...f, desc: e.target.value }))} />
                        </div>
                        <div className="form-group private-toggle-group">
                          <label className="private-toggle-label">
                            <input type="checkbox" id="event-private" checked={hostForm.isPrivate} onChange={e => setHostForm(f => ({ ...f, isPrivate: e.target.checked }))} />
                            <span className="private-toggle-box">
                              <span className="private-toggle-checkmark">🔒</span>
                              <span>
                                <strong>Make this a Private Event</strong>
                                <span style={{ display: 'block', fontSize: '0.82em', color: 'var(--text-light)', fontWeight: 400, marginTop: '2px' }}>
                                  Private events won't appear on the public events listing — only invited guests will know.
                                </span>
                              </span>
                            </span>
                          </label>
                        </div>
                        <div className="event-duration-note">
                          {(() => {
                            const [h] = (hostForm.time || '14:00').split(':').map(Number);
                            const isLate = h >= 22 || h === 0;
                            if (isLate) {
                              return (
                                <span>⏱ Bookings at <strong>10:00 PM onward</strong> are limited to <strong>1 hour</strong> due to 12:00 MN closing time ({formatTimeRange(hostForm.time, 1)}).</span>
                              );
                            }
                            return (
                              <span>⏱ Events may use the venue for up to <strong>3 hours</strong> from the preferred start time ({formatTimeRange(hostForm.time, 3)}).</span>
                            );
                          })()}
                        </div>
                        <button type="submit" disabled={hostSubmitting}>{hostSubmitting ? 'Submitting…' : 'Submit Request'}</button>
                        {hostMsg.text && <div id="form-message" style={{ marginTop: '15px', fontWeight: 500, color: hostMsg.color }}>{hostMsg.text}</div>}
                      </form>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Menu Tab */}
            {activeTab === 'tab-menu' && (
              <div id="tab-menu" className="portal-tab-panel active">
                <h2 className="section-title" style={{ marginBottom: '8px', borderBottom: 'none' }}>Order from Menu</h2>
                <p style={{ textAlign: 'center', color: 'var(--text-light)', fontSize: '0.88rem', marginBottom: '24px' }}>
                  Add items below, then place your order — pay at the counter when ready! 🧾
                </p>

                {/* Filter pills */}
                <div className="portal-menu-filters" style={{ marginBottom: '14px' }}>
                  {[{ id: 'all', label: '☕ Full Menu' }, { id: 'bestsellers', label: '⭐ Best Sellers' }, { id: 'special', label: '✨ Special' }].map(h => (
                    <button key={h.id} className={`portal-menu-pill ${menuFilter === h.id ? 'active' : ''}`} onClick={() => { setMenuFilter(h.id); setMenuCatFilter('All'); }}>{h.label}</button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
                  {menuCategories.map(cat => (
                    <button key={cat} className={`menu-cat-tab ${menuCatFilter === cat ? 'active' : ''}`} onClick={() => setMenuCatFilter(cat)}>{cat}</button>
                  ))}
                </div>

                {/* Two-column: product grid + cart */}
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 300px', gap: '24px', alignItems: 'start' }}>
                  {/* Product grid */}
                  <div>
                    <div className="menu-products-grid" id="portal-menu-grid">
                      {displayedProducts.map(p => {
                        const inCart = portalCart.find(i => i.id === p.id);
                        const isOut = p.isOutOfStock;
                        return (
                          <div key={p.id} className="menu-item-card" style={{
                            position: 'relative',
                            opacity: isOut ? 0.6 : 1,
                            filter: isOut ? 'grayscale(80%)' : 'none'
                          }}>
                            {isOut && (
                              <span style={{
                                position: 'absolute',
                                top: '8px', right: '8px',
                                background: '#c0392b', color: '#fff',
                                fontSize: '0.65rem', padding: '3px 8px',
                                borderRadius: '10px', fontWeight: 700, zIndex: 2
                              }}>
                                OUT OF STOCK
                              </span>
                            )}
                            <div className="menu-item-emoji-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <ProductThumb product={p} size={64} />
                            </div>
                            <div className="menu-item-body">
                              <div className="menu-item-name">{p.name}</div>
                              <div className="menu-item-desc">{p.description || ''}</div>
                              <div className="menu-item-footer">
                                <div className="menu-item-price">₱{parseFloat(p.price).toFixed(2)}</div>
                                <span style={{ fontSize: '0.72rem', color: '#aaa' }}>{p.category}</span>
                              </div>
                              {/* Add to order controls */}
                              {isOut ? (
                                <button disabled style={{ marginTop: '10px', width: '100%', padding: '7px', background: '#e0e0e0', color: '#777', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '0.82rem', cursor: 'not-allowed' }}>
                                  Out of Stock
                                </button>
                              ) : inCart ? (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginTop: '10px' }}>
                                  <button onClick={() => updatePortalCartQty(p.id, -1)} style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#f5ebe0', border: '1px solid #d9c4a7', fontWeight: 700, fontSize: '1rem', cursor: 'pointer' }}>−</button>
                                  <span style={{ fontWeight: 700, minWidth: '20px', textAlign: 'center' }}>{inCart.qty}</span>
                                  <button onClick={() => updatePortalCartQty(p.id, 1)} style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--accent)', border: 'none', color: '#fff', fontWeight: 700, fontSize: '1rem', cursor: 'pointer' }}>+</button>
                                </div>
                              ) : (
                                <button onClick={() => addToPortalCart(p)} style={{ marginTop: '10px', width: '100%', padding: '7px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer', transition: 'opacity 0.15s' }}>
                                  + Add to Order
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Cart sidebar */}
                  <div style={{ position: 'sticky', top: '20px' }}>
                    <div style={{ background: '#faf7f2', border: '1.5px solid var(--border)', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 16px rgba(74,44,10,0.08)' }}>
                      <h3 style={{ fontFamily: "'Playfair Display', serif", color: 'var(--espresso)', marginBottom: '16px', fontSize: '1.1rem' }}>🛒 Your Order</h3>
                      {portalCart.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '20px 0', color: '#bbb' }}>
                          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🍽️</div>
                          <p style={{ fontSize: '0.85rem' }}>No items yet.<br/>Tap an item to add!</p>
                        </div>
                      ) : (
                        <>
                          {portalCart.map(item => {
                            const customDetails = [];
                            if (item.customizations) {
                              if (item.customizations.temperature) customDetails.push(item.customizations.temperature === 'Hot' ? '☕ Hot' : '🧊 Cold');
                              if (item.customizations.sugar && item.customizations.sugar !== '100%') customDetails.push(`${item.customizations.sugar} Sugar`);
                              if (item.customizations.milk && item.customizations.milk !== 'Whole') customDetails.push(`${item.customizations.milk} Milk`);
                              if (item.customizations.iceCream) customDetails.push('🍨 + Ice Cream');
                              if (item.customizations.drinkaddon && item.customizations.drinkaddon !== 'None') customDetails.push(`+ ${item.customizations.drinkaddon}`);
                            }
                            return (
                              <div key={item.cartKey} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                                <div>
                                  <div style={{ fontWeight: 600, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <ProductThumb product={item} size={22} style={{ borderRadius: '4px' }} />
                                    {item.name}
                                  </div>
                                  {customDetails.length > 0 && (
                                    <div style={{ fontSize: '0.74rem', color: 'var(--accent)', marginTop: '2px', fontWeight: 500 }}>
                                      {customDetails.join(' · ')}
                                    </div>
                                  )}
                                  <div style={{ fontSize: '0.78rem', color: '#999', marginTop: '1px' }}>₱{item.price.toFixed(2)} each</div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <button onClick={() => updatePortalCartQty(item.cartKey, -1)} style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#f0e6d8', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}>−</button>
                                  <span style={{ minWidth: '18px', textAlign: 'center', fontWeight: 700, fontSize: '0.88rem' }}>{item.qty}</span>
                                  <button onClick={() => updatePortalCartQty(item.cartKey, 1)} style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'var(--accent)', border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}>+</button>
                                </div>
                              </div>
                            );
                          })}
                          <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1rem', color: 'var(--espresso)' }}>
                            <span>Total</span>
                            <span>₱{portalCartTotal.toFixed(2)}</span>
                          </div>
                          <button onClick={handlePlacePortalOrder} disabled={portalOrderLoading} style={{ marginTop: '14px', width: '100%', padding: '12px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' }}>
                            {portalOrderLoading ? 'Placing Order…' : '✅ Place Order'}
                          </button>
                          <button onClick={() => setPortalCart([])} style={{ marginTop: '8px', width: '100%', padding: '8px', background: 'transparent', color: '#aaa', border: '1px solid #e0d4c0', borderRadius: '8px', fontSize: '0.8rem', cursor: 'pointer' }}>
                            Clear Cart
                          </button>
                        </>
                      )}
                      {portalOrderMsg && (
                        <div style={{ marginTop: '12px', padding: '10px 14px', background: portalOrderMsg.includes('✅') ? '#d4edda' : '#f8d7da', color: portalOrderMsg.includes('✅') ? '#155724' : '#721c24', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 500 }}>
                          {portalOrderMsg}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* My Orders history */}
                <div style={{ marginTop: '40px' }}>
                  <h3 style={{ fontFamily: "'Playfair Display', serif", color: 'var(--accent)', marginBottom: '16px', fontSize: '1.15rem' }}>📋 My Order History</h3>
                  {myOrdersLoading ? (
                    <p style={{ color: '#aaa', fontSize: '0.9rem' }}>Loading your orders…</p>
                  ) : myOrders.length === 0 ? (
                    <p style={{ color: '#aaa', fontSize: '0.9rem' }}>No orders yet. Place your first order above! ☕</p>
                  ) : (
                    <div style={{ display: 'grid', gap: '12px' }}>
                      {myOrders.map(order => {
                        const isCancelled = order.status === 'cancelled';
                        const statusColor = order.status === 'completed' ? { bg: '#d4edda', text: '#155724' } : order.status === 'processing' ? { bg: '#d1ecf1', text: '#0c5460' } : isCancelled ? { bg: '#f8d7da', text: '#721c24' } : { bg: '#fff3cd', text: '#856404' };
                        const canCancel = order.status === 'pending';
                        return (
                          <div key={order.id} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', boxShadow: '0 2px 8px rgba(74,44,10,0.06)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                              <div>
                                <div style={{ fontSize: '0.75rem', color: '#999', marginBottom: '2px' }}>{new Date(order.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</div>
                                <div style={{ fontWeight: 700, color: 'var(--espresso)', fontSize: '0.95rem' }}>Order #{order.id?.slice(-6).toUpperCase()}</div>
                              </div>
                              <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '4px 10px', borderRadius: '20px', background: statusColor.bg, color: statusColor.text }}>
                                {order.status === 'completed' ? '✅ Completed' : order.status === 'processing' ? '⚙️ Processing' : isCancelled ? '❌ Cancelled' : '⏳ Pending'}
                              </span>
                            </div>
                            <div style={{ fontSize: '0.82rem', color: '#666', marginBottom: '8px' }}>
                              {order.items?.map(i => `${i.product_name} ×${i.quantity}`).join(' · ')}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ fontWeight: 700, color: 'var(--accent)', fontSize: '1rem' }}>₱{parseFloat(order.total).toFixed(2)}</div>
                              {canCancel && (
                                <button
                                  onClick={() => handleCancelOrder(order.id)}
                                  style={{ padding: '5px 14px', background: 'transparent', border: '1.5px solid #dc3545', color: '#dc3545', borderRadius: '8px', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer' }}
                                >
                                  ❌ Cancel Order
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}


            {/* Rate Us Tab */}
            {activeTab === 'tab-rate' && (
              <div id="tab-rate" className="portal-tab-panel active">
                <h2 className="section-title" style={{ marginBottom: '24px', borderBottom: 'none' }}>Rate Us</h2>
                <div className="ratings-container">
                  <div className="ratings-display-grid">
                    {ratings.length === 0
                      ? <p style={{ textAlign: 'center', width: '100%' }}>No reviews yet. Be the first!</p>
                      : ratings.map((r, i) => (
                          <div key={i} className="rating-card">
                            <div className="rating-stars">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</div>
                            <div className="rating-author">{r.customer_name}</div>
                            <p className="rating-comment">"{r.comment || 'No comment provided.'}"</p>
                            <div className="rating-date">{new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                          </div>
                        ))
                    }
                  </div>
                  <div className="rating-form-container" style={{ marginTop: '30px' }}>
                    <h3>Leave a Review</h3>
                    <form className="rating-form" onSubmit={handleRatingSubmit}>
                      <StarRatingPicker value={ratingValue} onChange={setRatingValue} />
                      <textarea placeholder="Share your experience..." rows="4" value={ratingComment} onChange={e => setRatingComment(e.target.value)} />
                      <button type="submit" disabled={ratingLoading} style={{ marginTop: '12px' }}>{ratingLoading ? 'Submitting…' : 'Submit Rating'}</button>
                      {ratingMsg && <div style={{ marginTop: '10px', fontWeight: 500, color: ratingMsg.includes('Thank') ? 'var(--success)' : 'red' }}>{ratingMsg}</div>}
                    </form>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Customize Item Modal Overlay */}
      {custModalOpen && customizingProduct && (
        <div className="modal-overlay" onClick={(e) => e.target.classList.contains('modal-overlay') && setCustModalOpen(false)}>
          <div className="cust-modal-box">
            <div className="cust-modal-header">
              <h2 className="cust-modal-title">Customize Item</h2>
              <button type="button" className="cust-modal-close" onClick={() => setCustModalOpen(false)}>✕</button>
            </div>

            <div className="cust-product-info">
                <div className="cust-product-emoji" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ProductThumb product={customizingProduct} size={56} />
                </div>
              <div>
                <h3 className="cust-product-name">{customizingProduct.name}</h3>
                <p className="cust-product-price">₱{parseFloat(customizingProduct.price).toFixed(2)} base price</p>
              </div>
            </div>


            {/* Category specific customization elements */}
            {(customizingProduct.category === 'Coffee' || customizingProduct.category === 'Non-Coffee') && (
              <>
                {/* Temperature */}
                <div className="cust-section">
                  <span className="cust-section-label">🌡️ Temperature</span>
                  <div className="cust-options-row">
                    {['Cold', 'Hot'].map(t => (
                      <button
                        key={t}
                        type="button"
                        className={`cust-pill-btn ${custTemp === t ? 'active' : ''}`}
                        onClick={() => setCustTemp(t)}
                      >
                        {t === 'Cold' ? '🧊 Cold' : '☕ Hot (+₱20)'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sugar Level */}
                <div className="cust-section">
                  <span className="cust-section-label">Sugar Level</span>
                  <div className="cust-options-row">
                    {['0%', '25%', '50%', '75%', '100%'].map(s => (
                      <button
                        key={s}
                        type="button"
                        className={`cust-pill-btn ${custSugar === s ? 'active' : ''}`}
                        onClick={() => setCustSugar(s)}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Milk Type */}
                <div className="cust-section">
                  <span className="cust-section-label">Milk Type</span>
                  <div className="cust-options-row">
                    {[
                      { name: 'Whole', label: 'Whole' },
                      { name: 'Oat', label: 'Oat (+₱25)' },
                      { name: 'Almond', label: 'Almond (+₱30)' }
                    ].map(m => (
                      <button
                        key={m.name}
                        type="button"
                        className={`cust-pill-btn ${custMilk === m.name ? 'active' : ''}`}
                        onClick={() => setCustMilk(m.name)}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {customizingProduct.category === 'Blended' && (
              <div className="cust-section">
                <span className="cust-section-label">🍨 Extras</span>
                <div style={{ marginTop: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      style={{ width: '20px', height: '20px', accentColor: '#8c6b4e' }}
                      checked={custIceCream}
                      onChange={(e) => setCustIceCream(e.target.checked)}
                    />
                    <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#4a3728' }}>Add Ice Cream (+₱50)</span>
                  </label>
                </div>
              </div>
            )}

            {customizingProduct.category === 'Food' && (
              <div className="cust-section">
                <span className="cust-section-label">🥤 Add a Drink</span>
                <div className="cust-options-row">
                  {[
                    { name: 'None', label: 'None' },
                    { name: 'Iced Tea', label: 'Iced Tea (+₱20)' },
                    { name: 'Soda', label: 'Soda (+₱30)' }
                  ].map(d => (
                    <button
                      key={d.name}
                      type="button"
                      className={`cust-pill-btn ${custDrinkAddon === d.name ? 'active' : ''}`}
                      onClick={() => setCustDrinkAddon(d.name)}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="cust-modal-actions">
              <button type="button" className="cust-btn-cancel" onClick={() => setCustModalOpen(false)}>Cancel</button>
              <button type="button" className="cust-btn-add" onClick={handleConfirmPortalCustomization}>Add to Order</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
