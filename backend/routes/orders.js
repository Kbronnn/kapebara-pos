const express    = require('express');
const { Order, Product, Ingredient } = require('../db/database');

const router = express.Router();

// Helper: get start of today (local midnight)
function todayRange() {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end   = new Date(); end.setHours(23, 59, 59, 999);
  return { start, end };
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
    const todayOrders = await Order.find({ created_at: { $gte: start, $lte: end }, status: 'completed' });

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
    const weekOrders = await Order.find({ created_at: { $gte: weekStart }, status: 'completed' });
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
      { $match: { created_at: { $gte: since }, status: 'completed' } },
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
      { $match: { created_at: { $gte: since }, status: 'completed' } },
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
      { $match: { created_at: { $gte: since }, status: 'completed' } },
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

// POST create order (deducts inventory)
router.post('/', async (req, res) => {
  const { items, discount = 0, payment_method = 'Cash', notes = '' } = req.body;
  if (!Array.isArray(items) || items.length === 0)
    return res.status(400).json({ error: 'Order must have at least one item' });

  const session = await Order.startSession();
  session.startTransaction();
  try {
    let subtotal = 0;
    const resolvedItems = [];

    for (const { product_id, quantity, customizations } of items) {
      const product = await Product.findOne({ _id: product_id, active: 1 }).session(session);
      if (!product) throw new Error(`Product ${product_id} not found or inactive`);

      let extraCost = 0;
      if (customizations) {
        if (customizations.milk === 'Oat')    extraCost += 25;
        if (customizations.milk === 'Almond') extraCost += 30;
        if (customizations.addons) {
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

      // Deduct ingredients
      for (const { ingredient_id, quantity_used } of product.ingredients) {
        await Ingredient.findOneAndUpdate(
          { _id: ingredient_id },
          [{ $set: { current_stock: { $max: [0, { $subtract: ['$current_stock', quantity_used * quantity] }] } } }],
          { session }
        );
      }
    }

    const total = subtotal - discount;
    const [order] = await Order.create([{
      subtotal, discount, total, payment_method, notes, items: resolvedItems
    }], { session });

    await session.commitTransaction();
    res.status(201).json({ message: 'Order created', orderId: order.id, subtotal, discount, total });
  } catch (err) {
    await session.abortTransaction();
    res.status(400).json({ error: err.message });
  } finally {
    session.endSession();
  }
});

module.exports = router;
