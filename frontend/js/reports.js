let reportCharts = {}, reportPeriod = '7d';
// Store last fetched data for export
let _reportData = null;

async function initReports() {
  const el = document.getElementById('view-reports');
  el.innerHTML = `
    <div class="period-tabs">
      ${['7d','30d','90d'].map(p=>`
        <button class="period-tab ${p===reportPeriod?'active':''}"
          onclick="setReportPeriod('${p}')">${p==='7d'?'Last 7 Days':p==='30d'?'Last 30 Days':'Last 90 Days'}</button>`).join('')}
    </div>
    <div class="flex-center" style="height:200px"><div class="spinner"></div></div>`;
  loadReports();
}

function setReportPeriod(p) { reportPeriod = p; initReports(); }

async function loadReports() {
  try {
    const data = await API.get('/orders/reports/sales?period=' + reportPeriod);
    _reportData = data;
    const { daily, topProducts, byCategory } = data;

    const totalRev = daily.reduce((s,d)=>s+d.revenue,0);
    const totalOrd = daily.reduce((s,d)=>s+d.orders,0);

    const content = document.getElementById('view-reports');
    const tabs = content.querySelector('.period-tabs').outerHTML;

    const periodLabel = reportPeriod==='7d'?'Last 7 Days':reportPeriod==='30d'?'Last 30 Days':'Last 90 Days';

    content.innerHTML = tabs + `
      <!-- Export toolbar -->
      <div style="display:flex;justify-content:flex-end;gap:10px;margin-bottom:16px;">
        <button class="btn btn-secondary btn-sm" onclick="exportReportCSV()" id="export-csv-btn">
          📥 Download CSV
        </button>
        <button class="btn btn-secondary btn-sm" onclick="exportReportPrint()" id="export-print-btn">
          🖨️ Print / Save PDF
        </button>
      </div>

      <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:20px">
        <div class="kpi-card"><div class="kpi-icon">💰</div><div class="kpi-value">${formatPHP(totalRev)}</div><div class="kpi-label">Total Revenue</div></div>
        <div class="kpi-card"><div class="kpi-icon">🧾</div><div class="kpi-value">${totalOrd}</div><div class="kpi-label">Total Orders</div></div>
        <div class="kpi-card"><div class="kpi-icon">📊</div><div class="kpi-value">${formatPHP(totalOrd>0?totalRev/totalOrd:0)}</div><div class="kpi-label">Avg Order Value</div></div>
      </div>

      <div class="charts-grid" style="margin-bottom:20px">
        <div class="card">
          <div class="card-title">Daily Revenue</div>
          <div class="chart-container"><canvas id="rep-rev-chart"></canvas></div>
        </div>
        <div class="card">
          <div class="card-title">Sales by Category</div>
          <div class="chart-container"><canvas id="rep-cat-chart"></canvas></div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">🏆 Top Selling Products</div>
        <div class="table-wrap">
          <table id="report-products-table">
            <thead><tr><th>#</th><th>Product</th><th>Qty Sold</th><th>Revenue</th></tr></thead>
            <tbody>
              ${topProducts.map((p,i)=>`
                <tr>
                  <td><span style="font-weight:700;color:var(--latte)">${i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}</span></td>
                  <td class="font-bold">${p.product_name}</td>
                  <td>${formatNum(p.qty_sold)}</td>
                  <td class="font-bold">${formatPHP(p.revenue)}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;

    // Reattach period tab handlers
    content.querySelectorAll('.period-tab').forEach(btn => {
      btn.onclick = () => setReportPeriod(btn.textContent.includes('7')?'7d':btn.textContent.includes('30')?'30d':'90d');
    });

    Object.values(reportCharts).forEach(c=>c.destroy());
    reportCharts = {};

    const catColors = ['#4a2c0a','#8b5e3c','#f1d6ab','#e0bc88','#2d7a4f','#b87c00'];

    reportCharts.rev = new Chart(document.getElementById('rep-rev-chart'), {
      type: 'bar',
      data: {
        labels: daily.map(d=>d.day.slice(5)),
        datasets: [{ data: daily.map(d=>d.revenue), backgroundColor: 'rgba(74,44,10,.8)', borderRadius: 5, borderSkipped: false }]
      },
      options: { plugins:{legend:{display:false}}, scales:{x:{grid:{display:false}},y:{grid:{color:'#f0e8da'}}} }
    });

    reportCharts.cat = new Chart(document.getElementById('rep-cat-chart'), {
      type: 'doughnut',
      data: {
        labels: byCategory.map(c=>c.category),
        datasets: [{ data: byCategory.map(c=>c.revenue), backgroundColor: catColors, borderWidth: 2, borderColor: '#fff' }]
      },
      options: { plugins:{legend:{position:'bottom',labels:{padding:12,font:{size:11}}}} }
    });

  } catch (err) {
    toast(err.message, 'error');
  }
}

// ── CSV Export ────────────────────────────────────────────────────────────────
function exportReportCSV() {
  if (!_reportData) { toast('No data to export', 'warning'); return; }
  const { daily, topProducts, byCategory } = _reportData;
  const periodLabel = reportPeriod==='7d'?'Last_7_Days':reportPeriod==='30d'?'Last_30_Days':'Last_90_Days';
  const totalRev = daily.reduce((s,d)=>s+d.revenue,0);
  const totalOrd = daily.reduce((s,d)=>s+d.orders,0);

  let csv = `KapeBara Sales Report — ${periodLabel.replace(/_/g,' ')}\n`;
  csv += `Generated:,${new Date().toLocaleString('en-PH')}\n\n`;

  csv += `SUMMARY\n`;
  csv += `Total Revenue,${totalRev.toFixed(2)}\n`;
  csv += `Total Orders,${totalOrd}\n`;
  csv += `Avg Order Value,${(totalOrd > 0 ? totalRev/totalOrd : 0).toFixed(2)}\n\n`;

  csv += `DAILY REVENUE\nDate,Revenue,Orders,Discounts\n`;
  daily.forEach(d => {
    csv += `${d.day},${d.revenue.toFixed(2)},${d.orders},${(d.discounts||0).toFixed(2)}\n`;
  });

  csv += `\nTOP SELLING PRODUCTS\nRank,Product,Qty Sold,Revenue\n`;
  topProducts.forEach((p,i) => {
    csv += `${i+1},${p.product_name},${p.qty_sold},${p.revenue.toFixed(2)}\n`;
  });

  csv += `\nSALES BY CATEGORY\nCategory,Revenue,Qty\n`;
  byCategory.forEach(c => {
    csv += `${c.category||'Uncategorized'},${c.revenue.toFixed(2)},${c.qty}\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href     = url;
  link.download = `KapeBara_Report_${periodLabel}_${new Date().toISOString().slice(0,10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  toast('CSV downloaded!', 'success');
}

// ── Print / PDF Export ────────────────────────────────────────────────────────
function exportReportPrint() {
  if (!_reportData) { toast('No data to export', 'warning'); return; }
  const { daily, topProducts, byCategory } = _reportData;
  const periodLabel = reportPeriod==='7d'?'Last 7 Days':reportPeriod==='30d'?'Last 30 Days':'Last 90 Days';
  const totalRev = daily.reduce((s,d)=>s+d.revenue,0);
  const totalOrd = daily.reduce((s,d)=>s+d.orders,0);

  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html><head>
    <title>KapeBara Sales Report — ${periodLabel}</title>
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
    </style>
  </head><body>
    <h1>☕ KapeBara — Sales Report</h1>
    <p>Period: <strong>${periodLabel}</strong> &nbsp;|&nbsp; Generated: ${new Date().toLocaleString('en-PH')}</p>
    <div class="summary">
      <div class="kpi"><div class="kpi-val">₱${totalRev.toLocaleString('en-PH',{minimumFractionDigits:2})}</div><div class="kpi-lbl">Total Revenue</div></div>
      <div class="kpi"><div class="kpi-val">${totalOrd}</div><div class="kpi-lbl">Total Orders</div></div>
      <div class="kpi"><div class="kpi-val">₱${(totalOrd>0?totalRev/totalOrd:0).toLocaleString('en-PH',{minimumFractionDigits:2})}</div><div class="kpi-lbl">Avg Order Value</div></div>
    </div>
    <h2>Daily Revenue</h2>
    <table><thead><tr><th>Date</th><th>Revenue</th><th>Orders</th><th>Discounts</th></tr></thead><tbody>
    ${daily.map(d=>`<tr><td>${d.day}</td><td>₱${d.revenue.toFixed(2)}</td><td>${d.orders}</td><td>₱${(d.discounts||0).toFixed(2)}</td></tr>`).join('')}
    </tbody></table>
    <h2>Top Selling Products</h2>
    <table><thead><tr><th>#</th><th>Product</th><th>Qty Sold</th><th>Revenue</th></tr></thead><tbody>
    ${topProducts.map((p,i)=>`<tr><td>${i+1}</td><td>${p.product_name}</td><td>${p.qty_sold}</td><td>₱${p.revenue.toFixed(2)}</td></tr>`).join('')}
    </tbody></table>
    <h2>Sales by Category</h2>
    <table><thead><tr><th>Category</th><th>Revenue</th><th>Qty</th></tr></thead><tbody>
    ${byCategory.map(c=>`<tr><td>${c.category||'Uncategorized'}</td><td>₱${c.revenue.toFixed(2)}</td><td>${c.qty}</td></tr>`).join('')}
    </tbody></table>
  </body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 500);
}
