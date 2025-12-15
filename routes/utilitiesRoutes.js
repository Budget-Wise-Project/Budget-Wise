// routes/utilities.js
import { Router } from 'express';
import dayjs from 'dayjs';
import { utilitiesData, billsData, remindersData } from '../data/index.js';

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
  const isAjax = req.xhr || (req.headers.accept && req.headers.accept.indexOf('application/json') !== -1);
  try {
    const userId = req.session.user._id;
    const { provider, accountNumber, defaultDay, defaultAmount } = req.body;

    // Always create utilities as active by default; ignore any 'notes' provided from the add-utility UI.
    const { utility, autoBill } = await utilitiesData.createUtility(
      userId,
      provider,
      accountNumber,
      defaultDay ? parseInt(defaultDay, 10) : null,
      Number(defaultAmount),
      "",
      true
    );

    // If an auto-generated bill was created, also create reminders for it
    if (autoBill) {
      try {
        await remindersData.createBillReminders(userId, autoBill, 3);
      } catch (remErr) {
        // don't fail utility creation for reminder issues; log if needed
        console.error('Failed creating reminders for auto bill:', remErr);
      }
    }

    // `createUtility` already auto-generates a current-month bill when appropriate.
    if (isAjax) {
      return res.json({ success: true, utility });
    }

    res.redirect('/utilities');
  } catch (err) {
    const errMsg = '⚠️ Could not create utility: ' + err.message;
    if (isAjax) {
      return res.status(400).json({ success: false, error: errMsg });
    }

    res.status(400).render('utilities/form', {
      title: 'Add Utility',
      action: '/utilities',
      method: 'POST',
      utility: req.body,
      error: errMsg
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

    // load utility to determine active status for the UI
    const utility = await utilitiesData.getUtilityById(utilityId);
    const utilityActive = Boolean(utility && utility.active);

    let bills = await billsData.getBillsForUtility(userId, utilityId);

    // determine earliest bill id so we can hide delete for it
    const earliestBillId = await billsData.getEarliestBillForUtility(utilityId);

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
        amountFormatted: (Number(b.amount) || 0).toFixed(2),
        canDelete: String(b._id) !== String(earliestBillId)
      };
    });
    res.render('bills/list', { title: 'Bills for Utility', bills, utilityId, utilityActive, earliestBillId });
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
