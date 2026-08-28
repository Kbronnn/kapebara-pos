import React, { useState, useEffect, useRef } from 'react';
import { API, toast, formatNum } from '../api';
import Chart from 'chart.js/auto';

export default function Forecast() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [selectedIngId, setSelectedIngId] = useState(null);
  const [error, setError] = useState(null);
  const chartRef = useRef(null);
  const chartInst = useRef(null);

  useEffect(() => {
    loadForecast();
  }, []);

  const loadForecast = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await API.get('/forecast');
      setData(result);
      if (result.length > 0) setSelectedIngId(result[0].id);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  // Build chart when data or selected changes
  useEffect(() => {
    if (!data.length || !selectedIngId || !chartRef.current) return;
    const item = data.find(d => d.id === selectedIngId) || data[0];
    if (!item || !item.chart) return;

    if (chartInst.current) { chartInst.current.destroy(); chartInst.current = null; }

    const histLabels = item.chart.historical.map(h => h.day.slice(5));
    const histData   = item.chart.historical.map(h => h.used);
    const projLabels = item.chart.projection.map((_, i) => `Day +${i + 1}`);
    const projData   = item.chart.projection.map(p => p.projected);

    chartInst.current = new Chart(chartRef.current, {
      type: 'line',
      data: {
        labels: [...histLabels, ...projLabels],
        datasets: [
          {
            label: 'Actual Usage',
            data: [...histData, ...Array(projLabels.length).fill(null)],
            borderColor: '#4a2c0a',
            backgroundColor: 'rgba(74,44,10,.1)',
            fill: true, tension: 0.3, pointRadius: 3
          },
          {
            label: 'Forecasted',
            data: [...Array(histLabels.length).fill(null), ...projData],
            borderColor: '#b87c00',
            borderDash: [6, 3],
            backgroundColor: 'rgba(184,124,0,.08)',
            fill: true, tension: 0, pointRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'top' } },
        scales: {
          x: { grid: { display: false }, ticks: { maxTicksLimit: 14, font: { size: 10 } } },
          y: { grid: { color: '#f0e8da' }, title: { display: true, text: item.unit } }
        }
      }
    });

    return () => { if (chartInst.current) chartInst.current.destroy(); };
  }, [data, selectedIngId]);

  if (loading) return <div className="flex-center" style={{ height: '400px' }}><div className="spinner"></div></div>;
  if (error) return <div className="empty-state"><div className="empty-state-icon">⚠️</div><p>{error}</p></div>;

  const needRestock = data.filter(d => d.restock_needed > 0);
  const sorted = [...data].sort((a, b) => a.days_remaining - b.days_remaining);

  return (
    <div>
      <div className="forecast-grid">
        {/* Restock Recommendations */}
        <div className="card">
          <div className="card-title">📦 Restock Recommendations (Next 7 Days)</div>
          {needRestock.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px' }}>
              <div className="empty-state-icon">✅</div>
              <p>No restocking needed!</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Ingredient</th><th>Current</th><th>Avg/Day</th>
                    <th>7-Day Need</th><th>Order Now</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {needRestock.map((d, idx) => (
                    <tr key={idx}>
                      <td className="font-bold">{d.name}</td>
                      <td>{formatNum(d.current_stock)} {d.unit}</td>
                      <td>{d.avg_daily_use} {d.unit}</td>
                      <td>{d.projected_7d} {d.unit}</td>
                      <td className="font-bold" style={{ color: 'var(--danger)' }}>{d.restock_needed} {d.unit}</td>
                      <td><span className={`badge badge-${d.status}`}>{d.status.toUpperCase()}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Days of Stock Remaining Meters */}
        <div className="card">
          <div className="card-title">📅 Days of Stock Remaining</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {sorted.map((d, idx) => {
              const urgent = d.days_remaining <= 3;
              const warn   = d.days_remaining <= 7;
              const color  = urgent ? 'var(--danger)' : warn ? 'var(--warning)' : 'var(--success)';
              const targetPct = Math.min(100, (d.days_remaining / 30) * 100);

              return (
                <div key={idx}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.82rem', marginBottom: '4px' }}>
                    <span className="font-bold">{d.name}</span>
                    <span style={{ color, fontWeight: 600 }}>{d.days_remaining >= 999 ? '∞' : `${d.days_remaining}d`}</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', borderRadius: '4px', background: 'var(--border)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: '4px', background: color, width: `${targetPct}%`, transition: 'width 0.9s cubic-bezier(.4,0,.2,1)' }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Historical Usage Chart */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <span className="card-title" style={{ margin: 0, whiteSpace: 'nowrap' }}>📈 Historical Usage</span>
          <select
            className="form-control"
            style={{ width: '220px', flex: '0 0 auto' }}
            value={selectedIngId || ''}
            onChange={(e) => setSelectedIngId(e.target.value)}
          >
            {data.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        <div className="chart-container" style={{ height: '280px' }}>
          <canvas ref={chartRef}></canvas>
        </div>
      </div>
    </div>
  );
}
