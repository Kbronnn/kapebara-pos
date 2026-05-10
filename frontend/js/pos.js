let posProducts = [], posCart = [], posPayment = 'Cash', posCategory = 'All';

async function initPOS() {
  const el = document.getElementById('view-pos');
  el.innerHTML = `<div class="flex-center" style="height:200px"><div class="spinner"></div></div>`;
  try {
    posProducts = await API.get('/products');
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
          ${filtered.map(p => `
            <div class="product-card" onclick="posAddItem(${p.id})" id="pcard-${p.id}">
              <div class="product-emoji">${p.emoji}</div>
              <div class="product-name">${p.name}</div>
              <div class="product-price">${formatPHP(p.price)}</div>
            </div>`).join('')}
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
            <div class="payment-methods" id="payment-methods">
              ${['Cash','GCash','Card'].map(m=>`
                <button class="pay-btn ${m===posPayment?'active':''}" onclick="posSetPayment('${m}')">${m}</button>`).join('')}
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
function posSetPayment(m) { posPayment = m; renderPOS(); }
function posClear() { posCart = []; renderCartItems(); }

function posAddItem(id) {
  const product = posProducts.find(p => p.id === id);
  if (!product) return;

  // Pulse animation
  const card = document.getElementById('pcard-' + id);
  if (card) { card.style.transform = 'scale(.93)'; setTimeout(() => card.style.transform = '', 150); }

  // Food items don't usually need customizations like sugar/milk
  if (product.category === 'Food') {
    posAddToCart(product, null);
  } else {
    posOpenCustomization(id);
  }
}

function posOpenCustomization(id, editIdx = null) {
  const p = posProducts.find(p => p.id === id);
  const existingItem = editIdx !== null ? posCart[editIdx] : null;
  const cust = existingItem ? existingItem.customizations : { sugar: '100%', milk: 'Whole', addons: [] };

  const html = `
    <div class="custom-modal-body">
      <div class="custom-product-info">
        <span class="custom-emoji">${p.emoji}</span>
        <div>
          <h3>${p.name}</h3>
          <p class="text-muted">${formatPHP(p.price)} base price</p>
        </div>
      </div>

      <div class="custom-section">
        <label class="custom-label">Sugar Level</label>
        <div class="custom-options sugar-options">
          ${['0%', '25%', '50%', '75%', '100%'].map(s => `
            <label class="option-pill">
              <input type="radio" name="sugar" value="${s}" ${s===cust.sugar?'checked':''}>
              <span>${s}</span>
            </label>`).join('')}
        </div>
      </div>

      <div class="custom-section">
        <label class="custom-label">Milk Type</label>
        <div class="custom-options">
          <label class="option-pill"><input type="radio" name="milk" value="Whole" ${cust.milk==='Whole'?'checked':''}><span>Whole</span></label>
          <label class="option-pill"><input type="radio" name="milk" value="Oat" ${cust.milk==='Oat'?'checked':''}><span>Oat (+₱25)</span></label>
          <label class="option-pill"><input type="radio" name="milk" value="Almond" ${cust.milk==='Almond'?'checked':''}><span>Almond (+₱30)</span></label>
        </div>
      </div>

      <div class="custom-section">
        <label class="custom-label">Add-ons</label>
        <div class="custom-options-grid">
          <label class="option-check"><input type="checkbox" name="addons" value="Extra Shot" ${cust.addons.includes('Extra Shot')?'checked':''}><span>Extra Shot (+₱25)</span></label>
          <label class="option-check"><input type="checkbox" name="addons" value="Caramel Drizzle" ${cust.addons.includes('Caramel Drizzle')?'checked':''}><span>Caramel Drizzle (+₱15)</span></label>
          <label class="option-check"><input type="checkbox" name="addons" value="Whipped Cream" ${cust.addons.includes('Whipped Cream')?'checked':''}><span>Whipped Cream (+₱20)</span></label>
        </div>
      </div>

      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="posConfirmCustomization(${id}, ${editIdx !== null ? editIdx : 'null'})">
          ${editIdx !== null ? 'Update Item' : 'Add to Order'}
        </button>
      </div>
    </div>
  `;
  openModal(editIdx !== null ? 'Edit Item' : 'Customize Item', html);
}

function posConfirmCustomization(id, editIdx = null) {
  const product = posProducts.find(p => p.id === id);
  const sugar = document.querySelector('input[name="sugar"]:checked').value;
  const milk = document.querySelector('input[name="milk"]:checked').value;
  const addons = Array.from(document.querySelectorAll('input[name="addons"]:checked')).map(i => i.value);
  
  const customizations = { sugar, milk, addons };
  
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
  // Create a unique key for the cart item based on product ID and customizations
  const cartKey = product.id + (customizations ? '-' + JSON.stringify(customizations) : '');
  
  const existing = posCart.find(i => i.cartKey === cartKey);
  if (existing) {
    existing.qty += qty;
  } else {
    // Calculate actual unit price for this specific customization
    let price = product.price;
    if (customizations) {
      if (customizations.milk === 'Oat') price += 25;
      if (customizations.milk === 'Almond') price += 30;
      if (customizations.addons.includes('Extra Shot')) price += 25;
      if (customizations.addons.includes('Caramel Drizzle')) price += 15;
      if (customizations.addons.includes('Whipped Cream')) price += 20;
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
  if (item.category === 'Food') return;
  posOpenCustomization(item.id, idx);
}

function renderCartItems() {
  const el = document.getElementById('cart-items');
  if (!el) return;
  if (posCart.length === 0) {
    el.innerHTML = `<div class="cart-empty"><div class="cart-empty-icon">🛍️</div><span>Tap items to add to order</span></div>`;
  } else {
    el.innerHTML = posCart.map((i, idx) => `
      <div class="cart-item">
        <div class="cart-item-emoji">${i.emoji}</div>
        <div class="cart-item-info" onclick="posEditItem(${idx})" style="cursor:pointer">
          <div class="cart-item-name">${i.name}</div>
          ${i.customizations ? `
            <div class="cart-item-details">
              ${i.customizations.sugar !== '100%' ? `<span>${i.customizations.sugar} Sugar</span>` : ''}
              ${i.customizations.milk !== 'Whole' ? `<span>${i.customizations.milk} Milk</span>` : ''}
              ${i.customizations.addons.length ? `<span>+ ${i.customizations.addons.join(', ')}</span>` : ''}
            </div>
          ` : ''}
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
  const btn      = document.getElementById('checkout-btn');
  if (btn) btn.disabled = posCart.length === 0;
  el.innerHTML = `
    <div class="cart-row"><span>Subtotal</span><span>${formatPHP(subtotal)}</span></div>
    ${discount > 0 ? `<div class="cart-row"><span>Discount</span><span style="color:var(--danger)">−${formatPHP(discount)}</span></div>` : ''}
    <div class="cart-row total"><span>Total</span><span>${formatPHP(total)}</span></div>`;
}

async function posCheckout() {
  if (posCart.length === 0) return;
  const subtotal = posCart.reduce((s, i) => s + (i.finalPrice || i.price) * i.qty, 0);
  const discount = parseFloat(document.getElementById('discount-input')?.value || 0) || 0;
  const total    = Math.max(0, subtotal - discount);

  try {
    const result = await API.post('/orders', {
      items: posCart.map(i => ({ 
        product_id: i.id, 
        quantity: i.qty,
        customizations: i.customizations 
      })),
      discount,
      payment_method: posPayment
    });

    // Show receipt
    const receiptHTML = `
      <div class="receipt">
        <div class="receipt-header">
          <div class="receipt-brand">☕ KapeBara</div>
          <div class="receipt-sub">Order #${result.orderId}</div>
          <div class="receipt-sub">${new Date().toLocaleString('en-PH')}</div>
        </div>
        <div class="receipt-items">
          ${posCart.map(i=>`
            <div class="receipt-item-group">
              <div class="receipt-item">
                <span>${i.name} x${i.qty}</span>
                <span>${formatPHP((i.finalPrice || i.price)*i.qty)}</span>
              </div>
              ${i.customizations ? `
                <div class="receipt-item-details">
                  ${i.customizations.sugar !== '100%' ? `<span>Sugar: ${i.customizations.sugar}</span>` : ''}
                  ${i.customizations.milk !== 'Whole' ? `<span>Milk: ${i.customizations.milk}</span>` : ''}
                  ${i.customizations.addons.length ? `<span>Addons: ${i.customizations.addons.join(', ')}</span>` : ''}
                </div>
              ` : ''}
            </div>`).join('')}
        </div>
        <hr class="receipt-divider"/>
        <div class="receipt-total-row"><span>Subtotal</span><span>${formatPHP(subtotal)}</span></div>
        ${discount>0?`<div class="receipt-total-row"><span>Discount</span><span>−${formatPHP(discount)}</span></div>`:''}
        <div class="receipt-total-row final"><span>TOTAL</span><span>${formatPHP(total)}</span></div>
        <div class="receipt-total-row"><span>Payment</span><span>${posPayment}</span></div>
        <div class="receipt-footer">Thank you for visiting KapeBara!<br>Come back soon ☕</div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-primary" onclick="closeModal();initPOS()">New Order</button>
      </div>`;

    openModal('Order Complete ✓', receiptHTML);
    toast('Order #' + result.orderId + ' created!', 'success');
    posCart = [];
  } catch (err) {
    toast(err.message, 'error');
  }
}
