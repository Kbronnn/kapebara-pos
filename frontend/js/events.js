// ── Admin Events Tab ─────────────────────────────────────────────────────────
let adminEventsFilter = 'all';

async function initEvents() {
  const el = document.getElementById('view-events');
  el.innerHTML = `<div class="flex-center" style="height:200px"><div class="spinner"></div></div>`;
  try {
    await loadAdminEvents();
  } catch (err) {
    el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><p>${err.message}</p></div>`;
  }
}

async function loadAdminEvents() {
  const el = document.getElementById('view-events');
  const events = await API.get('/events');

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const pending  = events.filter(e => e.status === 'pending_approval');
  const approved = events.filter(e => (e.status === 'approved' || e.status === 'upcoming') && (e.date ? e.date.split('T')[0] : '') >= todayStr);
  const past     = events.filter(e => e.status === 'rejected' || e.status === 'cancelled' || ((e.status === 'approved' || e.status === 'upcoming') && (e.date ? e.date.split('T')[0] : '') < todayStr));

  const sortByDate = (arr) => {
    const getSortKey = (e) => {
      const dateStr = e.date ? e.date.split('T')[0] : '9999-99-99';
      const timeStr = e.preferred_time || '00:00';
      return `${dateStr}T${timeStr}`;
    };
    const upcoming = arr.filter(e => (e.date ? e.date.split('T')[0] : '') >= todayStr).sort((a, b) => getSortKey(a).localeCompare(getSortKey(b)));
    const pastArr  = arr.filter(e => (e.date ? e.date.split('T')[0] : '') < todayStr).sort((a, b) => getSortKey(b).localeCompare(getSortKey(a)));
    return [...upcoming, ...pastArr];
  };

  let displayed = sortByDate(adminEventsFilter === 'pending' ? pending : adminEventsFilter === 'approved' ? approved : adminEventsFilter === 'past' ? past : events);

  el.innerHTML = `
    <!-- Header with Add button -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px;">
      <div class="period-tabs" style="margin:0;">
        <button class="period-tab ${adminEventsFilter==='all'?'active':''}" onclick="setEventsFilter('all')">All Events (${events.length})</button>
        <button class="period-tab ${adminEventsFilter==='pending'?'active':''}" onclick="setEventsFilter('pending')">⏳ Pending (${pending.length})</button>
        <button class="period-tab ${adminEventsFilter==='approved'?'active':''}" onclick="setEventsFilter('approved')">✅ Approved (${approved.length})</button>
        <button class="period-tab ${adminEventsFilter==='past'?'active':''}" onclick="setEventsFilter('past')">🗓 Past / Inactive (${past.length})</button>
      </div>
      <button class="btn btn-primary btn-sm" onclick="openAddShopEventModal()">➕ Add Shop Event</button>
    </div>

    <div class="card">
      ${displayed.length === 0
        ? `<div class="empty-state"><div class="empty-state-icon">📭</div><p>No events in this category.</p></div>`
        : `<div class="table-wrap">
            <table id="admin-events-table">
              <thead>
                <tr>
                  <th>Title</th><th>Host</th><th>Phone</th><th>Date</th><th>Time</th>
                  <th>Guests</th><th>Privacy</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${displayed.map(e => renderAdminEventRow(e)).join('')}
              </tbody>
            </table>
          </div>`}
    </div>`;
}

function renderAdminEventRow(e) {
  const dateStr  = e.date ? e.date.split('T')[0] : '—';
  const friendly = dateStr !== '—'
    ? new Date(dateStr+'T00:00:00').toLocaleDateString('en-PH',{weekday:'short',month:'short',day:'numeric',year:'numeric'})
    : '—';

  const timeDisplay = e.preferred_time
    ? (() => { const [h,m] = e.preferred_time.split(':').map(Number); const p = h>=12?'PM':'AM'; return `${h%12||12}:${String(m).padStart(2,'0')} ${p}`; })()
    : '—';

  const statusColors = {
    pending_approval: { bg:'#fff3cd', color:'#856404' },
    approved:         { bg:'#d4edda', color:'#155724' },
    upcoming:         { bg:'#d4edda', color:'#155724' },
    rejected:         { bg:'#f8d7da', color:'#721c24' },
    cancelled:        { bg:'#f1f2f6', color:'#747d8c' },
  };
  const sc = statusColors[e.status] || { bg:'#e2e3e5', color:'#383d41' };
  const statusBadge = `<span style="background:${sc.bg};color:${sc.color};padding:3px 8px;border-radius:12px;font-size:0.78rem;font-weight:700">${e.status.replace('_',' ').toUpperCase()}</span>`;
  const privBadge   = e.is_private
    ? `<span style="background:#ede7f6;color:#512da8;padding:3px 7px;border-radius:12px;font-size:0.78rem;">🔒 Private</span>`
    : `<span style="background:#e8f5e9;color:#2e7d32;padding:3px 7px;border-radius:12px;font-size:0.78rem;">🌐 Public</span>`;

  const regCount = (e.participants && e.participants.length) || (e.participant_names && e.participant_names.length) || 0;
  const regNames = e.participant_names && e.participant_names.length ? `Registered (${e.participant_names.length}): ${e.participant_names.join(', ')}` : `${regCount} registered`;

  const actionBtns = [];
  if (e.status === 'pending_approval') {
    actionBtns.push(`<button class="btn btn-primary btn-sm" style="margin-right:4px" onclick="adminEventAction('${e.id}','approve')">✓ Approve</button>`);
    actionBtns.push(`<button class="btn btn-secondary btn-sm" style="border-color:var(--danger);color:var(--danger)" onclick="adminEventAction('${e.id}','reject')">✕ Reject</button>`);
  }
  if (e.status === 'approved' || e.status === 'upcoming') {
    actionBtns.push(`<button class="btn btn-secondary btn-sm" style="border-color:var(--danger);color:var(--danger);margin-right:4px" onclick="adminEventAction('${e.id}','delete')">🗑 Remove</button>`);
  }
  if (!actionBtns.length) {
    actionBtns.push(`<button class="btn btn-secondary btn-sm" onclick="adminEventAction('${e.id}','delete')">🗑 Delete</button>`);
  }

  return `<tr>
    <td class="font-bold" style="max-width:160px">${e.title||'—'}</td>
    <td>${e.host_name||'—'}</td>
    <td style="font-size:0.82rem">${e.phone||'—'}</td>
    <td style="white-space:nowrap">${friendly}</td>
    <td style="white-space:nowrap;font-weight:600">${timeDisplay}</td>
    <td style="text-align:center" title="${regNames}"><span style="font-weight:700;color:var(--espresso,#2c1810)">${regCount}</span> <span style="color:#888;font-size:0.85em">/ ${e.max_participants||30}</span></td>
    <td>${privBadge}</td>
    <td>${statusBadge}</td>
    <td style="white-space:nowrap">${actionBtns.join('')}</td>
  </tr>`;
}

function setEventsFilter(f) {
  adminEventsFilter = f;
  loadAdminEvents();
}

async function adminEventAction(id, action) {
  try {
    if (action === 'approve') {
      await API.patch(`/events/${id}/status`, { status: 'approved' });
      toast('Event approved!', 'success');
    } else if (action === 'reject' || action === 'delete') {
      if (!confirm('Are you sure you want to remove this event?')) return;
      await API.delete(`/events/${id}`);
      toast('Event removed.', 'warning');
    }
    loadAdminEvents();
  } catch (err) {
    toast('Failed: ' + err.message, 'error');
  }
}

function openAddShopEventModal() {
  const now = new Date();
  const dateDefault = now.toISOString().slice(0,10);

  const html = `
    <div style="display:grid;gap:14px;">
      <div class="form-group">
        <label class="form-label">Event Title</label>
        <input type="text" id="sev-title" class="form-control" placeholder="e.g. Latte Art Workshop" required>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="form-group">
          <label class="form-label">Date</label>
          <input type="date" id="sev-date" class="form-control" value="${dateDefault}" required>
        </div>
        <div class="form-group">
          <label class="form-label">Start Time</label>
          <input type="time" id="sev-time" class="form-control" value="14:00">
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="form-group">
          <label class="form-label">Max Guests</label>
          <input type="number" id="sev-max" class="form-control" min="1" max="200" value="30">
        </div>
        <div class="form-group">
          <label class="form-label">Privacy</label>
          <select id="sev-private" class="form-control">
            <option value="false">🌐 Public</option>
            <option value="true">🔒 Private</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Description</label>
        <textarea id="sev-desc" class="form-control" rows="3" placeholder="Describe the event..."></textarea>
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="submitShopEvent()">Create Event</button>
      </div>
    </div>`;
  openModal('➕ Add Shop Event', html);
}

async function submitShopEvent() {
  const title       = document.getElementById('sev-title').value.trim();
  const date        = document.getElementById('sev-date').value;
  const preferred_time = document.getElementById('sev-time').value;
  const max_participants = parseInt(document.getElementById('sev-max').value) || 30;
  const is_private  = document.getElementById('sev-private').value === 'true';
  const description = document.getElementById('sev-desc').value;

  if (!title || !date) { toast('Title and date are required', 'error'); return; }

  try {
    await API.post('/events', {
      title, date, preferred_time, description, is_private, max_participants,
      hostName: 'KapeBara', type: 'shop'
    });
    // Auto-approve shop events
    const events = await API.get('/events');
    const newEv  = events.filter(e => e.title === title && e.date.startsWith(date)).pop();
    if (newEv) await API.patch(`/events/${newEv.id}/status`, { status: 'approved' });

    closeModal();
    toast('Shop event created!', 'success');
    loadAdminEvents();
  } catch (err) {
    toast('Failed: ' + err.message, 'error');
  }
}
