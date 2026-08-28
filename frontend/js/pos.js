// ── Categories that go directly to cart (no customization modal) ──────────────
const DIRECT_ADD_CATS = ['Classic Cans', 'Floating Chills', 'Fruit Soda'];

let posProducts = [], posCart = [], posPayment = 'Cash', posCategory = 'All', posTableNumber = '', posCustomerId = '';

async function initPOS() {
  const el = document.getElementById('view-pos');
  el.innerHTML = `<div class="flex-center" style="height:200px"><div class="spinner"></div></div>`;
  try {
    const [products, inventory] = await Promise.all([
      API.get('/products'),
      API.get('/inventory')
    ]);
    posProducts = products;

    // Map of ingredient_id -> current_stock
    const stockMap = {};
    inventory.forEach(item => {
      stockMap[item.id] = item.current_stock;
    });

    // Check if any ingredient is completely out of stock
    posProducts.forEach(prod => {
      let isOut = false;
      if (prod.ingredients && prod.ingredients.length > 0) {
        prod.ingredients.forEach(ing => {
          const currentStock = stockMap[ing.ingredient_id] ?? 0;
          if (currentStock <= 0) isOut = true;
        });
      }
      prod.isOutOfStock = isOut;
    });

    posCart = [];
    renderPOS();
  } catch (err) {
    el.innerHTML = `<div class="empty-state"><p>${err.message}</p></div>`;
  }
}

function renderPOS() {
  const el = document.getElementById('view-pos');
  const cats = ['All', ...new Set(posProducts.map(p => p.category))];
  const filtered = posCategory === 'All' ? posProducts : posProducts.filter(p => p.category === posCategory);

  el.innerHTML = `
    <div class="pos-layout">
      <div class="pos-menu">
        <div class="category-tabs" id="cat-tabs">
          ${cats.map(c => `<button class="cat-tab ${c===posCategory?'active':''}" onclick="posSetCat('${c}')">${c}</button>`).join('')}
        </div>
        <div class="product-grid" id="product-grid">
          ${filtered.map(p => {
            const isOut = p.isOutOfStock;
            const clickAttr = isOut ? '' : `onclick="posAddItem('${p.id}')"`;
            const styleAttr = isOut
              ? 'style="opacity: 0.45; cursor: not-allowed; filter: grayscale(100%); position: relative;"'
              : 'style="position: relative;"';
            const badge = isOut
              ? '<span style="position:absolute;top:6px;right:6px;background:var(--danger);color:#fff;font-size:0.6rem;padding:2px 6px;border-radius:10px;font-weight:700;">OUT OF STOCK</span>'
              : '';
            return `
            <div class="product-card" ${clickAttr} ${styleAttr} id="pcard-${p.id}">
              ${badge}
              <div class="product-emoji">${p.emoji}</div>
              <div class="product-name">${p.name}</div>
              <div class="product-price">${formatPHP(p.price)}</div>
            </div>`;
          }).join('')}
        </div>
      </div>
      <div class="pos-cart">
        <div class="cart-panel">
          <div class="cart-header">
            <span>🛒 Current Order</span>
            <button class="btn btn-sm btn-secondary" onclick="posClear()">Clear</button>
          </div>
          <div class="cart-items" id="cart-items"></div>
          <div class="cart-footer">
            <div class="discount-row">
              <input type="number" id="discount-input" placeholder="Discount (₱)" min="0" value="0" oninput="renderCartTotals()" />
            </div>
            <div class="cart-totals" id="cart-totals"></div>

            <!-- Table Number + Cash only -->
            <div class="pos-meta-row">
              <div class="pos-meta-group">
                <label class="pos-meta-label">🪑 Table #</label>
                <input type="text" id="table-number-input" class="pos-meta-input"
                  placeholder="e.g. 5" maxlength="4"
                  value="${posTableNumber}"
                  oninput="this.value=this.value.replace(/[^0-9]/g,''); posTableNumber=this.value"
                  style="width:70px;text-align:center;font-weight:700;font-size:1rem;" />
              </div>
              <div class="pos-meta-group" style="flex:1;margin-left:10px;">
                <label class="pos-meta-label">💳 Payment</label>
                <div style="display:flex;align-items:center;gap:6px;margin-top:4px;">
                  <span class="pay-btn active" style="cursor:default;padding:6px 14px;">💵 Cash</span>
                </div>
              </div>
            </div>

            <!-- Customer Loyalty ID -->
            <div class="pos-loyalty-row">
              <label class="pos-meta-label">🆔 Customer Loyalty ID <span style="font-weight:400;color:var(--text-light);font-size:0.75rem;">(optional — awards points)</span></label>
              <div style="display:flex;gap:6px;margin-top:4px;">
                <input type="text" id="customer-id-input" class="pos-meta-input"
                  placeholder="6-digit ID" maxlength="6" value="${posCustomerId}"
                  oninput="this.value=this.value.replace(/[^0-9]/g,''); posCustomerId=this.value"
                  style="flex:1;letter-spacing:0.15em;font-weight:700;" />
                <button class="btn btn-sm btn-secondary" onclick="posLookupCustomer()" type="button">Look Up</button>
              </div>
              <div id="pos-customer-preview" style="margin-top:5px;font-size:0.82rem;color:var(--success);min-height:18px;"></div>
            </div>

            <button class="btn btn-primary btn-lg" style="width:100%" id="checkout-btn" onclick="posCheckout()">
              Checkout
            </button>
          </div>
        </div>
      </div>
    </div>`;
  renderCartItems();
}

function posSetCat(cat) { posCategory = cat; renderPOS(); }
function posClear() { posCart = []; renderCartItems(); }

async function posLookupCustomer() {
  const id = document.getElementById('customer-id-input')?.value?.trim();
  const preview = document.getElementById('pos-customer-preview');
  if (!id || id.length < 6) { preview.textContent = 'Enter a 6-digit ID'; preview.style.color = 'var(--danger)'; return; }
  preview.textContent = 'Looking up…';
  preview.style.color = 'var(--text-light)';
  try {
    const data = await API.get(`/customer/lookup?unique_id=${encodeURIComponent(id)}`);
    posCustomerId = id;
    preview.style.color = 'var(--success)';
    preview.innerHTML = `✅ <strong>${data.name}</strong> — ${data.points} pts (${data.loyalty_level})`;
  } catch (err) {
    posCustomerId = '';
    preview.style.color = 'var(--danger)';
    preview.textContent = '❌ Customer not found';
  }
}

// ── Add item: direct-to-cart for cans/sodas/floats, modal for everything else ─
function posAddItem(id) {
  const product = posProducts.find(p => p.id === id);
  if (!product) return;

  // Pulse animation
  const card = document.getElementById('pcard-' + id);
  if (card) { card.style.transform = 'scale(.93)'; setTimeout(() => card.style.transform = '', 150); }

  if (DIRECT_ADD_CATS.includes(product.category) || product.name === 'Iced Tea') {
    posAddToCart(product, null);
  } else {
    posOpenCustomization(id);
  }
}

// ── Default customizations per category ──────────────────────────────────────
function posGetDefaultCust(p) {
  if (p.category === 'Coffee' || p.category === 'Non-Coffee') {
    return { temperature: 'Cold', sugar: '100%', milk: 'Whole' };
  }
  if (p.category === 'Blended') return { iceCream: false };
  if (p.category === 'Food')    return { drinkaddon: 'None' };
  return {};
}

// ── Build customization sections HTML based on category ───────────────────────
function posBuildCustSections(p, cust) {
  if (p.category === 'Coffee' || p.category === 'Non-Coffee') {
    const temp  = cust.temperature || 'Cold';
    const sugar = cust.sugar || '100%';
    const milk  = cust.milk  || 'Whole';
    return `
      <div class="custom-section">
        <label class="custom-label">🌡️ Temperature</label>
        <div class="custom-options">
          <label class="option-pill"><input type="radio" name="temperature" value="Cold" ${temp==='Cold'?'checked':''}><span>🧊 Cold</span></label>
          <label class="option-pill"><input type="radio" name="temperature" value="Hot"  ${temp==='Hot' ?'checked':''}><span>☕ Hot (+₱20)</span></label>
        </div>
      </div>
      <div class="custom-section">
        <label class="custom-label">🍬 Sugar Level</label>
        <div class="custom-options sugar-options">
          ${['0%','25%','50%','75%','100%'].map(s => `
            <label class="option-pill"><input type="radio" name="sugar" value="${s}" ${sugar===s?'checked':''}><span>${s}</span></label>`).join('')}
        </div>
      </div>
      <div class="custom-section">
        <label class="custom-label">🥛 Milk Type</label>
        <div class="custom-options">
          <label class="option-pill"><input type="radio" name="milk" value="Whole"  ${milk==='Whole' ?'checked':''}><span>Whole</span></label>
          <label class="option-pill"><input type="radio" name="milk" value="Oat"    ${milk==='Oat'   ?'checked':''}><span>Oat (+₱25)</span></label>
          <label class="option-pill"><input type="radio" name="milk" value="Almond" ${milk==='Almond'?'checked':''}><span>Almond (+₱30)</span></label>
        </div>
      </div>`;
  }

  if (p.category === 'Blended') {
    return `
      <div class="custom-section">
        <label class="custom-label">🍨 Extras</label>
        <div class="custom-options-grid">
          <label class="option-check">
            <input type="checkbox" name="icecream" value="yes" ${cust.iceCream ? 'checked' : ''}>
            <span>Add Ice Cream (+₱50)</span>
          </label>
        </div>
      </div>`;
  }

  if (p.category === 'Food') {
    const addon = cust.drinkaddon || 'None';
    return `
      <div class="custom-section">
        <label class="custom-label">🥤 Add a Drink</label>
        <div class="custom-options">
          <label class="option-pill"><input type="radio" name="drinkaddon" value="None"     ${addon==='None'    ?'checked':''}><span>None</span></label>
          <label class="option-pill"><input type="radio" name="drinkaddon" value="Iced Tea" ${addon==='Iced Tea'?'checked':''}><span>Iced Tea (+₱20)</span></label>
          <label class="option-pill"><input type="radio" name="drinkaddon" value="Soda"     ${addon==='Soda'    ?'checked':''}><span>Soda (+₱30)</span></label>
        </div>
      </div>`;
  }

  return '';
}

function posOpenCustomization(id, editIdx = null) {
  const p = posProducts.find(p => p.id === id);
  const existingItem = editIdx !== null ? posCart[editIdx] : null;
  const cust = existingItem ? existingItem.customizations : posGetDefaultCust(p);

  const html = `
    <div class="custom-modal-body">
      <div class="custom-product-info">
        <span class="custom-emoji">${p.emoji}</span>
        <div>
          <h3>${p.name}</h3>
          <p class="text-muted">${formatPHP(p.price)} base price</p>
        </div>
      </div>
      ${posBuildCustSections(p, cust)}
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="posConfirmCustomization('${id}', ${editIdx !== null ? editIdx : 'null'})">
          ${editIdx !== null ? 'Update Item' : 'Add to Order'}
        </button>
      </div>
    </div>
  `;
  openModal(editIdx !== null ? 'Edit Item' : 'Customize Item', html);
}

function posConfirmCustomization(id, editIdx = null) {
  const product = posProducts.find(p => p.id === id);
  let customizations = {};

  if (product.category === 'Coffee' || product.category === 'Non-Coffee') {
    customizations = {
      temperature: document.querySelector('input[name="temperature"]:checked')?.value || 'Cold',
      sugar:       document.querySelector('input[name="sugar"]:checked')?.value       || '100%',
      milk:        document.querySelector('input[name="milk"]:checked')?.value        || 'Whole',
    };
  } else if (product.category === 'Blended') {
    customizations = { iceCream: !!document.querySelector('input[name="icecream"]:checked') };
  } else if (product.category === 'Food') {
    customizations = {
      drinkaddon: document.querySelector('input[name="drinkaddon"]:checked')?.value || 'None'
    };
  }

  if (editIdx !== null) {
    const oldQty = posCart[editIdx].qty;
    posCart.splice(editIdx, 1);
    posAddToCart(product, customizations, oldQty);
  } else {
    posAddToCart(product, customizations);
  }
  closeModal();
}

function posAddToCart(product, customizations, qty = 1) {
  const cartKey = product.id + (customizations ? '-' + JSON.stringify(customizations) : '');

  const existing = posCart.find(i => i.cartKey === cartKey);
  if (existing) {
    existing.qty += qty;
  } else {
    let price = product.price;
    if (customizations) {
      // Drink temperature
      if (customizations.temperature === 'Hot')       price += 20;
      // Milk upgrades
      if (customizations.milk === 'Oat')              price += 25;
      if (customizations.milk === 'Almond')           price += 30;
      // Blended ice cream
      if (customizations.iceCream)                    price += 50;
      // Food drink add-on
      if (customizations.drinkaddon === 'Iced Tea')   price += 20;
      if (customizations.drinkaddon === 'Soda')       price += 30;
    }
    posCart.push({ ...product, customizations, cartKey, qty, finalPrice: price });
  }
  renderCartItems();
}

function posChangeQty(idx, delta) {
  if (!posCart[idx]) return;
  posCart[idx].qty += delta;
  if (posCart[idx].qty <= 0) posCart.splice(idx, 1);
  renderCartItems();
}

function posEditItem(idx) {
  const item = posCart[idx];
  if (!item) return;
  // Direct-add items and Iced Tea have no customization to edit
  if (DIRECT_ADD_CATS.includes(item.category) || item.name === 'Iced Tea') return;
  posOpenCustomization(item.id, idx);
}

// ── Cart display helpers ──────────────────────────────────────────────────────
function posFormatCartCust(c) {
  if (!c) return '';
  const parts = [];
  if (c.temperature) parts.push(c.temperature === 'Hot' ? '☕ Hot' : '🧊 Cold');
  if (c.sugar && c.sugar !== '100%') parts.push(`${c.sugar} Sugar`);
  if (c.milk  && c.milk  !== 'Whole') parts.push(`${c.milk} Milk`);
  if (c.iceCream) parts.push('🍨 + Ice Cream');
  if (c.drinkaddon && c.drinkaddon !== 'None') parts.push(`+ ${c.drinkaddon}`);
  return parts.length
    ? `<div class="cart-item-details">${parts.map(p => `<span>${p}</span>`).join('')}</div>`
    : '';
}

function posFormatReceiptCust(c) {
  if (!c) return '';
  const parts = [];
  if (c.temperature) parts.push(`Temp: ${c.temperature}`);
  if (c.sugar && c.sugar !== '100%') parts.push(`Sugar: ${c.sugar}`);
  if (c.milk  && c.milk  !== 'Whole') parts.push(`Milk: ${c.milk}`);
  if (c.iceCream) parts.push('+ Ice Cream');
  if (c.drinkaddon && c.drinkaddon !== 'None') parts.push(`+ ${c.drinkaddon}`);
  return parts.length
    ? `<div class="receipt-item-details">${parts.map(p => `<span>${p}</span>`).join('')}</div>`
    : '';
}

function renderCartItems() {
  const el = document.getElementById('cart-items');
  if (!el) return;
  if (posCart.length === 0) {
    el.innerHTML = `<div class="cart-empty"><div class="cart-empty-icon">🍽️</div><span>Tap items to add to order</span></div>`;
  } else {
    el.innerHTML = posCart.map((i, idx) => `
      <div class="cart-item">
        <div class="cart-item-emoji">${i.emoji}</div>
        <div class="cart-item-info" onclick="posEditItem(${idx})" style="cursor:pointer">
          <div class="cart-item-name">${i.name}</div>
          ${posFormatCartCust(i.customizations)}
          <div class="cart-item-price">${formatPHP(i.finalPrice || i.price)} each</div>
        </div>
        <div class="cart-qty">
          <button class="qty-btn" onclick="posChangeQty(${idx},-1)">−</button>
          <span class="qty-num">${i.qty}</span>
          <button class="qty-btn" onclick="posChangeQty(${idx},1)">+</button>
        </div>
        <div class="cart-item-total">${formatPHP((i.finalPrice || i.price) * i.qty)}</div>
      </div>`).join('');
  }
  renderCartTotals();
}

function renderCartTotals() {
  const el = document.getElementById('cart-totals');
  if (!el) return;
  const subtotal = posCart.reduce((s, i) => s + (i.finalPrice || i.price) * i.qty, 0);
  const discount = parseFloat(document.getElementById('discount-input')?.value || 0) || 0;
  const total    = Math.max(0, subtotal - discount);
  const pointsEarned = Math.floor(total / 10);
  const btn = document.getElementById('checkout-btn');
  if (btn) btn.disabled = posCart.length === 0;
  el.innerHTML = `
    <div class="cart-row"><span>Subtotal</span><span>${formatPHP(subtotal)}</span></div>
    ${discount > 0 ? `<div class="cart-row"><span>Discount</span><span style="color:var(--danger)">−${formatPHP(discount)}</span></div>` : ''}
    <div class="cart-row total"><span>Total</span><span>${formatPHP(total)}</span></div>
    ${pointsEarned > 0 ? `<div class="cart-row" style="color:var(--success);font-size:0.78rem"><span>🏆 Points to earn</span><span>+${pointsEarned} pts</span></div>` : ''}`;
}

async function posCheckout() {
  if (posCart.length === 0) return;
  const subtotal = posCart.reduce((s, i) => s + (i.finalPrice || i.price) * i.qty, 0);
  const discount = parseFloat(document.getElementById('discount-input')?.value || 0) || 0;
  const total    = Math.max(0, subtotal - discount);
  const tableNum = (document.getElementById('table-number-input')?.value || posTableNumber).trim();
  const custId   = (document.getElementById('customer-id-input')?.value  || posCustomerId).trim();

  try {
    const result = await API.post('/orders', {
      items: posCart.map(i => ({
        product_id:     i.id,
        quantity:       i.qty,
        customizations: i.customizations
      })),
      discount,
      payment_method: 'Cash',
      table_number: tableNum,
    });

    // Award loyalty points if customer ID provided
    let pointsMsg = '';
    if (custId && custId.length === 6) {
      try {
        const pts = await API.post('/customer/add-points', { unique_id: custId, order_total: total });
        pointsMsg = `<div class="receipt-points">🏆 +${pts.points_earned} pts awarded to <strong>${pts.customer_name}</strong> (${pts.new_total} total)</div>`;
      } catch (e) { /* silent — don't block the receipt */ }
    }

    // Snapshot cart for receipt
    const receiptItems = [...posCart];
    posCart        = [];
    posTableNumber = '';
    posCustomerId  = '';

    // Clean order number (KB-XXXXXX) or fall back to short ObjectId suffix
    const displayNumber = result.order_number || result.orderId;

    const receiptHTML = `
      <div class="receipt">
        <div class="receipt-header">
          <div class="receipt-brand">☕ KapeBara</div>
          <div class="receipt-sub" style="font-size:1.1rem;font-weight:800;letter-spacing:0.05em;">${displayNumber}</div>
          ${tableNum ? `<div class="receipt-sub" style="font-size:0.9rem;font-weight:700;">🪑 Table ${tableNum}</div>` : ''}
          <div class="receipt-sub">${new Date().toLocaleString('en-PH')}</div>
        </div>
        <div class="receipt-items">
          ${receiptItems.map(i => `
            <div class="receipt-item-group">
              <div class="receipt-item">
                <span>${i.name} x${i.qty}</span>
                <span>${formatPHP((i.finalPrice || i.price) * i.qty)}</span>
              </div>
              ${posFormatReceiptCust(i.customizations)}
            </div>`).join('')}
        </div>
        <hr class="receipt-divider"/>
        <div class="receipt-total-row"><span>Subtotal</span><span>${formatPHP(subtotal)}</span></div>
        ${discount > 0 ? `<div class="receipt-total-row"><span>Discount</span><span>−${formatPHP(discount)}</span></div>` : ''}
        <div class="receipt-total-row final"><span>TOTAL</span><span>${formatPHP(total)}</span></div>
        <div class="receipt-total-row"><span>Payment</span><span>💵 Cash</span></div>
        ${pointsMsg}
        <div class="receipt-footer">Thank you for visiting KapeBara!<br>Don't worry, be Capy ☕</div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-primary" onclick="closeModal(); posCart = []; posPayment = 'Cash'; renderPOS();">🛒 New Order</button>
      </div>`;

    openModal('Order Complete ✓', receiptHTML);
    toast(`${displayNumber} created!`, 'success');
  } catch (err) {
    toast(err.message, 'error');
  }
}
