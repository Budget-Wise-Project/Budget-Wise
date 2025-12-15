import { Router } from 'express';
import { remindersData } from '../data/index.js';

const router = Router();

const ensureLoggedIn = (req, res, next) => {
  if (!req.session || !req.session.user) return res.redirect('/login');
  next();
};

// Create a manual reminder for a bill
router.post('/', ensureLoggedIn, async (req, res) => {
  try {
    const userId = req.session.user._id;
    const { billId, reminderDate, type = 'before' } = req.body;

    await remindersData.createReminder(userId, billId, reminderDate, type);
    res.redirect('/reminders');
  } catch (err) {
    console.error('Create reminder error:', err);
    res.status(500).render('reminders', { error: 'Could not create reminder.' });
  }
});

// List user reminders
router.get('/', ensureLoggedIn, async (req, res) => {
  try {
    const userId = req.session.user._id;
    await remindersData.syncRemindersForUser(userId, 3);
    const reminders = await remindersData.getDueRemindersForUserWithDetails(userId);

    res.render('reminders', {
      title: 'Reminders',
      reminders: reminders || [],
    });
  } catch (err) {
    console.error('List reminders error:', err);
    res.status(500).render('reminders', {
      title: 'Reminders',
      reminders: [],
      error: 'Unable to load reminders.',
    });
  }
});

router.post('/:id/ack', ensureLoggedIn, async (req, res) => {
  try {
    const reminderId = req.params.id;
    await remindersData.markManySent([reminderId]);
  } catch (err) {
    console.error('Acknowledge reminder error:', err);
  }
  res.redirect('/reminders');
});

export default router;
