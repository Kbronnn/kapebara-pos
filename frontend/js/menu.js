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
    <div class="menu-view-container">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
        <h2 style="font-family:'Playfair Display',serif;font-size:1.8rem;font-weight:700;color:var(--espresso);margin:0">Menu</h2>
        <div style="width:4px;height:34px;background:var(--tan-dark);border-radius:2px"></div>
      </div>
      <div class="section-header" style="display:flex;justify-content:space-between;align-items:center;width:100%;margin-bottom:24px">
        <span class="text-muted" style="font-size:0.9rem;font-weight:500">${products.length} items on menu</span>
        <button class="btn btn-primary" onclick="menuOpenAdd()">+ Add Item</button>
      </div>
      ${cats.map(cat => `
        <div style="margin-bottom:32px;width:100%">
          <h3 style="font-family:'Playfair Display',serif;color:var(--espresso);margin-bottom:14px;font-size:1.2rem;font-weight:700">${cat}</h3>
          <div class="menu-grid">
            ${products.filter(p=>p.category===cat).map(p=>`
              <div class="menu-item-card">
                <div class="menu-card-top">
                  <div class="menu-card-emoji">${p.emoji}</div>
                  <div class="menu-card-actions">
                    <button class="btn-icon-edit" title="Edit" onclick="menuOpenEdit('${p.id}')">✏️</button>
                    <button class="btn-icon-delete" title="Delete" onclick="menuDelete('${p.id}','${p.name.replace(/'/g,"\\'")}')">🗑</button>
                  </div>
                </div>
                <div class="menu-card-name">${p.name}</div>
                <div class="menu-card-cat">${p.category}</div>
                <div class="menu-card-price">${formatPHP(p.price)}</div>
                ${p.description ? `<div class="menu-card-desc">${p.description}</div>` : ''}
              </div>`).join('')}
          </div>
        </div>`).join('')}
    </div>`;
}

function menuForm(product = null) {
  const emojis = ['☕','🍵','🧋','🧊','🥐','🧁','🥪','🍞','🍩','🍰'];
  const hasImage = product?.image_url;
  return `
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Name *</label>
        <input class="form-control" id="mf-name" value="${product?.name||''}" placeholder="e.g. Iced Latte" />
      </div>
      <div class="form-group">
        <label class="form-label">Category *</label>
        <select class="form-control" id="mf-cat">
          ${['Coffee','Non-Coffee','Blended','Food','Fruit Soda','Classic Cans','Floating Chills'].map(c=>
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
      <label class="form-label">Product Image</label>
      <input type="hidden" id="mf-image-url" value="${product?.image_url||''}" />
      <div id="mf-image-dropzone"
           onclick="document.getElementById('mf-image-file').click()"
           style="border:2px dashed var(--tan-dark,#c8a97e);border-radius:10px;padding:18px 16px;cursor:pointer;display:flex;align-items:center;gap:14px;background:var(--tan-light,#fdf6ec);transition:border-color .2s"
           onmouseenter="this.style.borderColor='var(--espresso,#4a2c17)'"
           onmouseleave="this.style.borderColor='var(--tan-dark,#c8a97e)'">
        <img id="mf-image-preview"
             src="${hasImage ? product.image_url : ''}"
             style="width:56px;height:56px;object-fit:cover;border-radius:8px;display:${hasImage?'block':'none'};border:1px solid #ddd" />
        <span id="mf-image-icon" style="font-size:2rem;display:${hasImage?'none':'block'}">📷</span>
        <div>
          <div id="mf-image-label" style="font-weight:600;font-size:.9rem;color:var(--espresso,#4a2c17)">
            ${hasImage ? product.image_url.split('/').pop() : 'Click to upload image'}
          </div>
          <div style="font-size:.75rem;color:#888">JPG, PNG, WebP · max 5 MB · you can crop before saving</div>
        </div>
        <span id="mf-image-spinner" style="display:none;margin-left:auto">⏳</span>
      </div>
      <input type="file" id="mf-image-file" accept="image/*" style="display:none"
             onchange="menuHandleImageUpload(this)" />
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

async function menuHandleImageUpload(input) {
  const file = input.files[0];
  if (!file) return;
  // Show spinner
  document.getElementById('mf-image-spinner').style.display = 'inline';
  document.getElementById('mf-image-label').textContent = 'Uploading…';
  try {
    const formData = new FormData();
    formData.append('image', file);
    const res = await fetch('/api/products/upload-image', {
      method: 'POST', body: formData
    });
    if (!res.ok) throw new Error('Upload failed');
    const data = await res.json();
    // Store URL in hidden input
    document.getElementById('mf-image-url').value = data.image_url;
    // Update preview
    const preview = document.getElementById('mf-image-preview');
    preview.src = data.image_url;
    preview.style.display = 'block';
    document.getElementById('mf-image-icon').style.display = 'none';
    document.getElementById('mf-image-label').textContent = file.name;
  } catch (err) {
    toast('Image upload failed: ' + err.message, 'error');
    document.getElementById('mf-image-label').textContent = 'Click to upload image';
  } finally {
    document.getElementById('mf-image-spinner').style.display = 'none';
  }
}

async function menuSaveAdd() {
  const name     = document.getElementById('mf-name')?.value?.trim();
  const cat      = document.getElementById('mf-cat')?.value;
  const price    = parseFloat(document.getElementById('mf-price')?.value);
  const emoji    = document.getElementById('mf-emoji')?.value;
  const desc     = document.getElementById('mf-desc')?.value;
  const imageUrl = document.getElementById('mf-image-url')?.value || '';
  if (!name || !price) { toast('Name and price are required', 'error'); return; }
  try {
    await API.post('/products', { name, category: cat, price, description: desc, emoji, image_url: imageUrl });
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
        <button class="btn btn-primary" onclick="menuSaveEdit('${id}')">Save Changes</button>
      </div>`);
  } catch (err) { toast(err.message, 'error'); }
}

async function menuSaveEdit(id) {
  const name     = document.getElementById('mf-name')?.value?.trim();
  const cat      = document.getElementById('mf-cat')?.value;
  const price    = parseFloat(document.getElementById('mf-price')?.value);
  const emoji    = document.getElementById('mf-emoji')?.value;
  const desc     = document.getElementById('mf-desc')?.value;
  const imageUrl = document.getElementById('mf-image-url')?.value;
  if (!name || !price) { toast('Name and price are required', 'error'); return; }
  try {
    await API.put('/products/' + id, { name, category: cat, price, description: desc, emoji, active: 1, image_url: imageUrl });
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
      <button class="btn btn-danger" onclick="menuConfirmDelete('${id}')">Delete</button>
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
