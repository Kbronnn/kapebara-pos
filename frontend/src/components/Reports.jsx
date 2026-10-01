import React, { useState, useEffect, useRef } from 'react';
import { API, toast, formatPHP, formatNum } from '../api';
import Chart from 'chart.js/auto';

const PERIODS = ['7d', '30d', '90d'];
const PERIOD_LABELS = { '7d': 'Last 7 Days', '30d': 'Last 30 Days', '90d': 'Last 90 Days' };

// Palette for multi-line product chart
const PRODUCT_COLORS = [
  { border: '#4a2c0a', bg: 'rgba(74,44,10,0.12)' },
  { border: '#c0392b', bg: 'rgba(192,57,43,0.12)' },
  { border: '#2980b9', bg: 'rgba(41,128,185,0.12)' },
  { border: '#27ae60', bg: 'rgba(39,174,96,0.12)' },
  { border: '#8e44ad', bg: 'rgba(142,68,173,0.12)' },
];

export default function Reports() {
  const [period, setPeriod] = useState('7d');
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState(null);
  const [compareMode, setCompareMode] = useState('daily'); // 'daily' | 'weekly'

  const revChartRef = useRef(null);
  const catChartRef = useRef(null);
  const sourceChartRef = useRef(null);
  const productLineChartRef = useRef(null);
  const revChartInst = useRef(null);
  const catChartInst = useRef(null);
  const sourceChartInst = useRef(null);
  const productLineChartInst = useRef(null);

  useEffect(() => {
    loadReports();
  }, [period]);

  const loadReports = async () => {
    setLoading(true);
    try {
      const data = await API.get('/orders/reports/sales?period=' + period);
      setReportData(data);
      setLoading(false);
    } catch (err) {
      toast(err.message, 'error');
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!reportData || loading) return;
    const { daily, byCategory, topProducts, sourceBreakdown } = reportData;
    const catColors = ['#4a2c0a', '#8b5e3c', '#f1d6ab', '#e0bc88', '#2d7a4f', '#b87c00'];

    // Destroy all existing charts
    [revChartInst, catChartInst, sourceChartInst, productLineChartInst].forEach(r => {
      if (r.current) { r.current.destroy(); r.current = null; }
    });

    // 1. Daily Revenue Bar Chart
    if (revChartRef.current) {
      revChartInst.current = new Chart(revChartRef.current, {
        type: 'bar',
        data: {
          labels: daily.map(d => d.day.slice(5)),
          datasets: [{ data: daily.map(d => d.revenue), backgroundColor: 'rgba(74,44,10,.8)', borderRadius: 5, borderSkipped: false }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { grid: { color: '#f0e8da' } } } }
      });
    }

    // 2. Sales by Category Doughnut
    if (catChartRef.current) {
      catChartInst.current = new Chart(catChartRef.current, {
        type: 'doughnut',
        data: {
          labels: byCategory.map(c => c.category),
          datasets: [{ data: byCategory.map(c => c.revenue), backgroundColor: catColors, borderWidth: 2, borderColor: '#fff' }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { padding: 12, font: { size: 11 } } } } }
      });
    }

    // 3. Walk-in vs Portal Pie Chart
    const posCount = (sourceBreakdown && sourceBreakdown.pos) || 0;
    const portalCount = (sourceBreakdown && sourceBreakdown.portal) || 0;
    if (sourceChartRef.current && (posCount + portalCount) > 0) {
      sourceChartInst.current = new Chart(sourceChartRef.current, {
        type: 'pie',
        data: {
          labels: ['Walk-in (POS)', 'Portal Orders'],
          datasets: [{
            data: [posCount, portalCount],
            backgroundColor: ['#4a2c0a', '#d351aeff'],
            borderColor: ['#fff', '#fff'],
            borderWidth: 3
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { padding: 14, font: { size: 12 }, usePointStyle: true } },
            tooltip: {
              callbacks: {
                label: ctx => {
                  const total = posCount + portalCount;
                  const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : 0;
                  return ` ${ctx.label}: ${ctx.parsed} (${pct}%)`;
                }
              }
            }
          }
        }
      });
    }

    // 4. Multi-colored Line Graph — Revenue by Top-5 Products (Daily or Weekly comparison)
    const top5 = (topProducts || []).slice(0, 5);
    const allDays = daily.map(d => d.day);
    if (productLineChartRef.current && top5.length > 0) {
      const breakdown = reportData.productDailyBreakdown || {};

      let chartLabels = [];
      let getProductRevenue = null;

      if (compareMode === 'weekly') {
        // Group available days into 7-day weekly cohorts for LSTM trend comparison
        const weekBuckets = [];
        allDays.forEach((day, idx) => {
          const bucketIndex = Math.floor(idx / 7);
          if (!weekBuckets[bucketIndex]) {
            weekBuckets[bucketIndex] = {
              label: `Wk ${bucketIndex + 1} (${day.slice(5)})`,
              days: []
            };
          }
          weekBuckets[bucketIndex].days.push(day);
        });

        chartLabels = weekBuckets.map(b => b.label);
        getProductRevenue = (prodName) => {
          const pMap = breakdown[prodName] || {};
          return weekBuckets.map(bucket => bucket.days.reduce((acc, d) => acc + (pMap[d] || 0), 0));
        };
      } else {
        chartLabels = allDays.map(d => d.slice(5));
        getProductRevenue = (prodName) => {
          const pMap = breakdown[prodName] || {};
          return allDays.map(day => pMap[day] || 0);
        };
      }

      productLineChartInst.current = new Chart(productLineChartRef.current, {
        type: 'line',
        data: {
          labels: chartLabels,
          datasets: top5.map((prod, idx) => {
            const col = PRODUCT_COLORS[idx % PRODUCT_COLORS.length];
            return {
              label: prod.product_name,
              data: getProductRevenue(prod.product_name),
              borderColor: col.border,
              backgroundColor: col.bg,
              fill: false,
              tension: 0.35,
              pointRadius: 4.5,
              pointHoverRadius: 7,
              pointBackgroundColor: col.border,
              borderWidth: 2.5,
            };
          })
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { position: 'top', labels: { padding: 12, font: { size: 11 }, usePointStyle: true } },
            tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${formatPHP(ctx.parsed.y)}` } }
          },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 11 } } },
            y: { grid: { color: '#f0e8da' }, ticks: { font: { size: 11 }, callback: v => '₱' + v.toLocaleString() } }
          }
        }
      });
    }

    return () => {
      [revChartInst, catChartInst, sourceChartInst, productLineChartInst].forEach(r => {
        if (r.current) { r.current.destroy(); r.current = null; }
      });
    };
  }, [reportData, loading, compareMode]);

  const handleExportCSV = () => {
    if (!reportData) { toast('No data to export', 'warning'); return; }
    const { daily, topProducts, byCategory } = reportData;
    const pLabel = period === '7d' ? 'Last_7_Days' : period === '30d' ? 'Last_30_Days' : 'Last_90_Days';
    const totalRev = daily.reduce((s, d) => s + d.revenue, 0);
    const totalOrd = daily.reduce((s, d) => s + d.orders, 0);

    let csv = `KapeBara Sales Report — ${pLabel.replace(/_/g, ' ')}\n`;
    csv += `Generated:,${new Date().toLocaleString('en-PH')}\n\n`;
    csv += `SUMMARY\nTotal Revenue,${totalRev.toFixed(2)}\nTotal Orders,${totalOrd}\nAvg Order Value,${(totalOrd > 0 ? totalRev / totalOrd : 0).toFixed(2)}\n\n`;
    csv += `DAILY REVENUE\nDate,Revenue,Orders,Discounts\n`;
    daily.forEach(d => { csv += `${d.day},${d.revenue.toFixed(2)},${d.orders},${(d.discounts || 0).toFixed(2)}\n`; });
    csv += `\nTOP SELLING PRODUCTS\nRank,Product,Qty Sold,Revenue\n`;
    topProducts.forEach((p, i) => { csv += `${i + 1},${p.product_name},${p.qty_sold},${p.revenue.toFixed(2)}\n`; });
    csv += `\nSALES BY CATEGORY\nCategory,Revenue,Qty\n`;
    byCategory.forEach(c => { csv += `${c.category || 'Uncategorized'},${c.revenue.toFixed(2)},${c.qty}\n`; });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `KapeBara_Report_${pLabel}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast('CSV downloaded!', 'success');
  };

  const handlePrint = () => {
    if (!reportData) { toast('No data to export', 'warning'); return; }
    const { daily, topProducts, byCategory } = reportData;
    const pLabel = PERIOD_LABELS[period];
    const totalRev = daily.reduce((s, d) => s + d.revenue, 0);
    const totalOrd = daily.reduce((s, d) => s + d.orders, 0);

    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head>
      <title>KapeBara Sales Report — ${pLabel}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:30px;color:#222;}
        h1{color:#4a2c0a;} h2{color:#6b3e1a;border-bottom:1px solid #ccc;padding-bottom:6px;}
        table{width:100%;border-collapse:collapse;margin-bottom:24px;}
        th{background:#4a2c0a;color:#fff;padding:8px;text-align:left;}
        td{padding:7px;border-bottom:1px solid #eee;}
        .summary{display:flex;gap:30px;margin-bottom:24px;}
        .kpi{background:#fdf6ed;border:1px solid #e0bc88;border-radius:8px;padding:16px 24px;text-align:center;}
        .kpi-val{font-size:1.6rem;font-weight:700;color:#4a2c0a;}
        .kpi-lbl{font-size:0.8rem;color:#888;}
      </style></head><body>
      <h1>☕ KapeBara — Sales Report</h1>
      <p>Period: <strong>${pLabel}</strong> &nbsp;|&nbsp; Generated: ${new Date().toLocaleString('en-PH')}</p>
      <div class="summary">
        <div class="kpi"><div class="kpi-val">₱${totalRev.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div><div class="kpi-lbl">Total Revenue</div></div>
        <div class="kpi"><div class="kpi-val">${totalOrd}</div><div class="kpi-lbl">Total Orders</div></div>
        <div class="kpi"><div class="kpi-val">₱${(totalOrd > 0 ? totalRev / totalOrd : 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div><div class="kpi-lbl">Avg Order Value</div></div>
      </div>
      <h2>Daily Revenue</h2>
      <table><thead><tr><th>Date</th><th>Revenue</th><th>Orders</th><th>Discounts</th></tr></thead><tbody>
      ${daily.map(d => `<tr><td>${d.day}</td><td>₱${d.revenue.toFixed(2)}</td><td>${d.orders}</td><td>₱${(d.discounts || 0).toFixed(2)}</td></tr>`).join('')}
      </tbody></table>
      <h2>Top Selling Products</h2>
      <table><thead><tr><th>#</th><th>Product</th><th>Qty Sold</th><th>Revenue</th></tr></thead><tbody>
      ${topProducts.map((p, i) => `<tr><td>${i + 1}</td><td>${p.product_name}</td><td>${p.qty_sold}</td><td>₱${p.revenue.toFixed(2)}</td></tr>`).join('')}
      </tbody></table>
      <h2>Sales by Category</h2>
      <table><thead><tr><th>Category</th><th>Revenue</th><th>Qty</th></tr></thead><tbody>
      ${byCategory.map(c => `<tr><td>${c.category || 'Uncategorized'}</td><td>₱${c.revenue.toFixed(2)}</td><td>${c.qty}</td></tr>`).join('')}
      </tbody></table>
    </body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 500);
  };

  return (
    <div>
      {/* Period Tabs */}
      <div className="period-tabs">
        {PERIODS.map(p => (
          <button
            key={p}
            className={`period-tab ${p === period ? 'active' : ''}`}
            onClick={() => setPeriod(p)}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex-center" style={{ height: '200px' }}><div className="spinner"></div></div>
      ) : reportData && (
        <>
          {/* Export toolbar */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginBottom: '16px' }}>
            <button className="btn btn-secondary btn-sm" onClick={handleExportCSV}>📥 Download CSV</button>
            <button className="btn btn-secondary btn-sm" onClick={handlePrint}>🖨️ Print / Save PDF</button>
          </div>

          {/* KPI Summary */}
          <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '20px' }}>
            <div className="kpi-card">
              <div className="kpi-icon">💰</div>
              <div className="kpi-value">{formatPHP(reportData.daily.reduce((s, d) => s + d.revenue, 0))}</div>
              <div className="kpi-label">Total Revenue</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-icon">🧾</div>
              <div className="kpi-value">{reportData.daily.reduce((s, d) => s + d.orders, 0)}</div>
              <div className="kpi-label">Total Orders</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-icon">📊</div>
              <div className="kpi-value">
                {(() => {
                  const rev = reportData.daily.reduce((s, d) => s + d.revenue, 0);
                  const ord = reportData.daily.reduce((s, d) => s + d.orders, 0);
                  return formatPHP(ord > 0 ? rev / ord : 0);
                })()}
              </div>
              <div className="kpi-label">Avg Order Value</div>
            </div>
          </div>

          {/* Charts — Row 1: Daily Revenue + Category */}
          <div className="charts-grid" style={{ marginBottom: '20px' }}>
            <div className="card">
              <div className="card-title">Daily Revenue</div>
              <div className="chart-container" style={{ height: '220px' }}>
                <canvas ref={revChartRef}></canvas>
              </div>
            </div>
            <div className="card">
              <div className="card-title">Sales by Category</div>
              <div className="chart-container" style={{ height: '220px' }}>
                <canvas ref={catChartRef}></canvas>
              </div>
            </div>
          </div>

          {/* Charts — Row 2: Multi-line Product Revenue + Walk-in vs Portal */}
          <div className="charts-grid" style={{ marginBottom: '20px' }}>
            <div className="card" style={{ gridColumn: 'span 1' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div className="card-title" style={{ margin: 0 }}>
                  📈 {compareMode === 'weekly' ? 'Weekly' : 'Daily'} Revenue by Top Products
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {['daily', 'weekly'].map(m => (
                    <button key={m} onClick={() => setCompareMode(m)}
                      style={{
                        padding: '4px 12px', borderRadius: '8px', border: '1.5px solid var(--border)',
                        background: compareMode === m ? 'var(--espresso)' : '#fff',
                        color: compareMode === m ? 'var(--cream)' : 'var(--espresso)',
                        fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer'
                      }}>
                      {m.charAt(0).toUpperCase() + m.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="chart-container" style={{ height: '240px' }}>
                <canvas ref={productLineChartRef}></canvas>
              </div>
              <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: '6px', textAlign: 'center' }}>
                Multi-colored lines represent the top 5 best-selling products — useful for LSTM forecasting focus areas
              </div>
            </div>
            <div className="card">
              <div className="card-title">🥧 Walk-in vs Portal Orders</div>
              <div className="chart-container" style={{ height: '220px' }}>
                <canvas ref={sourceChartRef}></canvas>
              </div>
              {reportData.sourceBreakdown && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '10px', fontSize: '0.8rem' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 800, fontSize: '1.2rem', color: '#4a2c0a' }}>{reportData.sourceBreakdown.pos || 0}</div>
                    <div style={{ color: 'var(--text-muted)' }}>Walk-in</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 800, fontSize: '1.2rem', color: '#8e44ad' }}>{reportData.sourceBreakdown.portal || 0}</div>
                    <div style={{ color: 'var(--text-muted)' }}>Portal</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Top Products Table */}
          <div className="card">
            <div className="card-title">🏆 Top Selling Products</div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>#</th><th>Product</th><th>Qty Sold</th><th>Revenue</th></tr>
                </thead>
                <tbody>
                  {reportData.topProducts.map((p, i) => (
                    <tr key={i}>
                      <td>
                        <span style={{ fontWeight: 700, color: 'var(--latte)' }}>
                          {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                        </span>
                      </td>
                      <td className="font-bold">{p.product_name}</td>
                      <td>{formatNum(p.qty_sold)}</td>
                      <td className="font-bold">{formatPHP(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
