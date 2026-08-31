const express = require('express');
const { Event, ShopSettings } = require('../db/database');

const router = express.Router();

// ── GET all events ────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const events = await Event.find();

    const d = new Date();
    const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const getSortKey = (e) => {
      const dateStr = e.date ? e.date.split('T')[0] : '9999-99-99';
      const timeStr = e.preferred_time || '00:00';
      return `${dateStr}T${timeStr}`;
    };

    const upcoming = events.filter(e => {
      const dateStr = e.date ? e.date.split('T')[0] : '';
      return dateStr >= todayStr;
    }).sort((a, b) => getSortKey(a).localeCompare(getSortKey(b)));

    const pastArr = events.filter(e => {
      const dateStr = e.date ? e.date.split('T')[0] : '';
      return dateStr < todayStr;
    }).sort((a, b) => getSortKey(b).localeCompare(getSortKey(a)));

    const sortedEvents = [...upcoming, ...pastArr];

    res.json(sortedEvents.map(e => ({
      ...e.toJSON(),
      customer_id: e.customer_id ? e.customer_id.toString() : null
    })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

function getEventDuration(startTime) {
  if (!startTime) return 3;
  const [h] = startTime.split(':').map(Number);
  if (h >= 22 || h === 0) return 1;
  return 3;
}

// ── GET calendar: approved events by date (for the live calendar) ─────────────
router.get('/calendar', async (req, res) => {
  try {
    const events = await Event.find({ status: 'approved' })
      .sort({ date: 1, preferred_time: 1 })
      .select('title date preferred_time duration_hours is_private max_participants participants participant_names');
    
    // Group by date
    const calendar = {};
    events.forEach(e => {
      const key = e.date ? e.date.split('T')[0] : e.date;
      if (!calendar[key]) calendar[key] = [];
      const dur = e.duration_hours || getEventDuration(e.preferred_time);
      calendar[key].push({
        id:               e.id,
        title:            e.is_private ? 'Private Event' : e.title,
        preferred_time:   e.preferred_time,
        duration_hours:   dur,
        is_private:       e.is_private,
        spots_taken:      e.participants.length,
        max_participants: e.max_participants
      });
    });
    res.json(calendar);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch calendar' });
  }
});

// ── GET events submitted by a specific customer (for approval notifications) ──
router.get('/my/:customerId', async (req, res) => {
  try {
    // Find events where host is this customer (by matching participants or created status)
    // We use participants array — first participant = organiser for customer-type events
    // Better: we match on type=customer and notified=false to surface newly approved ones
    const events = await Event.find({
      type:   'customer',
      status: { $in: ['approved', 'rejected'] },
      approval_notified: false,
      participants: req.params.customerId
    }).sort({ created_at: -1 });
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch customer events' });
  }
});

// ── PATCH mark event as notified (called after customer sees the banner) ───────
router.patch('/:id/notified', async (req, res) => {
  try {
    await Event.findByIdAndUpdate(req.params.id, { approval_notified: true });
    res.json({ message: 'Marked as notified' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark notified' });
  }
});

// ── POST customer joins an event ──────────────────────────────────────────────
router.post('/:id/join', async (req, res) => {
  const { customerId, participant_name } = req.body;
  if (!customerId) return res.status(400).json({ error: 'Customer ID is required' });

  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    // Capacity check
    if (event.participants.length >= event.max_participants) {
      return res.status(400).json({ error: `This event is full (max ${event.max_participants} guests)` });
    }

    const alreadyJoined = event.participants.some(p => p.toString() === customerId);
    if (alreadyJoined) return res.status(400).json({ error: 'You have already joined this event' });

    event.participants.push(customerId);
    if (participant_name && participant_name.trim()) {
      event.participant_names.push(participant_name.trim());
    }
    await event.save();
    res.json({ message: 'Successfully joined event!', spots_remaining: event.max_participants - event.participants.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to join event' });
  }
});

// ── POST customer leaves an event they joined ────────────────────────────────
router.post('/:id/leave', async (req, res) => {
  const { customerId, participant_name } = req.body;
  if (!customerId) return res.status(400).json({ error: 'Customer ID is required' });

  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    // Remove customerId from participants
    event.participants = event.participants.filter(p => p.toString() !== customerId);

    // If participant name is known, remove one occurrence of that name
    if (participant_name && event.participant_names) {
      const idx = event.participant_names.findIndex(n => n.toLowerCase() === participant_name.trim().toLowerCase());
      if (idx !== -1) {
        event.participant_names.splice(idx, 1);
      }
    }

    await event.save();
    res.json({ message: 'Successfully left the event', spots_remaining: event.max_participants - event.participants.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to leave event' });
  }
});

// ── POST customer cancels their own event booking ─────────────────────────────
router.post('/:id/cancel', async (req, res) => {
  const { customerId } = req.body;
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    // Verify ownership if customer_id is set
    if (event.customer_id && customerId && event.customer_id.toString() !== customerId) {
      return res.status(403).json({ error: 'You can only cancel your own events' });
    }

    event.status = 'cancelled';
    await event.save();
    res.json({ message: 'Event request cancelled successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to cancel event' });
  }
});

// ── GET all events joined by a customer (for notification bell & reminders) ──
router.get('/joined/:customerId', async (req, res) => {
  try {
    const events = await Event.find({
      participants: req.params.customerId,
      status: { $in: ['approved', 'upcoming'] }
    }).sort({ date: 1, preferred_time: 1 });
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch joined events' });
  }
});

// ── POST customer proposes a new event ────────────────────────────────────────
router.post('/', async (req, res) => {
  const { title, description, date, hostName, phone, preferred_time, is_private, max_participants, customer_id } = req.body;
  if (!title || !date || !hostName)
    return res.status(400).json({ error: 'Title, date, and hostName are required' });

  try {
    // Get shop settings singleton (or defaults)
    const settings = await ShopSettings.findOne() || {
      max_people_per_event: 30,
      max_concurrent_events: 1,
      shop_open_time: '14:00',
      shop_close_time: '00:00'
    };

    // 1. Max participants cap validation
    const proposedGuests = max_participants ? parseInt(max_participants) : 30;
    if (proposedGuests > settings.max_people_per_event) {
      return res.status(400).json({
        error: `Events are limited to a maximum of ${settings.max_people_per_event} guests.`
      });
    }

    // 2. Concurrent events limit check
    const approvedCount = await Event.countDocuments({ date, status: 'approved' });
    if (approvedCount >= settings.max_concurrent_events) {
      return res.status(400).json({
        error: `We have reached the maximum of approved events (${settings.max_concurrent_events}) for ${date}.`
      });
    }

    // 3. Time slot conflict check
    if (preferred_time) {
      const conflict = await Event.findOne({ date, preferred_time, status: 'approved' });
      if (conflict) {
        return res.status(409).json({
          error: `The time slot ${preferred_time} on ${date} is already booked. Please choose a different time.`
        });
      }

      // 4. Shop hours check (2:00 PM to 12:00 AM translates to 14:00 to 00:00)
      const [eh, em] = preferred_time.split(':').map(Number);
      const [oh, om] = settings.shop_open_time.split(':').map(Number);
      const [ch, cm] = settings.shop_close_time.split(':').map(Number);

      const eventMin = eh * 60 + em;
      const openMin = oh * 60 + om;
      let closeMin = ch * 60 + cm;

      if (closeMin <= openMin) {
        // e.g. close is 12:00 AM (00:00) which is next calendar day compared to 2:00 PM (14:00)
        closeMin += 24 * 60;
      }

      let checkEventMin = eventMin;
      // If closing time is past midnight (next day), and event hour is early morning (e.g. 12:00 am), adjust event time scale
      if (eh < oh && ch <= oh) {
        checkEventMin += 24 * 60;
      }

      if (checkEventMin < openMin || checkEventMin > closeMin) {
        // format nicely for output
        const fmtOpen = oh >= 12 ? `${oh % 12 || 12}:${String(om).padStart(2,'0')} PM` : `${oh}:${String(om).padStart(2,'0')} AM`;
        const fmtClose = ch >= 12 ? `${ch % 12 || 12}:${String(cm).padStart(2,'0')} PM` : `${ch || 12}:${String(cm).padStart(2,'0')} AM`;
        return res.status(400).json({
          error: `Event start time must be within shop hours: ${fmtOpen} - ${fmtClose}`
        });
      }
    }

    const duration = req.body.duration_hours ? parseInt(req.body.duration_hours) : getEventDuration(preferred_time);

    const event = await Event.create({
      title,
      description,
      date,
      preferred_time:   preferred_time   || '',
      duration_hours:   duration,
      phone:            phone            || '',
      is_private:       is_private       === true || is_private === 'true',
      max_participants: proposedGuests,
      type:             req.body.type    || 'customer',
      host_name:        hostName,
      status:           req.body.type === 'shop' ? 'approved' : 'pending_approval',
      customer_id:      customer_id      || null
    });
    res.status(201).json({ message: 'Event request submitted successfully!', id: event.id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit event request' });
  }
});

// ── PATCH approve / reject an event ──────────────────────────────────────────
router.patch('/:id/status', async (req, res) => {
  const { status } = req.body;
  const cleanStatus = (status || '').toLowerCase().trim();
  const allowed = ['approved', 'rejected', 'pending_approval', 'upcoming'];
  if (!allowed.includes(cleanStatus))
    return res.status(400).json({ error: 'Invalid status value' });

  try {
    // On approval/rejection, reset notification flag so customer gets notified
    const updates = { status: cleanStatus, approval_notified: false };
    const event = await Event.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json({ message: `Event ${cleanStatus} successfully.` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update event status' });
  }
});

// ── DELETE an event ───────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const event = await Event.findByIdAndDelete(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json({ message: 'Event deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

module.exports = router;
