import React, { useState, useEffect, useCallback } from 'react';
import { API, toast } from '../api';

const STATUS_COLORS = {
  pending_approval: { bg: '#fff3cd', color: '#856404' },
  approved:         { bg: '#d4edda', color: '#155724' },
  upcoming:         { bg: '#d4edda', color: '#155724' },
  rejected:         { bg: '#f8d7da', color: '#721c24' },
};

function formatTime12(timeStr) {
  if (!timeStr) return '—';
  const [h, m] = timeStr.split(':').map(Number);
  const p = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${p}`;
}

function getEventDuration(startTime) {
  if (!startTime) return 3;
  const [h] = startTime.split(':').map(Number);
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
  if (!time24) return '—';
  const dur = durationHours || getEventDuration(time24);
  const end = getEventEndTime(time24, dur);
  return `${formatTime12(time24)} – ${formatTime12(end)} (${dur} ${dur === 1 ? 'hr' : 'hrs'})`;
}

export default function Events() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  // Add event modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [evTitle, setEvTitle] = useState('');
  const [evDate, setEvDate] = useState(new Date().toISOString().slice(0, 10));
  const [evTime, setEvTime] = useState('14:00');
  const [evMax, setEvMax] = useState(30);
  const [evPrivate, setEvPrivate] = useState(false);
  const [evDesc, setEvDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadEvents = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const data = await API.get('/events');
      setEvents(data);
    } catch (err) {
      if (isManual) toast('Failed to load events: ' + err.message, 'error');
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadEvents();
    // Poll every 10 seconds for real-time updates
    const id = setInterval(() => loadEvents(), 10000);
    return () => clearInterval(id);
  }, [loadEvents]);

  const handleAction = async (id, action) => {
    try {
      if (action === 'approve') {
        await API.patch(`/events/${id}/status`, { status: 'approved' });
        toast('Event approved!', 'success');
      } else if (action === 'reject') {
        await API.patch(`/events/${id}/status`, { status: 'rejected' });
        toast('Event rejected. Customer notified.', 'warning');
      } else if (action === 'delete') {
        await API.delete(`/events/${id}`);
        toast('Event removed.', 'warning');
      }
      loadEvents();
    } catch (err) {
      toast('Failed: ' + err.message, 'error');
    }
  };

  const handleAddEvent = async (e) => {
    e.preventDefault();
    if (!evTitle.trim() || !evDate) {
      toast('Title and date are required', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await API.post('/events', {
        title: evTitle.trim(),
        date: evDate,
        preferred_time: evTime,
        duration_hours: getEventDuration(evTime),
        description: evDesc,
        is_private: evPrivate,
        max_participants: parseInt(evMax) || 30,
        hostName: 'KapeBara',
        type: 'shop'
      });

      // Auto-approve shop events
      const allEvents = await API.get('/events');
      const newEv = allEvents.filter(ev => ev.title === evTitle.trim() && ev.date.startsWith(evDate)).pop();
      if (newEv) await API.patch(`/events/${newEv.id}/status`, { status: 'approved' });

      setAddModalOpen(false);
      setEvTitle(''); setEvDate(new Date().toISOString().slice(0, 10));
      setEvTime('14:00'); setEvMax(30); setEvPrivate(false); setEvDesc('');
      toast('Shop event created!', 'success');
      loadEvents();
    } catch (err) {
      toast('Failed: ' + err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const getTodayStr = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayStr = getTodayStr();
  const pending  = events.filter(e => e.status === 'pending_approval');
  const approved = events.filter(e => (e.status === 'approved' || e.status === 'upcoming') && (e.date ? e.date.split('T')[0] : '') >= todayStr);
  const past     = events.filter(e => e.status === 'rejected' || ((e.status === 'approved' || e.status === 'upcoming') && (e.date ? e.date.split('T')[0] : '') < todayStr));

  // Sort helper: upcoming (present → future) first (closest to present first), then past (most recent past → oldest)
  const sortByDate = (arr) => {
    const getSortKey = (e) => {
      const dateStr = e.date ? e.date.split('T')[0] : '9999-99-99';
      const timeStr = e.preferred_time || '00:00';
      return `${dateStr}T${timeStr}`;
    };

    const upcoming = arr.filter(e => {
      const dateStr = e.date ? e.date.split('T')[0] : '';
      return dateStr >= todayStr;
    }).sort((a, b) => getSortKey(a).localeCompare(getSortKey(b)));

    const pastArr = arr.filter(e => {
      const dateStr = e.date ? e.date.split('T')[0] : '';
      return dateStr < todayStr;
    }).sort((a, b) => getSortKey(b).localeCompare(getSortKey(a)));

    return [...upcoming, ...pastArr];
  };

  const displayed = sortByDate(filter === 'pending' ? pending : filter === 'approved' ? approved : filter === 'past' ? past : events);

  return (
    <div>
      {/* Header with filters */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div className="period-tabs" style={{ margin: 0 }}>
          {[
            { key: 'all', label: `All Events (${events.length})` },
            { key: 'pending', label: `⏳ Pending (${pending.length})` },
            { key: 'approved', label: `✅ Approved (${approved.length})` },
            { key: 'past', label: '🗓 Past/Rejected' },
          ].map(({ key, label }) => (
            <button
              key={key}
              className={`period-tab ${filter === key ? 'active' : ''}`}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => loadEvents(true)}
            disabled={refreshing}
            title="Refresh events list"
            style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
          >
            <span style={{ display: 'inline-block', animation: refreshing ? 'spin 1s linear infinite' : 'none' }}>🔄</span>
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setAddModalOpen(true)}>➕ Add Shop Event</button>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="flex-center" style={{ height: '200px' }}><div className="spinner"></div></div>
        ) : displayed.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📭</div>
            <p>No events in this category.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Title</th><th>Host</th><th>Phone</th><th>Date</th><th>Time</th>
                  <th>Guests</th><th>Privacy</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayed.map(e => {
                  const dateStr  = e.date ? e.date.split('T')[0] : '—';
                  const friendly = dateStr !== '—'
                    ? new Date(dateStr + 'T00:00:00').toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
                    : '—';
                  const sc = STATUS_COLORS[e.status] || { bg: '#e2e3e5', color: '#383d41' };
                  const isPending = e.status === 'pending_approval';
                  const isApproved = e.status === 'approved' || e.status === 'upcoming';

                  return (
                    <tr key={e.id}>
                      <td className="font-bold" style={{ maxWidth: '160px' }}>{e.title || '—'}</td>
                      <td>{e.host_name || '—'}</td>
                      <td style={{ fontSize: '0.82rem' }}>{e.phone || '—'}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{friendly}</td>
                      <td style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{formatTimeRange(e.preferred_time, e.duration_hours)}</td>
                      <td style={{ textAlign: 'center' }}>{e.max_participants || 30}</td>
                      <td>
                        {e.is_private
                          ? <span style={{ background: '#ede7f6', color: '#512da8', padding: '3px 7px', borderRadius: '12px', fontSize: '0.78rem' }}>🔒 Private</span>
                          : <span style={{ background: '#e8f5e9', color: '#2e7d32', padding: '3px 7px', borderRadius: '12px', fontSize: '0.78rem' }}>🌐 Public</span>
                        }
                      </td>
                      <td>
                        <span style={{ background: sc.bg, color: sc.color, padding: '3px 8px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 700 }}>
                          {e.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {isPending && (
                          <>
                            <button className="btn btn-primary btn-sm" style={{ marginRight: '4px' }} onClick={() => handleAction(e.id, 'approve')}>✓ Approve</button>
                            <button className="btn btn-secondary btn-sm" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }} onClick={() => handleAction(e.id, 'reject')}>✕ Reject</button>
                          </>
                        )}
                        {isApproved && (
                          <button className="btn btn-secondary btn-sm" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }} onClick={() => handleAction(e.id, 'delete')}>🗑 Remove</button>
                        )}
                        {!isPending && !isApproved && (
                          <button className="btn btn-secondary btn-sm" onClick={() => handleAction(e.id, 'delete')}>🗑 Delete</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Shop Event Modal */}
      {addModalOpen && (
        <div className="modal-overlay" style={{ display: 'flex' }} onClick={(e) => e.target.classList.contains('modal-overlay') && setAddModalOpen(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">➕ Add Shop Event</h2>
              <button className="modal-close" onClick={() => setAddModalOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleAddEvent}>
              <div className="modal-body" style={{ display: 'grid', gap: '14px' }}>
                <div className="form-group">
                  <label className="form-label">Event Title</label>
                  <input type="text" className="form-control" placeholder="e.g. Latte Art Workshop" required value={evTitle} onChange={e => setEvTitle(e.target.value)} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Date</label>
                    <input type="date" className="form-control" required value={evDate} onChange={e => setEvDate(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Start Time</label>
                    <input type="time" className="form-control" value={evTime} onChange={e => setEvTime(e.target.value)} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Max Guests</label>
                    <input type="number" className="form-control" min="1" max="200" value={evMax} onChange={e => setEvMax(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Privacy</label>
                    <select className="form-control" value={String(evPrivate)} onChange={e => setEvPrivate(e.target.value === 'true')}>
                      <option value="false">🌐 Public</option>
                      <option value="true">🔒 Private</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea className="form-control" rows="3" placeholder="Describe the event..." value={evDesc} onChange={e => setEvDesc(e.target.value)} />
                </div>
              </div>
              <div className="modal-actions" style={{ padding: '0 20px 20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setAddModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Creating...' : 'Create Event'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
