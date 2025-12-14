// routes/utilities.js
import { Router } from 'express';
import dayjs from 'dayjs';
import { utilitiesData, billsData } from '../data/index.js';

const router = Router();

const ensureLoggedIn = (req, res, next) => {
  if (!req.session || !req.session.user) return res.redirect('/login');
  next();
};

// List utilities
router.get('/', ensureLoggedIn, async (req, res) => {
  const userId = req.session.user._id;
  try {
    let utilities = await utilitiesData.getUtilitiesForUser(userId);

    utilities = utilities.map(u => ({
      ...u,
      defaultDayFormatted: u.defaultDay ? u.defaultDay.toString() : null,
      defaultAmount: u.defaultAmount ? u.defaultAmount.toFixed(2) : '0.00'
    }));

    res.render('utilities', { title: 'Utilities', utilities });
  } catch (err) {
    res.status(500).render('utilities', {
      title: 'Utilities',
      utilities: [],
      error: err.message
    });
  }
});

// Create form
router.get('/create', ensureLoggedIn, (req, res) => {
  res.render('utilities/form', {
    title: 'Add Utility',
    action: '/utilities',
    method: 'POST',
    utility: {}
  });
});

// Create utility + initial bill
router.post('/', ensureLoggedIn, async (req, res) => {
  try {
    const userId = req.session.user._id;
    const { provider, accountNumber, defaultDay, defaultAmount, notes, active } = req.body;

    const utility = await utilitiesData.createUtility(
      userId,
      provider,
      accountNumber,
      defaultDay ? parseInt(defaultDay, 10) : null,
      Number(defaultAmount),
      notes,
      active === 'on'
    );

    // Build due date for this month
    const dueDate = dayjs().date(parseInt(defaultDay, 10));
    const today = dayjs().startOf('day');

    let status = 'upcoming';
    if (dueDate.isBefore(today)) status = 'overdue';
    else if (dueDate.isSame(today)) status = 'due';

    await billsData.createBill(
      userId,
      utility._id,
      dueDate.toDate(),
      Number(defaultAmount),
      status,
      notes
    );

    res.redirect('/utilities');
  } catch (err) {
    res.status(400).render('utilities/form', {
      title: 'Add Utility',
      action: '/utilities',
      method: 'POST',
      utility: req.body,
      error: '⚠️ Could not create utility: ' + err.message
    });
  }
});

// Edit form
router.get('/:id/edit', ensureLoggedIn, async (req, res) => {
  try {
    const util = await utilitiesData.getUtilityById(req.params.id);
    res.render('utilities/form', {
      title: 'Edit Utility',
      action: `/utilities/${req.params.id}`,
      method: 'POST',
      utility: util
    });
  } catch {
    res.redirect('/utilities');
  }
});

// Update utility + sync current bill
router.post('/:id', ensureLoggedIn, async (req, res) => {
  try {
    const updates = {
      provider: req.body.provider,
      accountNumber: req.body.accountNumber,
      defaultDay: req.body.defaultDay ? parseInt(req.body.defaultDay, 10) : null,
      defaultAmount: req.body.defaultAmount ? Number(req.body.defaultAmount) : 0,
      notes: req.body.notes,
      active: req.body.active === 'on'
    };

    await utilitiesData.updateUtility(req.params.id, updates);
    await billsData.updateCurrentBillForUtility(req.params.id, updates);

    res.redirect('/utilities');
  } catch (err) {
    res.status(400).render('utilities/form', {
      title: 'Edit Utility',
      action: `/utilities/${req.params.id}`,
      method: 'POST',
      utility: { ...req.body, _id: req.params.id },
      error: err.message
    });
  }
});

// ===== View bills for a utility =====
router.get('/:id/bills', ensureLoggedIn, async (req, res) => {
  try {
    const userId = req.session.user._id;
    const utilityId = req.params.id;

    let bills = await billsData.getBillsForUtility(userId, utilityId);

    // Add the new mapping logic here
    bills = bills.map(b => {
      let status = b.status; // keep DB status if it's "paid"

      if (status !== 'paid') {
        const today = new Date();
        const todayMidnight = new Date(today.setHours(0, 0, 0, 0));
        const dueMidnight = new Date(new Date(b.dueDate).setHours(0, 0, 0, 0));

        if (dueMidnight < todayMidnight) status = 'overdue';
        else if (dueMidnight.getTime() === todayMidnight.getTime()) status = 'due';
        else status = 'upcoming';
      }

      return {
        ...b,
        status,
        showMarkPaid: status !== 'paid',
        dueDateFormatted: b.dueDate
          ? new Date(b.dueDate).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })
          : '',
        amountFormatted: (Number(b.amount) || 0).toFixed(2)
      };
    });

    res.render('bills/list', { title: 'Bills for Utility', bills, utilityId });
  } catch (err) {
    res.status(500).render('utilities', {
      title: 'Utilities',
      utilities: [],
      error: 'Error loading bills: ' + err.message
    });
  }
});

// Delete utility + its bills
router.post('/:id/delete', ensureLoggedIn, async (req, res) => {
  try {
    const utilityId = req.params.id;

    // delete the utility
    await utilitiesData.deleteUtility(utilityId);

    // delete all bills linked to this utility
    await billsData.deleteBillsByUtilityId(utilityId);

  } catch (err) {
    console.error('Error deleting utility and bills:', err);
  }
  res.redirect('/utilities');
});


// Toggle active
router.post('/:id/toggle', ensureLoggedIn, async (req, res) => {
  try {
    await utilitiesData.toggleUtilityActive(req.params.id);
  } catch {
    // ignore
  }
  res.redirect('/utilities');
});

export default router;
