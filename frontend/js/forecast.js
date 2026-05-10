let forecastChart = null;

async function initForecast() {
  const el = document.getElementById('view-forecast');
  el.innerHTML = `<div class="flex-center" style="height:200px"><div class="spinner"></div></div>`;
  try {
    const data = await API.get('/forecast');
    renderForecast(data);
  } catch (err) {
    el.innerHTML = `<div class="empty-state"><p>${err.message}</p></div>`;
  }
}

function renderForecast(data) {
  const el = document.getElementById('view-forecast');
  const needRestock = data.filter(d => d.restock_needed > 0);

  el.innerHTML = `
    <div class="forecast-grid">
      <div class="card">
        <div class="card-title">📦 Restock Recommendations (Next 7 Days)</div>
        ${needRestock.length === 0
          ? '<div class="empty-state" style="padding:24px"><div class="empty-state-icon">✅</div><p>No restocking needed!</p></div>'
          : `<div class="table-wrap"><table>
              <thead><tr><th>Ingredient</th><th>Current</th><th>Avg/Day</th><th>7-Day Need</th><th>Order Now</th><th>Status</th></tr></thead>
              <tbody>
                ${needRestock.map(d => `
                  <tr>
                    <td class="font-bold">${d.name}</td>
                    <td>${formatNum(d.current_stock)} ${d.unit}</td>
                    <td>${d.avg_daily_use} ${d.unit}</td>
                    <td>${d.projected_7d} ${d.unit}</td>
                    <td class="font-bold" style="color:var(--danger)">${d.restock_needed} ${d.unit}</td>
                    <td><span class="badge badge-${d.status}">${d.status.toUpperCase()}</span></td>
                  </tr>`).join('')}
              </tbody>
            </table></div>`}
      </div>

      <div class="card">
        <div class="card-title">📅 Days of Stock Remaining</div>
        <div style="display:flex;flex-direction:column;gap:10px">
          ${data.sort((a,b) => a.days_remaining - b.days_remaining).map(d => {
            const urgent = d.days_remaining <= 3;
            const warn   = d.days_remaining <= 7;
            const color  = urgent ? 'var(--danger)' : warn ? 'var(--warning)' : 'var(--success)';
            const pct    = Math.min(100, (d.days_remaining / 30) * 100);
            return `
              <div>
                <div style="display:flex;justify-content:space-between;font-size:.82rem;margin-bottom:3px">
                  <span class="font-bold">${d.name}</span>
                  <span style="color:${color};font-weight:600">${d.days_remaining >= 999 ? '∞' : d.days_remaining + 'd'}</span>
                </div>
                <div class="stock-bar-wrap" style="width:100%">
                  <div style="height:6px;border-radius:3px;background:${color};width:${pct}%;transition:width .4s"></div>
                </div>
              </div>`;
          }).join('')}
        </div>
      </div>
    </div>

    <div class="card">
      <div class="section-header">
        <span class="card-title" style="margin:0">📈 Historical Usage — Select Ingredient</span>
        <select class="form-control" style="width:220px" id="forecast-select" onchange="renderForecastChart(forecastData)">
          ${data.map(d => `<option value="${d.id}">${d.name}</option>`).join('')}
        </select>
      </div>
      <div class="chart-container" style="height:280px"><canvas id="forecast-chart"></canvas></div>
    </div>`;

  window.forecastData = data;
  renderForecastChart(data);
}

function renderForecastChart(data) {
  const selId = parseInt(document.getElementById('forecast-select')?.value);
  const item  = data.find(d => d.id === selId) || data[0];
  if (!item) return;

  if (forecastChart) { forecastChart.destroy(); forecastChart = null; }

  const histLabels = item.chart.historical.map(h => h.day.slice(5));
  const histData   = item.chart.historical.map(h => h.used);
  const projLabels = item.chart.projection.map((_, i) => `Day +${i+1}`);
  const projData   = item.chart.projection.map(p => p.projected);

  forecastChart = new Chart(document.getElementById('forecast-chart'), {
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
      plugins: { legend: { position: 'top' } },
      scales: {
        x: { grid: { display: false }, ticks: { maxTicksLimit: 14, font: { size: 10 } } },
        y: { grid: { color: '#f0e8da' }, title: { display: true, text: item.unit } }
      }
    }
  });
}
