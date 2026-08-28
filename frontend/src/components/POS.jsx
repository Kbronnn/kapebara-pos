import React, { useState, useEffect, useCallback } from 'react';
import { API, toast, formatPHP, formatNum } from '../api';
import { ProductThumb } from './Menu';

export default function POS() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('All');
  const [cart, setCart] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [tableNumber, setTableNumber] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [customerPreview, setCustomerPreview] = useState({ text: '', type: '', data: null });
  const [lookingUp, setLookingUp] = useState(false);

  // Customization modal states
  const [custModalOpen, setCustModalOpen] = useState(false);
  const [customizingProduct, setCustomizingProduct] = useState(null);
  const [customizingIndex, setCustomizingIndex] = useState(null);
  const [temperature, setTemperature] = useState('Cold');
  const [sugar, setSugar] = useState('100%');
  const [milk, setMilk] = useState('Whole');
  const [iceCream, setIceCream] = useState(false);
  const [drinkaddon, setDrinkaddon] = useState('None');

  // Receipt modal states
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [receiptData, setReceiptData] = useState(null);

  // Portal orders panel
  const [portalOrders, setPortalOrders] = useState([]);
  const [showPortalPanel, setShowPortalPanel] = useState(false);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [activePortalOrderId, setActivePortalOrderId] = useState(null);

  const loadPortalOrders = useCallback(async () => {
    try {
      setLoadingPortal(true);
      const data = await API.get('/orders/portal-pending');
      setPortalOrders(data);
    } catch {}
    finally { setLoadingPortal(false); }
  }, []);

  useEffect(() => {
    loadPOSData();
    loadPortalOrders();
    // Poll every 10s for new portal orders
    const interval = setInterval(loadPortalOrders, 10000);
    return () => clearInterval(interval);
  }, [loadPortalOrders]);

  const loadPOSData = async () => {
    setLoading(true);
    try {
      const [productsData, inventoryData] = await Promise.all([
        API.get('/products'),
        API.get('/inventory')
      ]);

      const stockMap = {};
      inventoryData.forEach(item => {
        stockMap[item.id] = item.current_stock;
      });

      productsData.forEach(prod => {
        let isOut = false;
        if (prod.ingredients && prod.ingredients.length > 0) {
          prod.ingredients.forEach(ing => {
            const currentStock = stockMap[ing.ingredient_id] ?? 0;
            if (currentStock <= 0) {
              isOut = true;
            }
          });
        }
        prod.isOutOfStock = isOut;
      });

      setProducts(productsData);
      setLoading(false);
    } catch (err) {
      toast('Failed to load POS data: ' + err.message, 'error');
      setLoading(false);
    }
  };

  const handleLookupCustomer = async () => {
    const id = customerId.trim();
    if (!id || id.length < 6) {
      setCustomerPreview({ text: 'Enter a 6-digit ID', type: 'danger', data: null });
      return;
    }
    setLookingUp(true);
    setCustomerPreview({ text: 'Looking up…', type: 'info', data: null });
    try {
      const data = await API.get(`/customer/lookup?unique_id=${encodeURIComponent(id)}`);
      setCustomerPreview({
        text: `✅ ${data.name} — ${data.points} pts (${data.loyalty_level})`,
        type: 'success',
        data
      });
    } catch (err) {
      setCustomerPreview({ text: '❌ Customer not found', type: 'danger', data: null });
    } finally {
      setLookingUp(false);
    }
  };

  const DIRECT_ADD_CATS = ['Classic Cans', 'Fruit Soda'];

  const handleAddItemClick = (product) => {
    if (product.isOutOfStock) return;
    if (DIRECT_ADD_CATS.includes(product.category) || product.name === 'Iced Tea') {
      addToCart(product, null);
    } else {
      openCustomization(product);
    }
  };

  const openCustomization = (product, editIndex = null) => {
    setCustomizingProduct(product);
    setCustomizingIndex(editIndex);
    if (editIndex !== null) {
      const item = cart[editIndex];
      setTemperature(item.customizations?.temperature || 'Cold');
      setSugar(item.customizations?.sugar || '100%');
      setMilk(item.customizations?.milk || 'Whole');
      setIceCream(item.customizations?.iceCream || false);
      setDrinkaddon(item.customizations?.drinkaddon || 'None');
    } else {
      setTemperature('Cold');
      setSugar('100%');
      setMilk('Whole');
      setIceCream(false);
      setDrinkaddon('None');
    }
    setCustModalOpen(true);
  };

  const handleConfirmCustomization = () => {
    let customizations = {};
    const cat = customizingProduct?.category;
    if (cat === 'Coffee' || cat === 'Non-Coffee') {
      customizations = { temperature, sugar, milk };
    } else if (cat === 'Floating Chills') {
      customizations = { temperature };
    } else if (cat === 'Blended') {
      customizations = { iceCream };
    } else if (cat === 'Food') {
      customizations = { drinkaddon };
    }
    if (customizingIndex !== null) {
      const oldQty = cart[customizingIndex].qty;
      const newCart = [...cart];
      newCart.splice(customizingIndex, 1);
      setCart(newCart);
      addToCart(customizingProduct, customizations, oldQty, newCart);
    } else {
      addToCart(customizingProduct, customizations);
    }
    setCustModalOpen(false);
  };

  const addToCart = (product, customizations, qty = 1, currentCartList = cart) => {
    const cartKey = product.id + (customizations ? '-' + JSON.stringify(customizations) : '');
    const existingIndex = currentCartList.findIndex(item => item.cartKey === cartKey);
    const updatedCart = [...currentCartList];

    if (existingIndex !== -1) {
      updatedCart[existingIndex].qty += qty;
    } else {
      let price = product.price;
      if (customizations) {
        if (customizations.temperature === 'Hot')        price += 20;
        if (customizations.milk === 'Oat')               price += 25;
        if (customizations.milk === 'Almond')            price += 30;
        if (customizations.iceCream)                     price += 50;
        if (customizations.drinkaddon === 'Iced Tea')    price += 20;
        if (customizations.drinkaddon === 'Soda')        price += 30;
      }
      updatedCart.push({ ...product, customizations, cartKey, qty, finalPrice: price });
    }
    setCart(updatedCart);
  };

  const handleQtyChange = (index, delta) => {
    const updatedCart = [...cart];
    updatedCart[index].qty += delta;
    if (updatedCart[index].qty <= 0) {
      updatedCart.splice(index, 1);
    }
    setCart(updatedCart);
  };

  const DIRECT_ADD_CATS_EDIT = ['Classic Cans', 'Fruit Soda'];
  const handleCartItemClick = (index) => {
    const item = cart[index];
    if (DIRECT_ADD_CATS_EDIT.includes(item.category) || item.name === 'Iced Tea') return;
    openCustomization(item, index);
  };

  const handleClearCart = () => {
    setCart([]);
    setActivePortalOrderId(null);
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    const subtotal = cart.reduce((s, i) => s + (i.finalPrice || i.price) * i.qty, 0);
    const finalTotal = Math.max(0, subtotal - discount);

    try {
      const result = await API.post('/orders', {
        items: cart.map(i => ({
          product_id: i.id,
          quantity: i.qty,
          customizations: i.customizations
        })),
        discount,
        payment_method: 'Cash',
        table_number: tableNumber,
      });

      // Mark portal order as completed if checking out a loaded portal order
      if (activePortalOrderId) {
        try {
          await API.patch(`/orders/${activePortalOrderId}/status`, { status: 'completed' });
        } catch (e) {}
        setActivePortalOrderId(null);
        loadPortalOrders();
      }

      let ptsMsg = null;
      const custIdVal = customerId.trim();
      if (custIdVal && custIdVal.length === 6) {
        try {
          const pts = await API.post('/customer/add-points', { unique_id: custIdVal, order_total: finalTotal });
          ptsMsg = {
            pointsEarned: pts.points_earned,
            customerName: pts.customer_name,
            newTotal: pts.new_total
          };
        } catch (e) {
          // silent error
        }
      }

      const displayNumber = result.order_number || result.orderId;
      setReceiptData({
        orderId: result.orderId,
        order_number: displayNumber,
        items: [...cart],
        subtotal,
        discount,
        total: finalTotal,
        tableNum: tableNumber,
        pointsInfo: ptsMsg
      });

      setReceiptModalOpen(true);
      toast(`${displayNumber} created!`, 'success');

      // Clear states
      setCart([]);
      setTableNumber('');
      setCustomerId('');
      setDiscount(0);
      setCustomerPreview({ text: '', type: '', data: null });
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const handleLoadPortalOrder = async (order) => {
    try {
      await API.patch(`/orders/${order.id}/status`, { status: 'processing' });
    } catch {}

    const newItems = order.items.map(item => ({
      id: item.product_id,
      name: item.product_name,
      price: item.unit_price,
      finalPrice: item.unit_price,
      emoji: '☕',
      category: 'Beverage',
      qty: item.quantity,
      customizations: item.customizations || null,
      cartKey: item.product_id + '-portal-' + Date.now() + Math.random()
    }));
    setCart(newItems);
    setTableNumber('Portal Order');
    setActivePortalOrderId(order.id);

    // Pre-fill customer ID with 6-digit unique_id for automatic points
    if (order.customer_unique_id) {
      setCustomerId(order.customer_unique_id);
      try {
        const data = await API.get(`/customer/lookup?unique_id=${encodeURIComponent(order.customer_unique_id)}`);
        setCustomerPreview({
          text: `✅ ${data.name} — ${data.points} pts (${data.loyalty_level})`,
          type: 'success',
          data
        });
      } catch (e) {}
    } else {
      setCustomerId('');
      setCustomerPreview({ text: '', type: '', data: null });
    }

    setShowPortalPanel(false);
    await loadPortalOrders();
    toast(`Loaded order from ${order.customer_name || 'Customer'} — ready for checkout!`, 'success');
  };

  if (loading) {
    return <div className="flex-center" style={{ height: '400px' }}><div className="spinner"></div></div>;
  }

  const categoriesList = ['All', ...new Set(products.map(p => p.category))];
  const filteredProducts = category === 'All' ? products : products.filter(p => p.category === category);

  const subtotal = cart.reduce((s, i) => s + (i.finalPrice || i.price) * i.qty, 0);
  const total = Math.max(0, subtotal - discount);
  const pointsToEarn = Math.floor(total / 10);

  return (
    <div className="pos-layout" style={{ position: 'relative' }}>
      {/* Portal Orders Slide Panel */}
      {showPortalPanel && (
        <div style={{ position: 'fixed', top: 0, right: 0, width: '380px', height: '100vh', background: '#fff', boxShadow: '-4px 0 24px rgba(0,0,0,0.18)', zIndex: 1000, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '20px 20px 14px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontFamily: "'Playfair Display', serif", color: '#3d2510' }}>📥 Portal Orders</h2>
              <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: '#999' }}>Orders placed by customers via their portal</p>
            </div>
            <button onClick={() => setShowPortalPanel(false)} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#999' }}>✕</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
            {loadingPortal ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#bbb' }}>Loading…</div>
            ) : portalOrders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#bbb' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>✅</div>
                <p style={{ fontSize: '0.9rem' }}>No pending portal orders!</p>
              </div>
            ) : portalOrders.map(order => {
              const isProc = order.status === 'processing';
              return (
                <div key={order.id} style={{ background: '#faf7f2', border: `1.5px solid ${isProc ? '#b8daff' : '#e8d5b7'}`, borderRadius: '12px', padding: '16px', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '1rem', color: '#3d2510' }}>{order.customer_name || 'Customer'}</div>
                      {order.customer_unique_id ? (
                        <div style={{ fontSize: '0.78rem', color: 'var(--accent)', fontWeight: 600, marginTop: '2px' }}>
                          🆔 ID: {order.customer_unique_id}
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.75rem', color: '#aaa', marginTop: '2px' }}>
                          Guest Customer
                        </div>
                      )}
                      <div style={{ fontSize: '0.74rem', color: '#999', marginTop: '2px' }}>
                        {new Date(order.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </div>
                    </div>
                    <span style={{
                      background: isProc ? '#d1ecf1' : '#fff3cd',
                      color: isProc ? '#0c5460' : '#856404',
                      fontSize: '0.7rem', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', height: 'fit-content'
                    }}>
                      {isProc ? '⚙️ Processing' : '⏳ Pending'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#555', marginBottom: '12px', lineHeight: 1.5 }}>
                    {order.items?.map(i => `${i.product_name} ×${i.quantity}`).join(', ')}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: '1.05rem', color: '#8b5e3c' }}>₱{parseFloat(order.total).toFixed(2)}</span>
                    <button onClick={() => handleLoadPortalOrder(order)} style={{ background: '#4a2c0a', color: '#f1d6ab', border: 'none', borderRadius: '8px', padding: '8px 16px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>
                      Load to Cart →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ padding: '14px 16px', borderTop: '1px solid #eee' }}>
            <button onClick={loadPortalOrders} style={{ width: '100%', padding: '10px', background: '#f5ede3', border: '1px solid #e0d4c0', borderRadius: '8px', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', color: '#6b4c30' }}>
              🔄 Refresh Orders
            </button>
          </div>
        </div>
      )}

      {/* Backdrop */}
      {showPortalPanel && <div onClick={() => setShowPortalPanel(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.3)', zIndex: 999 }} />}

      {/* Menu / Selection Section */}
      <div className="pos-menu">
        <div className="category-tabs" id="cat-tabs">
          {categoriesList.map((cat, idx) => (
            <button
              key={idx}
              className={`cat-tab ${cat === category ? 'active' : ''}`}
              onClick={() => setCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
        <div className="product-grid" id="product-grid">
          {filteredProducts.map((p) => {
            const isOut = p.isOutOfStock;
            return (
              <div
                key={p.id}
                className="product-card"
                onClick={() => handleAddItemClick(p)}
                style={{
                  position: 'relative',
                  opacity: isOut ? 0.45 : 1,
                  cursor: isOut ? 'not-allowed' : 'pointer',
                  filter: isOut ? 'grayscale(100%)' : 'none'
                }}
              >
                {isOut && (
                  <span style={{
                    position: 'absolute',
                    top: '6px',
                    right: '6px',
                    background: 'var(--danger)',
                    color: '#fff',
                    fontSize: '0.6rem',
                    padding: '2px 6px',
                    borderRadius: '10px',
                    fontWeight: 700
                  }}>
                    OUT OF STOCK
                  </span>
                )}
                <div className="product-emoji" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ProductThumb product={p} size={48} />
                </div>
                <div className="product-name">{p.name}</div>
                <div className="product-price">{formatPHP(p.price)}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cart / Checkout Section */}
      <div className="pos-cart">
        <div className="cart-panel">
          <div className="cart-header">
            <span>🛒 Current Order</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => { setShowPortalPanel(true); loadPortalOrders(); }}
                style={{
                  background: portalOrders.length > 0 ? '#d4a373' : '#8b7355',
                  color: '#fff', border: 'none', borderRadius: '8px',
                  padding: '5px 11px', fontWeight: 700, fontSize: '0.78rem',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  animation: portalOrders.length > 0 ? 'pulse 2s infinite' : 'none'
                }}
              >
                📥 Portal
                {portalOrders.length > 0 && (
                  <span style={{ background: '#c0392b', color: '#fff', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.68rem', fontWeight: 800 }}>
                    {portalOrders.length}
                  </span>
                )}
              </button>
              <button className="btn btn-sm btn-secondary" onClick={handleClearCart}>Clear</button>
            </div>
          </div>

          <div className="cart-items" id="cart-items">
            {cart.length === 0 ? (
              <div className="cart-empty">
                <div className="cart-empty-icon">🍽️</div>
                <span>Tap items to add to order</span>
              </div>
            ) : (
              cart.map((item, idx) => (
                <div className="cart-item" key={item.cartKey + idx}>
                  <div className="cart-item-emoji" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ProductThumb product={item} size={32} />
                  </div>
                  <div
                    className="cart-item-info"
                    onClick={() => handleCartItemClick(idx)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="cart-item-name">{item.name}</div>
                    {item.customizations && (
                      <div className="cart-item-details">
                        {item.customizations.temperature && <span>{item.customizations.temperature === 'Hot' ? '☕ Hot' : '🧊 Cold'}</span>}
                        {item.customizations.sugar && item.customizations.sugar !== '100%' && <span>{item.customizations.sugar} Sugar</span>}
                        {item.customizations.milk && item.customizations.milk !== 'Whole' && <span>{item.customizations.milk} Milk</span>}
                        {item.customizations.iceCream && <span>+ Ice Cream</span>}
                        {item.customizations.drinkaddon && item.customizations.drinkaddon !== 'None' && <span>+ {item.customizations.drinkaddon}</span>}
                      </div>
                    )}
                    <div className="cart-item-price">{formatPHP(item.finalPrice || item.price)} each</div>
                  </div>
                  <div className="cart-qty">
                    <button className="qty-btn" onClick={() => handleQtyChange(idx, -1)}>−</button>
                    <span className="qty-num">{item.qty}</span>
                    <button className="qty-btn" onClick={() => handleQtyChange(idx, 1)}>+</button>
                  </div>
                  <div className="cart-item-total">{formatPHP((item.finalPrice || item.price) * item.qty)}</div>
                </div>
              ))
            )}
          </div>

          <div className="cart-footer">
            <div className="discount-row">
              <input
                type="number"
                id="discount-input"
                placeholder="Discount (₱)"
                min="0"
                value={discount || ''}
                onChange={(e) => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
              />
            </div>
            <div className="cart-totals" id="cart-totals">
              <div className="cart-row"><span>Subtotal</span><span>{formatPHP(subtotal)}</span></div>
              {discount > 0 && (
                <div className="cart-row">
                  <span>Discount</span>
                  <span style={{ color: 'var(--danger)' }}>−{formatPHP(discount)}</span>
                </div>
              )}
              <div className="cart-row total"><span>Total</span><span>{formatPHP(total)}</span></div>
              {pointsToEarn > 0 && (
                <div className="cart-row" style={{ color: 'var(--success)', fontSize: '0.78rem' }}>
                  <span>🏆 Points to earn</span>
                  <span>+{pointsToEarn} pts</span>
                </div>
              )}
            </div>

            {/* Table Number + Cash only */}
            <div className="pos-meta-row">
              <div className="pos-meta-group">
                <label className="pos-meta-label">🪑 Table #</label>
                <input
                  type="text"
                  className="pos-meta-input"
                  placeholder="e.g. 5"
                  maxLength={4}
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value.replace(/[^0-9]/g, ''))}
                  style={{ width: '70px', textAlign: 'center', fontWeight: 700, fontSize: '1rem' }}
                />
              </div>
              <div className="pos-meta-group" style={{ flex: 1, marginLeft: '10px' }}>
                <label className="pos-meta-label">💳 Payment</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                  <span className="pay-btn active" style={{ cursor: 'default', padding: '6px 14px' }}>💵 Cash</span>
                </div>
              </div>
            </div>

            {/* Customer Loyalty ID */}
            <div className="pos-loyalty-row">
              <label className="pos-meta-label">
                🆔 Customer Loyalty ID <span style={{ fontWeight: 400, color: 'var(--text-light)', fontSize: '0.75rem' }}>(optional)</span>
              </label>
              <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                <input
                  type="text"
                  className="pos-meta-input"
                  placeholder="6-digit ID"
                  maxLength={6}
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value.replace(/[^0-9]/g, ''))}
                  style={{ flex: 1, letterSpacing: '0.15em', fontWeight: 700 }}
                />
                <button className="btn btn-sm btn-secondary" onClick={handleLookupCustomer} disabled={lookingUp}>
                  {lookingUp ? '...' : 'Look Up'}
                </button>
              </div>
              {customerPreview.text && (
                <div
                  style={{
                    marginTop: '5px',
                    fontSize: '0.82rem',
                    color: customerPreview.type === 'success' ? 'var(--success)' :
                           customerPreview.type === 'danger' ? 'var(--danger)' : 'var(--text-light)',
                    minHeight: '18px'
                  }}
                >
                  {customerPreview.text}
                </div>
              )}
            </div>

            <button
              className="btn btn-primary btn-lg"
              style={{ width: '100%' }}
              disabled={cart.length === 0}
              onClick={handleCheckout}
            >
              Checkout
            </button>
          </div>
        </div>
      </div>

      {/* Customization Modal */}
      {custModalOpen && customizingProduct && (
        <div className="modal-overlay" style={{ display: 'flex' }} onClick={(e) => e.target.classList.contains('modal-overlay') && setCustModalOpen(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">{customizingIndex !== null ? 'Edit Item' : 'Customize Item'}</h2>
              <button className="modal-close" onClick={() => setCustModalOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="custom-modal-body">
                <div className="custom-product-info">
                  <span className="custom-emoji" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ProductThumb product={customizingProduct} size={44} />
                  </span>
                  <div>
                    <h3>{customizingProduct.name}</h3>
                    <p className="text-muted">{formatPHP(customizingProduct.price)} base price</p>
                  </div>
                </div>

                {/* Coffee / Non-Coffee / Floating Chills: Temperature */}
                {(customizingProduct?.category === 'Coffee' || customizingProduct?.category === 'Non-Coffee' || customizingProduct?.category === 'Floating Chills') && (
                  <>
                    <div className="custom-section">
                      <label className="custom-label">🌡️ Temperature</label>
                      <div className="custom-options">
                        {['Cold', 'Hot'].map(t => (
                          <label className="option-pill" key={t}>
                            <input type="radio" name="temperature" value={t} checked={temperature === t} onChange={() => setTemperature(t)} />
                            <span>{t === 'Cold' ? '🧊 Cold' : '☕ Hot (+₱20)'}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    {/* Sugar + Milk only for Coffee / Non-Coffee, not Floating Chills */}
                    {(customizingProduct?.category === 'Coffee' || customizingProduct?.category === 'Non-Coffee') && (
                      <>
                        <div className="custom-section">
                          <label className="custom-label">🍬 Sugar Level</label>
                          <div className="custom-options sugar-options">
                            {['0%', '25%', '50%', '75%', '100%'].map(s => (
                              <label className="option-pill" key={s}>
                                <input type="radio" name="sugar" value={s} checked={sugar === s} onChange={() => setSugar(s)} />
                                <span>{s}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                        <div className="custom-section">
                          <label className="custom-label">🥛 Milk Type</label>
                          <div className="custom-options">
                            {[{v:'Whole',l:'Whole'},{v:'Oat',l:'Oat (+₱25)'},{v:'Almond',l:'Almond (+₱30)'}].map(m => (
                              <label className="option-pill" key={m.v}>
                                <input type="radio" name="milk" value={m.v} checked={milk === m.v} onChange={() => setMilk(m.v)} />
                                <span>{m.l}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </>
                )}

                {/* Blended: Ice Cream add-on */}
                {customizingProduct?.category === 'Blended' && (
                  <div className="custom-section">
                    <label className="custom-label">🍨 Extras</label>
                    <div className="custom-options-grid">
                      <label className="option-check">
                        <input type="checkbox" checked={iceCream} onChange={e => setIceCream(e.target.checked)} />
                        <span>Add Ice Cream (+₱50)</span>
                      </label>
                    </div>
                  </div>
                )}

                {/* Food: Add a drink */}
                {customizingProduct?.category === 'Food' && (
                  <div className="custom-section">
                    <label className="custom-label">🥤 Add a Drink</label>
                    <div className="custom-options">
                      {[{v:'None',l:'None'},{v:'Iced Tea',l:'Iced Tea (+₱20)'},{v:'Soda',l:'Soda (+₱30)'}].map(d => (
                        <label className="option-pill" key={d.v}>
                          <input type="radio" name="drinkaddon" value={d.v} checked={drinkaddon === d.v} onChange={() => setDrinkaddon(d.v)} />
                          <span>{d.l}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div className="modal-actions">
                  <button className="btn btn-secondary" onClick={() => setCustModalOpen(false)}>Cancel</button>
                  <button className="btn btn-primary" onClick={handleConfirmCustomization}>
                    {customizingIndex !== null ? 'Update Item' : 'Add to Order'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {receiptModalOpen && receiptData && (
        <div className="modal-overlay" style={{ display: 'flex' }} onClick={(e) => e.target.classList.contains('modal-overlay') && setReceiptModalOpen(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Order Complete ✓</h2>
              <button className="modal-close" onClick={() => setReceiptModalOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="receipt">
                <div className="receipt-header">
                  <div className="receipt-brand">☕ KapeBara</div>
                  <div className="receipt-sub" style={{ fontSize: '1.1rem', fontWeight: 800, letterSpacing: '0.05em' }}>{receiptData.order_number}</div>
                  {receiptData.tableNum && (
                    <div className="receipt-sub" style={{ fontSize: '0.9rem', fontWeight: 700 }}>
                      🪑 Table {receiptData.tableNum}
                    </div>
                  )}
                  <div className="receipt-sub">{new Date().toLocaleString('en-PH')}</div>
                </div>
                <div className="receipt-items">
                  {receiptData.items.map((i, index) => (
                    <div className="receipt-item-group" key={index}>
                      <div className="receipt-item">
                        <span>{i.name} x{i.qty}</span>
                        <span>{formatPHP((i.finalPrice || i.price) * i.qty)}</span>
                      </div>
                      {i.customizations && (
                        <div className="receipt-item-details">
                          {i.customizations.temperature && <span>Temp: {i.customizations.temperature}</span>}
                          {i.customizations.sugar && i.customizations.sugar !== '100%' && <span>Sugar: {i.customizations.sugar}</span>}
                          {i.customizations.milk && i.customizations.milk !== 'Whole' && <span>Milk: {i.customizations.milk}</span>}
                          {i.customizations.iceCream && <span>+ Ice Cream</span>}
                          {i.customizations.drinkaddon && i.customizations.drinkaddon !== 'None' && <span>+ {i.customizations.drinkaddon}</span>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <hr className="receipt-divider" />
                <div className="receipt-total-row"><span>Subtotal</span><span>{formatPHP(receiptData.subtotal)}</span></div>
                {receiptData.discount > 0 && (
                  <div className="receipt-total-row"><span>Discount</span><span>−{formatPHP(receiptData.discount)}</span></div>
                )}
                <div className="receipt-total-row final"><span>TOTAL</span><span>{formatPHP(receiptData.total)}</span></div>
                <div className="receipt-total-row"><span>Payment</span><span>💵 Cash</span></div>
                {receiptData.pointsInfo && (
                  <div className="receipt-points">
                    🏆 +{receiptData.pointsInfo.pointsEarned} pts awarded to <strong>{receiptData.pointsInfo.customerName}</strong> ({receiptData.pointsInfo.newTotal} total)
                  </div>
                )}
                <div className="receipt-footer">Thank you for visiting KapeBara!<br />Come back soon ☕</div>
              </div>
              <div className="modal-actions">
                <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setReceiptModalOpen(false)}>
                  🛒 New Order
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
