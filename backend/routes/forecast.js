const express = require('express');
const { Ingredient, Order } = require('../db/database');

const router = express.Router();

async function getForecast(windowDays = 14) {
  const ingredients = await Ingredient.find();
  const since = new Date(); since.setDate(since.getDate() - windowDays);

  // Aggregate daily ingredient usage from orders
  const dailyUsage = await Order.aggregate([
    { $match: { created_at: { $gte: since }, status: 'completed' } },
    { $unwind: '$items' },
    { $lookup: {
        from: 'products',
        localField: 'items.product_id',
        foreignField: '_id',
        as: 'product'
    }},
    { $unwind: '$product' },
    { $unwind: '$product.ingredients' },
    { $project: {
        day:          { $dateToString: { format: '%Y-%m-%d', date: '$created_at' } },
        ingredient_id: '$product.ingredients.ingredient_id',
        used:         { $multiply: ['$items.quantity', '$product.ingredients.quantity_used'] }
    }},
    { $group: {
        _id:  { ingredient_id: '$ingredient_id', day: '$day' },
        used: { $sum: '$used' }
    }}
  ]);

  // Build usageMap: ingredientId → [used per day]
  const usageMap = {};
  const dayUsageMap = {}; // ingredientId → { day → used }
  dailyUsage.forEach(({ _id, used }) => {
    const key = _id.ingredient_id?.toString();
    if (!key) return;
    if (!usageMap[key])    usageMap[key]    = [];
    if (!dayUsageMap[key]) dayUsageMap[key] = {};
    usageMap[key].push(used);
    dayUsageMap[key][_id.day] = used;
  });

  const projectionDays = 7;

  return ingredients.map(ing => {
    const key    = ing._id.toString();
    const usages = usageMap[key] || [];
    const avgDaily    = usages.length > 0 ? usages.reduce((a, b) => a + b, 0) / windowDays : 0;
    const projected7d = avgDaily * projectionDays;
    const restockNeeded  = Math.max(0, projected7d + ing.min_stock - ing.current_stock);
    const daysRemaining  = avgDaily > 0 ? Math.floor(ing.current_stock / avgDaily) : 999;

    const dailyProjection = Array.from({ length: projectionDays }, (_, i) => ({
      day: i + 1, projected: Math.round(avgDaily * 100) / 100
    }));

    const historicalDays = [];
    for (let i = windowDays - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const dayKey = d.toISOString().slice(0, 10);
      historicalDays.push({ day: dayKey, used: dayUsageMap[key]?.[dayKey] || 0 });
    }

    const status =
      ing.current_stock <= ing.min_stock * 0.5 ? 'critical' :
      ing.current_stock <= ing.min_stock        ? 'low'      :
      daysRemaining <= 3                        ? 'warning'  : 'ok';

    return {
      id:             ing.id,
      name:           ing.name,
      unit:           ing.unit,
      current_stock:  ing.current_stock,
      min_stock:      ing.min_stock,
      avg_daily_use:  Math.round(avgDaily * 100) / 100,
      projected_7d:   Math.round(projected7d * 100) / 100,
      restock_needed: Math.round(restockNeeded * 100) / 100,
      days_remaining: daysRemaining,
      status,
      chart: { historical: historicalDays, projection: dailyProjection }
    };
  });
}

router.get('/', async (req, res) => {
  try {
    const window = parseInt(req.query.window) || 14;
    res.json(await getForecast(window));
  } catch (err) {
    console.error('Forecast error:', err);
    res.status(500).json({ error: 'Failed to compute forecast' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const forecast = await getForecast(14);
    const item = forecast.find(f => f.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'Ingredient not found' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: 'Failed to compute forecast' });
  }
});

module.exports = router;
