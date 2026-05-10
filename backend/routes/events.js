const express = require('express');
const { Event } = require('../db/database');

const router = express.Router();

// GET all events
router.get('/', async (req, res) => {
  try {
    const events = await Event.find().sort({ date: 1 });
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// POST customer joins an event
router.post('/:id/join', async (req, res) => {
  const { customerId } = req.body;
  if (!customerId) return res.status(400).json({ error: 'Customer ID is required' });

  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const alreadyJoined = event.participants.some(p => p.toString() === customerId);
    if (alreadyJoined) return res.status(400).json({ error: 'You have already joined this event' });

    event.participants.push(customerId);
    await event.save();
    res.json({ message: 'Successfully joined event!' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to join event' });
  }
});

// POST customer proposes a new event
router.post('/', async (req, res) => {
  const { title, description, date, hostName } = req.body;
  if (!title || !date || !hostName)
    return res.status(400).json({ error: 'Title, date, and hostName are required' });

  try {
    const event = await Event.create({
      title, description, date, type: 'customer',
      host_name: hostName, status: 'pending_approval'
    });
    res.status(201).json({ message: 'Event request submitted successfully!', id: event.id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit event request' });
  }
});

// PATCH approve / reject an event
router.patch('/:id/status', async (req, res) => {
  const { status } = req.body;
  const allowed = ['approved', 'rejected', 'pending_approval'];
  if (!allowed.includes(status))
    return res.status(400).json({ error: 'Invalid status value' });

  try {
    const event = await Event.findByIdAndUpdate(req.params.id, { status });
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json({ message: `Event ${status} successfully.` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update event status' });
  }
});

module.exports = router;
