const express = require('express');
const { Ingredient } = require('../db/database');

const router = express.Router();

function calcStatus(ing) {
  if (ing.current_stock <= ing.min_stock * 0.5) return 'critical';
  if (ing.current_stock <= ing.min_stock)       return 'low';
  return 'ok';
}

// GET all ingredients
router.get('/', async (req, res) => {
  try {
    const ingredients = await Ingredient.find().sort({ name: 1 });
    const result = ingredients.map(i => ({ ...i.toJSON(), status: calcStatus(i) }));
    // Sort: critical first, then low, then ok
    result.sort((a, b) => {
      const order = { critical: 0, low: 1, ok: 2 };
      return order[a.status] - order[b.status];
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch ingredients' });
  }
});

// GET low-stock alerts
router.get('/alerts', async (req, res) => {
  try {
    const ingredients = await Ingredient.find({
      $expr: { $lte: ['$current_stock', '$min_stock'] }
    }).sort({ current_stock: 1 });

    const result = ingredients.map(i => ({ ...i.toJSON(), status: calcStatus(i) }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// PUT update ingredient
router.put('/:id', async (req, res) => {
  const { current_stock, min_stock, name } = req.body;
  const updates = {};
  if (current_stock !== undefined) updates.current_stock = current_stock;
  if (min_stock     !== undefined) updates.min_stock     = min_stock;
  if (name          !== undefined) updates.name          = name;

  if (Object.keys(updates).length === 0)
    return res.status(400).json({ error: 'Nothing to update' });

  try {
    const ing = await Ingredient.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!ing) return res.status(404).json({ error: 'Ingredient not found' });
    res.json({ message: 'Ingredient updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update ingredient' });
  }
});

// POST restock ingredient
router.post('/:id/restock', async (req, res) => {
  const { amount } = req.body;
  if (!amount || amount <= 0)
    return res.status(400).json({ error: 'Invalid restock amount' });

  try {
    const ing = await Ingredient.findByIdAndUpdate(
      req.params.id,
      { $inc: { current_stock: amount } },
      { new: true }
    );
    if (!ing) return res.status(404).json({ error: 'Ingredient not found' });
    res.json({ message: 'Restocked successfully', ingredient: ing });
  } catch (err) {
    res.status(500).json({ error: 'Failed to restock' });
  }
});

module.exports = router;
