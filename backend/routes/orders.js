const express    = require('express');
const { Order, Product, Ingredient, Customer, Counter } = require('../db/database');

const router = express.Router();

// Helper: get start of today (local midnight)
function todayRange() {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end   = new Date(); end.setHours(23, 59, 59, 999);
  return { start, end };
}

// Helper: generate next clean order number (KB-000001)
async function nextOrderNumber() {
  const counter = await Counter.findByIdAndUpdate(
    'orders',
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `KB-${String(counter.seq).padStart(6, '0')}`;
}

// GET orders with optional period filter
router.get('/', async (req, res) => {
  const { period = '7d', limit = 50 } = req.query;
  const days = { '1d':1, '7d':7, '30d':30, '90d':90 }[period] || 7;
  const since = new Date(); since.setDate(since.getDate() - days);

  try {
    const orders = await Order.find({ created_at: { $gte: since } })
      .sort({ created_at: -1 })
      .limit(parseInt(limit));

    const result = orders.map(o => ({
      ...o.toJSON(),
      items_summary: o.items.map(i => `${i.product_name} x${i.quantity}`).join(', ')
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// GET today's summary (dashboard stats)
router.get('/summary/today', async (req, res) => {
  const { start, end } = todayRange();

  try {
    const todayOrders = await Order.find({ created_at: { $gte: start, $lte: end }, status: { $ne: 'cancelled' } });

    const total_orders    = todayOrders.length;
    const revenue         = todayOrders.reduce((s, o) => s + o.total, 0);
    const discounts_given = todayOrders.reduce((s, o) => s + o.discount, 0);
    const avg_order_value = total_orders > 0 ? revenue / total_orders : 0;

    // Top item
    const itemMap = {};
    todayOrders.forEach(o => o.items.forEach(i => {
      itemMap[i.product_name] = (itemMap[i.product_name] || 0) + i.quantity;
    }));
    const topEntry = Object.entries(itemMap).sort((a, b) => b[1] - a[1])[0];
    const topItem  = topEntry ? { product_name: topEntry[0], qty: topEntry[1] } : null;

    // Last 7 days revenue
    const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 6); weekStart.setHours(0,0,0,0);
    const weekOrders = await Order.find({ created_at: { $gte: weekStart }, status: { $ne: 'cancelled' } });
    const weekMap = {};
    weekOrders.forEach(o => {
      const day = o.created_at.toISOString().slice(0, 10);
      if (!weekMap[day]) weekMap[day] = { day, revenue: 0, orders: 0 };
      weekMap[day].revenue += o.total;
      weekMap[day].orders  += 1;
    });
    const weekRevenue = Object.values(weekMap).sort((a, b) => a.day.localeCompare(b.day));

    res.json({ today: { total_orders, revenue, discounts_given, avg_order_value }, topItem, weekRevenue });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

// GET today's orders with full item details
router.get('/today', async (req, res) => {
  const { start, end } = todayRange();
  try {
    const orders = await Order.find({ created_at: { $gte: start, $lte: end } }).sort({ created_at: -1 });
    res.json(orders.map(o => ({ ...o.toJSON(), items: o.items })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch today orders' });
  }
});

// GET sales report
router.get('/reports/sales', async (req, res) => {
  const { period = '7d' } = req.query;
  const days  = { '7d':7, '30d':30, '90d':90 }[period] || 7;
  const since = new Date(); since.setDate(since.getDate() - days);

  try {
    // Daily revenue
    const daily = await Order.aggregate([
      { $match: { created_at: { $gte: since }, status: { $ne: 'cancelled' } } },
      { $group: {
          _id:       { $dateToString: { format: '%Y-%m-%d', date: '$created_at' } },
          revenue:   { $sum: '$total' },
          orders:    { $sum: 1 },
          discounts: { $sum: '$discount' }
      }},
      { $sort: { _id: 1 } },
      { $project: { day: '$_id', revenue: 1, orders: 1, discounts: 1, _id: 0 } }
    ]);

    // Top products
    const topProducts = await Order.aggregate([
      { $match: { created_at: { $gte: since }, status: { $ne: 'cancelled' } } },
      { $unwind: '$items' },
      { $group: {
          _id:      '$items.product_name',
          qty_sold: { $sum: '$items.quantity' },
          revenue:  { $sum: '$items.subtotal' }
      }},
      { $sort: { qty_sold: -1 } },
      { $limit: 10 },
      { $project: { product_name: '$_id', qty_sold: 1, revenue: 1, _id: 0 } }
    ]);

    // Revenue by category (via product lookup)
    const byCategory = await Order.aggregate([
      { $match: { created_at: { $gte: since }, status: { $ne: 'cancelled' } } },
      { $unwind: '$items' },
      { $lookup: { from: 'products', localField: 'items.product_id', foreignField: '_id', as: 'prod' } },
      { $unwind: { path: '$prod', preserveNullAndEmptyArrays: true } },
      { $group: {
          _id:     '$prod.category',
          revenue: { $sum: '$items.subtotal' },
          qty:     { $sum: '$items.quantity' }
      }},
      { $sort: { revenue: -1 } },
      { $project: { category: '$_id', revenue: 1, qty: 1, _id: 0 } }
    ]);

    res.json({ daily, topProducts, byCategory });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch sales report' });
  }
});

// GET pending/processing portal orders (for Staff POS view)
router.get('/portal-pending', async (req, res) => {
  try {
    const orders = await Order.find({ source: 'portal', status: { $in: ['pending', 'processing'] } })
      .sort({ created_at: 1 });

    const result = await Promise.all(orders.map(async (o) => {
      const json = o.toJSON();
      if (o.customer_id && (!json.customer_name || !json.customer_unique_id)) {
        try {
          const cust = await Customer.findById(o.customer_id);
          if (cust) {
            json.customer_name = cust.name || json.customer_name;
            json.customer_unique_id = cust.unique_id || json.customer_unique_id;
          }
        } catch {}
      }
      return {
        ...json,
        items_summary: o.items.map(i => `${i.product_name} x${i.quantity}`).join(', ')
      };
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch portal orders' });
  }
});

// GET customer's own portal orders
router.get('/my-orders/:customerId', async (req, res) => {
  try {
    const orders = await Order.find({ source: 'portal', customer_id: req.params.customerId })
      .sort({ created_at: -1 })
      .limit(20);
    res.json(orders.map(o => ({ ...o.toJSON(), items: o.items })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch customer orders' });
  }
});

// GET single order
router.get('/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json({ ...order.toJSON(), items: order.items });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// PATCH update order status (e.g. pending -> completed / processing)
router.patch('/:id/status', async (req, res) => {
  const { status } = req.body;
  const allowed = ['pending', 'processing', 'completed', 'cancelled'];
  if (!allowed.includes(status))
    return res.status(400).json({ error: 'Invalid status' });

  try {
    const existingOrder = await Order.findById(req.params.id);
    if (!existingOrder) return res.status(404).json({ error: 'Order not found' });

    const prevStatus = existingOrder.status;
    existingOrder.status = status;
    await existingOrder.save();

    // Automatically award points when order transitions to completed (only if not previously completed)
    if (status === 'completed' && prevStatus !== 'completed') {
      try {
        let cust = null;
        if (existingOrder.customer_id) {
          cust = await Customer.findById(existingOrder.customer_id);
        } else if (existingOrder.customer_unique_id) {
          cust = await Customer.findOne({ unique_id: existingOrder.customer_unique_id });
        }

        if (cust) {
          const ptsEarned = Math.floor(existingOrder.total / 10);
          if (ptsEarned > 0) {
            cust.points += ptsEarned;
            if (cust.points >= 5000) cust.loyalty_level = 'Platinum';
            else if (cust.points >= 2000) cust.loyalty_level = 'Gold';
            else if (cust.points >= 500) cust.loyalty_level = 'Silver';
            await cust.save();
          }
        }
      } catch (ptsErr) {
        console.error('Failed to auto-award points:', ptsErr);
      }
    }

    // Handle cancellation: restore inventory & revert points if previously completed
    if (status === 'cancelled' && prevStatus !== 'cancelled') {
      // 1. Restore inventory for POS orders
      if (existingOrder.source === 'pos' && Array.isArray(existingOrder.items)) {
        for (const item of existingOrder.items) {
          try {
            const product = await Product.findById(item.product_id);
            if (product && Array.isArray(product.ingredients)) {
              for (const { ingredient_id, quantity_used } of product.ingredients) {
                await Ingredient.findByIdAndUpdate(
                  ingredient_id,
                  { $inc: { current_stock: quantity_used * item.quantity } }
                );
              }
            }
          } catch (e) {
            console.error('Failed to restore ingredients on order cancel:', e);
          }
        }
      }

      // 2. Revert points if previously completed
      if (prevStatus === 'completed') {
        try {
          let cust = null;
          if (existingOrder.customer_id) {
            cust = await Customer.findById(existingOrder.customer_id);
          } else if (existingOrder.customer_unique_id) {
            cust = await Customer.findOne({ unique_id: existingOrder.customer_unique_id });
          }
          if (cust) {
            const ptsEarned = Math.floor(existingOrder.total / 10);
            if (ptsEarned > 0) {
              cust.points = Math.max(0, cust.points - ptsEarned);
              if (cust.points >= 5000) cust.loyalty_level = 'Platinum';
              else if (cust.points >= 2000) cust.loyalty_level = 'Gold';
              else if (cust.points >= 500) cust.loyalty_level = 'Silver';
              else cust.loyalty_level = 'Bronze';
              await cust.save();
            }
          }
        } catch (ptsErr) {
          console.error('Failed to revert points on cancel:', ptsErr);
        }
      }
    }

    // Handle un-cancelling (re-deduct inventory if returning from cancelled)
    if (prevStatus === 'cancelled' && status !== 'cancelled') {
      if (existingOrder.source === 'pos' && Array.isArray(existingOrder.items)) {
        for (const item of existingOrder.items) {
          try {
            const product = await Product.findById(item.product_id);
            if (product && Array.isArray(product.ingredients)) {
              for (const { ingredient_id, quantity_used } of product.ingredients) {
                await Ingredient.findOneAndUpdate(
                  { _id: ingredient_id },
                  [{ $set: { current_stock: { $max: [0, { $subtract: ['$current_stock', quantity_used * item.quantity] }] } } }]
                );
              }
            }
          } catch (e) {
            console.error('Failed to re-deduct ingredients on un-cancel:', e);
          }
        }
      }
    }

    res.json({ message: `Order status updated to ${status}`, order: existingOrder.toJSON() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// POST create order (deducts inventory)
router.post('/', async (req, res) => {
  const {
    items, discount = 0, payment_method = 'Cash',
    notes = '', table_number = '', customer_id = null,
    source = 'pos', customer_name = ''
  } = req.body;

  if (!Array.isArray(items) || items.length === 0)
    return res.status(400).json({ error: 'Order must have at least one item' });

  try {
    let subtotal = 0;
    const resolvedItems = [];

    // Lookup customer details if customer_id provided
    let finalCustName = customer_name;
    let finalCustUniqueId = '';
    if (customer_id) {
      try {
        const custDoc = await Customer.findById(customer_id);
        if (custDoc) {
          finalCustName = custDoc.name || finalCustName;
          finalCustUniqueId = custDoc.unique_id || '';
        }
      } catch {}
    }

    for (const { product_id, quantity, customizations } of items) {
      const product = await Product.findOne({ _id: product_id, active: 1 });
      if (!product) throw new Error(`Product ${product_id} not found or inactive`);

      // ── Extra cost calculation based on customizations ──────────────────────
      let extraCost = 0;
      if (customizations) {
        // Coffee / Non-Coffee temperature
        if (customizations.temperature === 'Hot') extraCost += 20;
        // Milk type upgrades
        if (customizations.milk === 'Oat')        extraCost += 25;
        if (customizations.milk === 'Almond')     extraCost += 30;
        // Blended series — add ice cream
        if (customizations.iceCream)              extraCost += 50;
        // Food — add a drink
        if (customizations.drinkaddon === 'Iced Tea') extraCost += 20;
        if (customizations.drinkaddon === 'Soda')     extraCost += 30;
        // Legacy add-ons (kept for backwards-compat)
        if (Array.isArray(customizations.addons)) {
          if (customizations.addons.includes('Extra Shot'))      extraCost += 25;
          if (customizations.addons.includes('Caramel Drizzle')) extraCost += 15;
          if (customizations.addons.includes('Whipped Cream'))   extraCost += 20;
        }
      }

      const finalUnitPrice = product.price + extraCost;
      const finalSubtotal  = finalUnitPrice * quantity;
      subtotal += finalSubtotal;

      resolvedItems.push({
        product_id:     product._id,
        product_name:   product.name,
        quantity,
        unit_price:     finalUnitPrice,
        subtotal:       finalSubtotal,
        customizations: customizations || {}
      });

      // Deduct ingredients only for POS orders (portal orders deduct at checkout)
      if (source === 'pos') {
        for (const { ingredient_id, quantity_used } of product.ingredients) {
          await Ingredient.findOneAndUpdate(
            { _id: ingredient_id },
            [{ $set: { current_stock: { $max: [0, { $subtract: ['$current_stock', quantity_used * quantity] }] } } }]
          );
        }
      }
    }

    const total       = Math.max(0, subtotal - discount);
    const orderStatus = req.body.status || 'pending';
    const order_number = await nextOrderNumber();

    const order = await Order.create({
      order_number,
      subtotal, discount, total, payment_method, table_number,
      customer_id: customer_id || null,
      customer_name: finalCustName || '',
      customer_unique_id: finalCustUniqueId || '',
      source, status: orderStatus,
      notes, items: resolvedItems
    });

    res.status(201).json({
      message: 'Order created',
      orderId: order.id,
      order_number,
      subtotal,
      discount,
      total
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
