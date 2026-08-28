const express  = require('express');
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const { Product, Ingredient } = require('../db/database');

const router = express.Router();

// ── Multer setup ─────────────────────────────────────────────────────────────
// In production on Render, use the persistent disk mounted at /opt/render/project/src/uploads
// In development, use the local uploads/ folder
const uploadDir = process.env.NODE_ENV === 'production'
  ? '/opt/render/project/src/uploads/products'
  : path.join(__dirname, '../uploads/products');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });


const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename:    (_req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase();
    const name = `product-${Date.now()}${ext}`;
    cb(null, name);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp|gif/;
    const ok = allowed.test(path.extname(file.originalname).toLowerCase()) &&
               allowed.test(file.mimetype.replace('image/', ''));
    ok ? cb(null, true) : cb(new Error('Only image files are allowed'));
  }
});

// POST /api/products/upload-image  — upload a product image
router.post('/upload-image', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const imageUrl = `/uploads/products/${req.file.filename}`;
  res.json({ image_url: imageUrl });
});

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
  const { name, category, price, description, emoji, image_url, ingredients, is_best_seller, is_special_edition } = req.body;
  if (!name || !category || !price)
    return res.status(400).json({ error: 'name, category, price are required' });

  try {
    const ingArr = Array.isArray(ingredients)
      ? ingredients.map(({ ingredient_id, quantity_used }) => ({ ingredient_id, quantity_used }))
      : [];

    const product = await Product.create({
      name, category, price, description, emoji: emoji || '☕',
      image_url: image_url || '',
      is_best_seller: !!is_best_seller,
      is_special_edition: !!is_special_edition,
      ingredients: ingArr
    });
    res.status(201).json({ id: product.id, message: 'Product created' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// PUT update product
router.put('/:id', async (req, res) => {
  const { name, category, price, description, emoji, image_url, active, ingredients, is_best_seller, is_special_edition } = req.body;
  try {
    const updates = {
      name, category, price, description, emoji, active: active ?? 1,
      is_best_seller: !!is_best_seller,
      is_special_edition: !!is_special_edition
    };
    if (image_url !== undefined) updates.image_url = image_url;
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
