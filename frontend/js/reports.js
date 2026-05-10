let reportCharts = {}, reportPeriod = '7d';

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
    const { daily, topProducts, byCategory } = data;

    const totalRev = daily.reduce((s,d)=>s+d.revenue,0);
    const totalOrd = daily.reduce((s,d)=>s+d.orders,0);

    const content = document.getElementById('view-reports');
    const tabs = content.querySelector('.period-tabs').outerHTML;

    content.innerHTML = tabs + `
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
          <table>
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
