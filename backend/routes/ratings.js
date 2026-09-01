const express = require('express');
const { Rating, Customer } = require('../db/database');

const router = express.Router();

// GET all ratings with customer names
router.get('/', async (req, res) => {
  try {
    const ratings = await Rating.find()
      .populate('customer_id', 'name')
      .sort({ created_at: -1 });

    const result = ratings.map(r => ({
      id:            r.id,
      customer_id:   r.customer_id?._id || null,
      customer_name: r.customer_id?.name || 'Guest',
      rating:        r.rating,
      comment:       r.comment,
      created_at:    r.created_at
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch ratings' });
  }
});

// POST a new rating
router.post('/', async (req, res) => {
  const { customerId, rating, comment } = req.body;
  if (!rating) return res.status(400).json({ error: 'Rating is required' });

  try {
    await Rating.create({
      customer_id: customerId || null,
      rating,
      comment
    });
    res.status(201).json({ message: 'Rating submitted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit rating' });
  }
});

// DELETE a rating by ID
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Rating.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Rating not found' });
    res.json({ message: 'Rating deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete rating' });
  }
});

module.exports = router;
