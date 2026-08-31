import React, { useState, useEffect, useCallback } from 'react';
import { API, toast } from '../api';

const LOYALTY_COLORS = {
  Bronze: { bg: '#cd7f32', text: '#fff' },
  Silver: { bg: '#a8a9ad', text: '#fff' },
  Gold:   { bg: '#d4a017', text: '#fff' },
};

function LoyaltyBadge({ level }) {
  const style = LOYALTY_COLORS[level] || LOYALTY_COLORS.Bronze;
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: '999px',
      background: style.bg,
      color: style.text,
      fontSize: '0.72rem',
      fontWeight: 700,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
    }}>
      {level || 'Bronze'}
    </span>
  );
}

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterLevel, setFilterLevel] = useState('all');
  const [selected, setSelected] = useState(null);
  const [addingPoints, setAddingPoints] = useState(false);
  const [manualPoints, setManualPoints] = useState('');
  const [pointsMsg, setPointsMsg] = useState('');

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await API.get('/customer/all');
      setCustomers(data);
    } catch {
      toast('Failed to load customers', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadCustomers(); }, [loadCustomers]);

  const filtered = customers.filter(c => {
    const matchSearch = !search ||
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase()) ||
      c.unique_id?.includes(search) ||
      c.phone?.includes(search);
    const matchLevel = filterLevel === 'all' || c.loyalty_level === filterLevel;
    return matchSearch && matchLevel;
  });

  async function handleAddPoints(e) {
    e.preventDefault();
    if (!selected || !manualPoints) return;
    setAddingPoints(true);
    setPointsMsg('');
    try {
      const pts = parseInt(manualPoints);
      if (isNaN(pts) || pts <= 0) throw new Error('Enter a valid positive number');
      // Use add-points endpoint with a synthetic order_total (pts * 10 = ₱ value)
      const res = await fetch(`/api/customer/add-points`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unique_id: selected.unique_id, order_total: pts * 10 })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setPointsMsg(`✅ ${data.message} — Total: ${data.new_total} pts (${data.loyalty_level})`);
      setManualPoints('');
      await loadCustomers();
      // Refresh selected customer info
      const updated = customers.find(c => c._id === selected._id);
      if (updated) setSelected({ ...updated, points: data.new_total, loyalty_level: data.loyalty_level });
    } catch (err) {
      setPointsMsg(`❌ ${err.message}`);
    } finally {
      setAddingPoints(false);
    }
  }

  async function handleDeleteCustomer() {
    if (!selected) return;
    if (!window.confirm(`Are you sure you want to delete the customer account for "${selected.name}" (${selected.email || 'No email'})? This action cannot be undone.`)) return;
    try {
      await API.delete(`/customer/${selected._id || selected.id}`);
      toast('Customer deleted successfully', 'success');
      setSelected(null);
      loadCustomers();
    } catch (err) {
      toast(err.message || 'Failed to delete customer', 'error');
    }
  }

  const totalCustomers = customers.length;
  const goldCount   = customers.filter(c => c.loyalty_level === 'Gold').length;
  const silverCount = customers.filter(c => c.loyalty_level === 'Silver').length;
  const bronzeCount = customers.filter(c => c.loyalty_level === 'Bronze' || !c.loyalty_level).length;

  return (
    <div style={{ padding: '0 0 40px' }}>
      {/* Stats Row */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {[
          { label: 'Total Customers', value: totalCustomers, icon: '👥', color: '#d4a373' },
          { label: 'Gold Members',    value: goldCount,      icon: '🥇', color: '#d4a017' },
          { label: 'Silver Members',  value: silverCount,    icon: '🥈', color: '#a8a9ad' },
          { label: 'Bronze Members',  value: bronzeCount,    icon: '🥉', color: '#cd7f32' },
        ].map(stat => (
          <div key={stat.label} style={{
            flex: '1 1 160px',
            background: 'var(--card-bg)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '18px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
          }}>
            <span style={{ fontSize: '2rem' }}>{stat.icon}</span>
            <div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: stat.color }}>{stat.value}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* Customer List Panel */}
        <div style={{ flex: '1 1 420px', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="🔍 Search by name, email, ID, phone…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                flex: 1, minWidth: '180px',
                padding: '8px 12px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg)',
                color: 'var(--text)',
                fontSize: '0.85rem',
              }}
            />
            <select
              value={filterLevel}
              onChange={e => setFilterLevel(e.target.value)}
              style={{
                padding: '8px 12px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg)',
                color: 'var(--text)',
                fontSize: '0.85rem',
              }}
            >
              <option value="all">All Tiers</option>
              <option value="Gold">Gold</option>
              <option value="Silver">Silver</option>
              <option value="Bronze">Bronze</option>
            </select>
            <button
              onClick={loadCustomers}
              style={{ padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text)' }}
            >↻ Refresh</button>
          </div>

          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading customers…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              {search || filterLevel !== 'all' ? 'No customers match your filter.' : 'No registered customers yet.'}
            </div>
          ) : (
            <div style={{ maxHeight: '520px', overflowY: 'auto' }}>
              {filtered.map(c => (
                <div
                  key={c._id}
                  onClick={() => { setSelected(c); setPointsMsg(''); setManualPoints(''); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    padding: '14px 20px',
                    borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                    background: selected?._id === c._id ? 'rgba(212,163,115,0.1)' : 'transparent',
                    transition: 'background 0.15s',
                  }}
                >
                  {/* Avatar */}
                  <div style={{
                    width: '42px', height: '42px', borderRadius: '50%',
                    background: 'var(--tan-light, #f1d6ab)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: '1.1rem', color: 'var(--mocha)',
                    flexShrink: 0, overflow: 'hidden',
                  }}>
                    {c.avatar_url
                      ? <img src={c.avatar_url} alt={c.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : (c.name || '?').slice(0, 2).toUpperCase()
                    }
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>{c.email || '—'}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <LoyaltyBadge level={c.loyalty_level} />
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>{c.points ?? 0} pts</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {selected ? (
          <div style={{ flex: '0 1 340px', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '24px', minWidth: '280px' }}>
            {/* Avatar */}
            <div style={{ textAlign: 'center', marginBottom: '18px' }}>
              <div style={{
                width: '72px', height: '72px', borderRadius: '50%',
                background: 'var(--tan-light, #f1d6ab)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: '1.8rem', color: 'var(--mocha)',
                overflow: 'hidden', margin: '0 auto',
              }}>
                {selected.avatar_url
                  ? <img src={selected.avatar_url} alt={selected.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : (selected.name || '?').slice(0, 2).toUpperCase()
                }
              </div>
              <div style={{ fontWeight: 700, fontSize: '1.1rem', marginTop: '10px', color: 'var(--text)' }}>{selected.name}</div>
              <div style={{ marginTop: '6px' }}><LoyaltyBadge level={selected.loyalty_level} /></div>
            </div>

            {/* Info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem', marginBottom: '20px' }}>
              {[
                { label: '📧 Email',       value: selected.email || '—' },
                { label: '📱 Phone',       value: selected.phone || '—' },
                { label: '🎂 Birthday',    value: selected.birthdate || '—' },
                { label: '🏷️ Loyalty ID', value: selected.unique_id || '—' },
                { label: '⭐ Points',      value: `${selected.points ?? 0} pts` },
                { label: '📅 Joined',      value: selected.created_at ? new Date(selected.created_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—' },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{row.label}</span>
                  <span style={{ fontWeight: 600, color: 'var(--text)', maxWidth: '180px', textAlign: 'right', wordBreak: 'break-word' }}>{row.value}</span>
                </div>
              ))}
            </div>

            {/* Manual Point Add */}
            {selected.unique_id && (
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '10px', color: 'var(--text)' }}>➕ Add Points Manually</div>
                <form onSubmit={handleAddPoints} style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="number"
                    min="1"
                    placeholder="Points to add"
                    value={manualPoints}
                    onChange={e => setManualPoints(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '8px 10px',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg)',
                      color: 'var(--text)',
                      fontSize: '0.85rem',
                    }}
                  />
                  <button
                    type="submit"
                    disabled={addingPoints}
                    className="btn btn-primary"
                    style={{ padding: '8px 14px', fontSize: '0.82rem' }}
                  >
                    {addingPoints ? '…' : 'Add'}
                  </button>
                </form>
                {pointsMsg && (
                  <div style={{ marginTop: '10px', fontSize: '0.8rem', color: pointsMsg.startsWith('✅') ? 'var(--success, #2e7d32)' : 'var(--danger, #c0392b)', lineHeight: 1.4 }}>
                    {pointsMsg}
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => setSelected(null)}
              style={{ marginTop: '18px', width: '100%', padding: '8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.82rem' }}
            >
              ✕ Close
            </button>

            <button
              onClick={handleDeleteCustomer}
              style={{
                marginTop: '10px',
                width: '100%',
                padding: '8px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid #f5c6c6',
                background: '#fde8e8',
                color: '#c0392b',
                cursor: 'pointer',
                fontSize: '0.82rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              🗑️ Delete Customer Account
            </button>
          </div>
        ) : (
          <div style={{ flex: '0 1 340px', background: 'var(--card-bg)', border: '1px dashed var(--border)', borderRadius: 'var(--radius)', padding: '40px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', minWidth: '280px' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>👆</div>
            <div>Select a customer from the list to view their details and manage loyalty points.</div>
          </div>
        )}
      </div>
    </div>
  );
}
