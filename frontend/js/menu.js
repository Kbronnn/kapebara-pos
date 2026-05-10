let menuIngredients = [];

async function initMenu() {
  const el = document.getElementById('view-menu');
  el.innerHTML = `<div class="flex-center" style="height:200px"><div class="spinner"></div></div>`;
  try {
    const [products, ings] = await Promise.all([API.get('/products'), API.get('/inventory')]);
    menuIngredients = ings;
    renderMenu(products);
  } catch (err) {
    el.innerHTML = `<div class="empty-state"><p>${err.message}</p></div>`;
  }
}

function renderMenu(products) {
  const el = document.getElementById('view-menu');
  const cats = [...new Set(products.map(p => p.category))];

  el.innerHTML = `
    <div class="section-header">
      <span class="text-muted">${products.length} items on menu</span>
      <button class="btn btn-primary" onclick="menuOpenAdd()">+ Add Item</button>
    </div>
    ${cats.map(cat => `
      <div style="margin-bottom:24px">
        <h3 style="font-family:'Playfair Display',serif;color:var(--espresso);margin-bottom:12px;font-size:1.1rem">${cat}</h3>
        <div class="menu-grid">
          ${products.filter(p=>p.category===cat).map(p=>`
            <div class="menu-item-card">
              <div class="menu-card-top">
                <div class="menu-card-emoji">${p.emoji}</div>
                <div class="menu-card-actions">
                  <button class="btn btn-sm btn-secondary" title="Edit" onclick="menuOpenEdit(${p.id})">✏️</button>
                  <button class="btn btn-sm btn-danger" title="Delete" onclick="menuDelete(${p.id},'${p.name.replace(/'/g,"\\'")}')">🗑</button>
                </div>
              </div>
              <div class="menu-card-name">${p.name}</div>
              <div class="menu-card-cat">${p.category}</div>
              <div class="menu-card-price">${formatPHP(p.price)}</div>
              ${p.description ? `<div class="text-muted mt-1" style="font-size:.75rem">${p.description}</div>` : ''}
            </div>`).join('')}
        </div>
      </div>`).join('')}`;
}

function menuForm(product = null) {
  const emojis = ['☕','🍵','🧋','🧊','🥐','🧁','🥪','🍞','🍩','🍰'];
  return `
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Name *</label>
        <input class="form-control" id="mf-name" value="${product?.name||''}" placeholder="e.g. Iced Latte" />
      </div>
      <div class="form-group">
        <label class="form-label">Category *</label>
        <select class="form-control" id="mf-cat">
          ${['Espresso','Specialty','Frappé','Cold Drinks','Food'].map(c=>
            `<option ${product?.category===c?'selected':''}>${c}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Price (₱) *</label>
        <input class="form-control" id="mf-price" type="number" value="${product?.price||''}" placeholder="0.00" />
      </div>
      <div class="form-group">
        <label class="form-label">Emoji</label>
        <select class="form-control" id="mf-emoji">
          ${emojis.map(e=>`<option ${product?.emoji===e?'selected':''}>${e}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Description</label>
      <input class="form-control" id="mf-desc" value="${product?.description||''}" placeholder="Short description..." />
    </div>`;
}

function menuOpenAdd() {
  openModal('Add Menu Item', menuForm() + `
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="menuSaveAdd()">Add Item</button>
    </div>`);
}

async function menuSaveAdd() {
  const name  = document.getElementById('mf-name')?.value?.trim();
  const cat   = document.getElementById('mf-cat')?.value;
  const price = parseFloat(document.getElementById('mf-price')?.value);
  const emoji = document.getElementById('mf-emoji')?.value;
  const desc  = document.getElementById('mf-desc')?.value;
  if (!name || !price) { toast('Name and price are required', 'error'); return; }
  try {
    await API.post('/products', { name, category: cat, price, description: desc, emoji });
    toast('Item added!', 'success');
    closeModal();
    initMenu();
  } catch (err) { toast(err.message, 'error'); }
}

async function menuOpenEdit(id) {
  try {
    const p = await API.get('/products/' + id);
    openModal('Edit: ' + p.name, menuForm(p) + `
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="menuSaveEdit(${id})">Save Changes</button>
      </div>`);
  } catch (err) { toast(err.message, 'error'); }
}

async function menuSaveEdit(id) {
  const name  = document.getElementById('mf-name')?.value?.trim();
  const cat   = document.getElementById('mf-cat')?.value;
  const price = parseFloat(document.getElementById('mf-price')?.value);
  const emoji = document.getElementById('mf-emoji')?.value;
  const desc  = document.getElementById('mf-desc')?.value;
  if (!name || !price) { toast('Name and price are required', 'error'); return; }
  try {
    await API.put('/products/' + id, { name, category: cat, price, description: desc, emoji, active: 1 });
    toast('Item updated!', 'success');
    closeModal();
    initMenu();
  } catch (err) { toast(err.message, 'error'); }
}

function menuDelete(id, name) {
  openModal('Delete Item', `
    <p>Are you sure you want to remove <strong>${name}</strong> from the menu?</p>
    <div class="modal-actions" style="margin-top:16px">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-danger" onclick="menuConfirmDelete(${id})">Delete</button>
    </div>`);
}

async function menuConfirmDelete(id) {
  try {
    await API.del('/products/' + id);
    toast('Item removed from menu', 'success');
    closeModal();
    initMenu();
  } catch (err) { toast(err.message, 'error'); }
}
