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

function invRelativeTime(iso) {
  if (!iso) return '<span style="color:var(--text-muted);font-style:italic">Never</span>';
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return 'Just now';
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7)   return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

function renderInventory(ingredients) {
  const el = document.getElementById('view-inventory');
  const outOfStock = ingredients.filter(i => i.status === 'out_of_stock').length;
  const critical = ingredients.filter(i => i.status === 'critical').length;
  const low      = ingredients.filter(i => i.status === 'low').length;

  el.innerHTML = `
    <div class="inv-header">
      <div class="flex gap-2" style="align-items:center">
        ${outOfStock > 0 ? `<span class="badge badge-out_of_stock">⚫ ${outOfStock} Out of Stock</span>` : ''}
        ${critical > 0 ? `<span class="badge badge-critical">🔴 ${critical} Critical</span>` : ''}
        ${low      > 0 ? `<span class="badge badge-low">🟡 ${low} Low</span>`      : ''}
        ${outOfStock === 0 && critical === 0 && low === 0 ? `<span class="badge badge-ok">✅ All Good</span>` : ''}
      </div>
      <div class="flex gap-2">
        <button class="btn btn-primary" onclick="openAddIngredientModal()">➕ Add Ingredient</button>
        <button class="btn btn-secondary" onclick="initInventory()">🔄 Refresh</button>
      </div>
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
              <th>Last Restocked</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${ingredients.map(i => {
              const pct = i.min_stock > 0 ? Math.min(100, (i.current_stock / (i.min_stock * 3)) * 100) : (i.current_stock > 0 ? 100 : 0);
              const restockedAt = invRelativeTime(i.last_restocked_at);
              const restockedBy = i.last_restocked_by
                ? `<div style="font-size:.72rem;color:var(--text-muted);margin-top:2px">by ${i.last_restocked_by}</div>`
                : '';
              const badgeLabel = i.status === 'out_of_stock' ? 'OUT OF STOCK' : i.status.toUpperCase();
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
                <td><span class="badge badge-${i.status}">${badgeLabel}</span></td>
                <td>
                  <div class="stock-bar-wrap">
                    <div class="stock-bar ${i.status}" style="width:${pct}%"></div>
                  </div>
                </td>
                <td>
                  <div style="font-size:.83rem;font-weight:500;color:var(--espresso)">${restockedAt}</div>
                  ${restockedBy}
                </td>
                <td>
                  <div class="flex gap-2">
                    <button class="btn btn-sm btn-primary" onclick="invSave('${i.id}')">Save</button>
                    <button class="btn btn-sm btn-secondary" onclick="invRestock('${i.id}','${i.name}','${i.unit}')">+ Restock</button>
                    <button class="btn btn-sm btn-secondary" style="border-color:var(--danger);color:var(--danger)" onclick="invDelete('${i.id}')">🗑 Delete</button>
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
      <button class="btn btn-primary" id="modal-confirm-btn" onclick="doRestock('${id}')">Add Stock</button>
    </div>`);
}

async function doRestock(id) {
  const amount      = parseFloat(document.getElementById('restock-amount')?.value);
  const username    = sessionStorage.getItem('adminUsername') || 'unknown';
  if (!amount || amount <= 0) { toast('Enter a valid amount', 'error'); return; }
  try {
    await API.post('/inventory/' + id + '/restock', { amount, restocked_by: username });
    toast('Restocked successfully!', 'success');
    closeModal();
    initInventory();
  } catch (err) { toast(err.message, 'error'); }
}

function openAddIngredientModal() {
  openModal('➕ Add Ingredient', `
    <div class="form-group">
      <label class="form-label">Ingredient Name</label>
      <input class="form-control" type="text" id="add-ing-name" placeholder="e.g. Fresh Milk" required />
    </div>
    <div class="form-group">
      <label class="form-label">Unit of Measure</label>
      <input class="form-control" type="text" id="add-ing-unit" placeholder="e.g. ml, g, pcs" required />
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Initial Stock</label>
        <input class="form-control" type="number" id="add-ing-stock" min="0" value="0" />
      </div>
      <div class="form-group">
        <label class="form-label">Minimum Level</label>
        <input class="form-control" type="number" id="add-ing-min" min="0" value="0" />
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="submitAddIngredient()">Add Item</button>
    </div>
  `);
}

async function submitAddIngredient() {
  const name = document.getElementById('add-ing-name').value.trim();
  const unit = document.getElementById('add-ing-unit').value.trim();
  const stock = parseFloat(document.getElementById('add-ing-stock').value) || 0;
  const min = parseFloat(document.getElementById('add-ing-min').value) || 0;

  if (!name || !unit) { toast('Name and unit are required', 'error'); return; }

  try {
    await API.post('/inventory', { name, unit, current_stock: stock, min_stock: min });
    toast('Ingredient added!', 'success');
    closeModal();
    initInventory();
  } catch (err) { toast(err.message, 'error'); }
}

async function invDelete(id) {
  if (!confirm('Are you sure you want to delete this ingredient? This action cannot be undone.')) return;
  try {
    await API.delete('/inventory/' + id);
    toast('Ingredient deleted!', 'success');
    initInventory();
  } catch (err) { toast(err.message, 'error'); }
}
