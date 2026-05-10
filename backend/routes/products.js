const express  = require('express');
const { Product, Ingredient } = require('../db/database');

const router = express.Router();

// GET all active products (with ingredient details)
router.get('/', async (req, res) => {
  try {
    const products = await Product.find({ active: 1 })
      .populate('ingredients.ingredient_id', 'name unit')
      .sort({ category: 1, name: 1 });

    const result = products.map(p => {
      const obj = p.toJSON();
      obj.ingredients = (p.ingredients || []).map(i => ({
        ingredient_id: i.ingredient_id?._id,
        name:          i.ingredient_id?.name,
        unit:          i.ingredient_id?.unit,
        quantity_used: i.quantity_used
      }));
      return obj;
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// GET single product
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('ingredients.ingredient_id', 'name unit');
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// POST create product
router.post('/', async (req, res) => {
  const { name, category, price, description, emoji, ingredients } = req.body;
  if (!name || !category || !price)
    return res.status(400).json({ error: 'name, category, price are required' });

  try {
    const ingArr = Array.isArray(ingredients)
      ? ingredients.map(({ ingredient_id, quantity_used }) => ({ ingredient_id, quantity_used }))
      : [];

    const product = await Product.create({ name, category, price, description, emoji: emoji || '☕', ingredients: ingArr });
    res.status(201).json({ id: product.id, message: 'Product created' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// PUT update product
router.put('/:id', async (req, res) => {
  const { name, category, price, description, emoji, active, ingredients } = req.body;
  try {
    const updates = { name, category, price, description, emoji, active: active ?? 1 };
    if (Array.isArray(ingredients)) {
      updates.ingredients = ingredients.map(({ ingredient_id, quantity_used }) => ({ ingredient_id, quantity_used }));
    }

    const product = await Product.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json({ message: 'Product updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// DELETE product (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, { active: 0 });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

module.exports = router;
