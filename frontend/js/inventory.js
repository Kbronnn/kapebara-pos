async function initInventory() {
  const el = document.getElementById('view-inventory');
  el.innerHTML = `<div class="flex-center" style="height:200px"><div class="spinner"></div></div>`;
  try {
    const ingredients = await API.get('/inventory');
    renderInventory(ingredients);
  } catch (err) {
    el.innerHTML = `<div class="empty-state"><p>${err.message}</p></div>`;
  }
}

function renderInventory(ingredients) {
  const el = document.getElementById('view-inventory');
  const critical = ingredients.filter(i => i.status === 'critical').length;
  const low      = ingredients.filter(i => i.status === 'low').length;

  el.innerHTML = `
    <div class="inv-header">
      <div class="flex gap-2" style="align-items:center">
        ${critical > 0 ? `<span class="badge badge-critical">🔴 ${critical} Critical</span>` : ''}
        ${low      > 0 ? `<span class="badge badge-low">🟡 ${low} Low</span>`      : ''}
        ${critical === 0 && low === 0 ? `<span class="badge badge-ok">✅ All Good</span>` : ''}
      </div>
      <button class="btn btn-primary" onclick="initInventory()">🔄 Refresh</button>
    </div>
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Ingredient</th>
              <th>Current Stock</th>
              <th>Min. Level</th>
              <th>Status</th>
              <th>Stock Level</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${ingredients.map(i => {
              const pct = Math.min(100, (i.current_stock / (i.min_stock * 3)) * 100);
              return `
              <tr id="inv-row-${i.id}">
                <td class="font-bold">${i.name}</td>
                <td>
                  <input class="editable-field" type="number" id="stock-${i.id}"
                    value="${i.current_stock}" min="0" style="width:90px" />
                  <span style="font-size:.8rem;color:var(--text-muted);margin-left:4px">${i.unit}</span>
                </td>
                <td>
                  <input class="editable-field" type="number" id="min-${i.id}"
                    value="${i.min_stock}" min="0" style="width:90px" />
                  <span style="font-size:.8rem;color:var(--text-muted);margin-left:4px">${i.unit}</span>
                </td>
                <td><span class="badge badge-${i.status}">${i.status.toUpperCase()}</span></td>
                <td>
                  <div class="stock-bar-wrap">
                    <div class="stock-bar ${i.status}" style="width:${pct}%"></div>
                  </div>
                </td>
                <td>
                  <div class="flex gap-2">
                    <button class="btn btn-sm btn-primary" onclick="invSave(${i.id})">Save</button>
                    <button class="btn btn-sm btn-secondary" onclick="invRestock(${i.id},'${i.name}','${i.unit}')">+ Restock</button>
                  </div>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

async function invSave(id) {
  const stock = parseFloat(document.getElementById('stock-' + id)?.value);
  const min   = parseFloat(document.getElementById('min-'   + id)?.value);
  if (isNaN(stock) || isNaN(min)) { toast('Invalid values', 'error'); return; }
  try {
    await API.put('/inventory/' + id, { current_stock: stock, min_stock: min });
    toast('Saved!', 'success');
    initInventory();
  } catch (err) { toast(err.message, 'error'); }
}

function invRestock(id, name, unit) {
  openModal(`Restock: ${name}`, `
    <div class="form-group">
      <label class="form-label">Amount to add (${unit})</label>
      <input class="form-control" type="number" id="restock-amount" min="1" placeholder="Enter quantity..." />
    </div>
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="modal-confirm-btn" onclick="doRestock(${id})">Add Stock</button>
    </div>`);
}

async function doRestock(id) {
  const amount = parseFloat(document.getElementById('restock-amount')?.value);
  if (!amount || amount <= 0) { toast('Enter a valid amount', 'error'); return; }
  try {
    await API.post('/inventory/' + id + '/restock', { amount });
    toast('Restocked successfully!', 'success');
    closeModal();
    initInventory();
  } catch (err) { toast(err.message, 'error'); }
}
