const express = require('express');
const { ShopSettings } = require('../db/database');

const router = express.Router();

// Helper: get or create singleton settings document
async function getSettings() {
  let settings = await ShopSettings.findOne();
  if (!settings) {
    settings = await ShopSettings.create({});
  }
  return settings;
}

// GET current shop settings
router.get('/', async (req, res) => {
  try {
    const settings = await getSettings();
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// PUT update shop settings
router.put('/', async (req, res) => {
  const { max_people_per_event, max_concurrent_events, shop_open_time, shop_close_time } = req.body;
  try {
    let settings = await ShopSettings.findOne();
    if (!settings) {
      settings = await ShopSettings.create({});
    }
    const updates = {};
    if (max_people_per_event  !== undefined) updates.max_people_per_event  = parseInt(max_people_per_event);
    if (max_concurrent_events !== undefined) updates.max_concurrent_events = parseInt(max_concurrent_events);
    if (shop_open_time        !== undefined) updates.shop_open_time        = shop_open_time;
    if (shop_close_time       !== undefined) updates.shop_close_time       = shop_close_time;

    await ShopSettings.findByIdAndUpdate(settings._id, updates, { new: true });
    res.json({ message: 'Settings updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

module.exports = router;
