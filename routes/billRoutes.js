import { Router } from 'express';
import dayjs from 'dayjs';
import { billsData, utilitiesData, remindersData } from '../data/index.js';

const router = Router();

const ensureLoggedIn = (req, res, next) => {
  if (!req.session || !req.session.user) return res.redirect('/login');
  next();
};

// List all bills for current user
router.get('/', ensureLoggedIn, async (req, res) => {
  try {
    const userId = req.session.user._id;
    const bills = await billsData.getBillsForUser(userId);
    res.render('bills/list', { title: 'My Bills', bills });
  } catch (err) {
    res.status(500).render('bills/list', {
      title: 'My Bills',
      bills: [],
      error: err.message,
    });
  }
});

// Create form
router.get('/create', ensureLoggedIn, (req, res) => {
  res.render('bills/form', {
    title: 'Add Bill',
    action: '/bills',
    method: 'POST',
    bill: {},
  });
});

// Create bill manually
router.post('/', ensureLoggedIn, async (req, res) => {
  try {
    const userId = req.session.user._id;
    const { utilityId, dueDate, amount, notes } = req.body;

    // If a utilityId was provided, ensure the utility is active
    if (utilityId) {
      const util = await utilitiesData.getUtilityById(utilityId);
      if (!util) throw new Error('Utility not found');
      if (!util.active) throw new Error('Cannot add a bill to an inactive utility');
    }
    const due = dayjs(dueDate).startOf('day');
    const today = dayjs().startOf('day');
    let status = 'upcoming';
    if (due.isBefore(today)) status = 'overdue';
    else if (due.isSame(today)) status = 'due';

    const bill = await billsData.createBill(
      userId,
      utilityId,
      due.toDate(),
      Number(amount),
      status,
      notes
    );
    await remindersData.createBillReminders(userId, bill, 3); // 3 days before + on due date
    res.redirect('/bills');
  } catch (err) {
    res.status(400).render('bills/form', {
      title: 'Add Bill',
      action: '/bills',
      method: 'POST',
      bill: req.body,
      error: '⚠️ Could not create bill: ' + err.message,
    });
  }
});

// Create bill from utility (auto dueDate)
router.post('/from-utility/:utilityId', ensureLoggedIn, async (req, res) => {
  try {
    const userId = req.session.user._id;
    const utilityId = req.params.utilityId;
    const { amount, notes, dueDate } = req.body;

    const utility = await utilitiesData.getUtilityById(utilityId);
    if (!utility) throw new Error('Utility not found');
    if (!utility.active) throw new Error('Cannot add a bill to an inactive utility');

    let due;
    if (dueDate) {
      due = dayjs(dueDate).startOf('day');
    } else {
      if (!utility.defaultDay) throw new Error('Utility has no defaultDay');
      due = dayjs().date(utility.defaultDay).startOf('day');
    }

    const today = dayjs().startOf('day');
    let status = 'upcoming';
    if (due.isBefore(today)) status = 'overdue';
    else if (due.isSame(today)) status = 'due';

    const bill = await billsData.createBill(
      userId,
      utilityId,
      due.toDate(),
      Number(amount),
      status,
      notes
    );

    await remindersData.createBillReminders(userId, bill, 3);

    res.redirect(`/utilities/${utilityId}/bills`);
  } catch (err) {
    res.status(400).render('utilities', {
      title: 'Utilities',
      utilities: [],
      error: '⚠️ Could not create bill: ' + err.message,
    });
  }
});

// Edit form
router.get('/:id/edit', ensureLoggedIn, async (req, res) => {
  try {
    const bill = await billsData.getBillById(req.params.id);
    res.render('bills/form', {
      title: 'Edit Bill',
      action: `/bills/${req.params.id}`,
      method: 'POST',
      bill,
    });
  } catch {
    res.redirect('/bills');
  }
});

// Update bill
router.post('/:id', ensureLoggedIn, async (req, res) => {
  try {
    const updates = {
      dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null,
      amount: req.body.amount ? Number(req.body.amount) : 0,
      status: req.body.status,
      paidDate: req.body.paidDate ? new Date(req.body.paidDate) : null,
      notes: req.body.notes,
    };

    const updatedBill = await billsData.updateBill(req.params.id, updates);

    try {
      await remindersData.replaceRemindersForBill(req.session.user._id, updatedBill, 3);
    } catch (remErr) {
      console.error('Failed to update reminders for bill:', remErr);
    }

    res.redirect('/bills');
  } catch (err) {
    res.status(400).render('bills/form', {
      title: 'Edit Bill',
      action: `/bills/${req.params.id}`,
      method: 'POST',
      bill: { ...req.body, _id: req.params.id },
      error: err.message,
    });
  }
});

// Delete bill
router.post('/:id/delete', ensureLoggedIn, async (req, res) => {
  let bill = null;
  try {
    bill = await billsData.getBillById(req.params.id);
    const earliest = await billsData.getEarliestBillForUtility(bill.utilityId);
    if (String(earliest) === String(bill._id)) {
      throw new Error('Cannot delete the initial auto-generated bill for this utility');
    }
    await billsData.deleteBill(req.params.id);
  } catch (err) {
    // Ignore errors on delete but keep bill if available for redirect
    console.warn('Bill delete warning:', err?.message || err);
  }
  // Redirect back to the utility's bills page when possible, otherwise fall back to /bills
  if (bill && bill.utilityId) {
    return res.redirect(`/utilities/${bill.utilityId}/bills`);
  }
  return res.redirect('/bills');
});

// Mark bill as paid
router.post('/:id/mark-paid', ensureLoggedIn, async (req, res) => {
  try {
    const bill = await billsData.getBillById(req.params.id);
    await billsData.updateBill(req.params.id, {
      status: 'paid',
      paidDate: new Date(),
    });
    try {
      await remindersData.markRemindersForBillSent(req.params.id);
    } catch (remErr) {
      console.error('Failed to mark reminders sent for bill:', remErr);
    }
    res.redirect(`/utilities/${bill.utilityId}/bills`);
  } catch (err) {
    console.error(err);
    res.redirect('/bills');
  }
});

router.get('/:id/bills', ensureLoggedIn, async (req, res) => {
  try {
    const userId = req.session.user._id;
    const utilityId = req.params.id;

    const utility = await utilitiesData.getUtilityById(utilityId);
    const utilityActive = Boolean(utility && utility.active);

    let bills = await billsData.getBillsForUtility(userId, utilityId);

    const earliestBillId = await billsData.getEarliestBillForUtility(utilityId);

    bills = bills.map((b) => {
      const today = new Date();
      const todayMidnight = new Date(today.setHours(0, 0, 0, 0));
      const dueMidnight = new Date(new Date(b.dueDate).setHours(0, 0, 0, 0));

      let status = 'upcoming';
      if (dueMidnight < todayMidnight) status = 'overdue';
      else if (dueMidnight.getTime() === todayMidnight.getTime()) status = 'due';

      return {
        ...b,
        status,
        showMarkPaid: status !== 'paid',
        dueDateFormatted: b.dueDate
          ? new Date(b.dueDate).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })
          : '',
        amountFormatted: (Number(b.amount) || 0).toFixed(2),
        canDelete: String(b._id) !== String(earliestBillId),
      };
    });

    res.render('bills/list', {
      title: 'Bills for Utility',
      bills,
      utilityId,
      utilityActive,
      earliestBillId,
    });
  } catch (err) {
    res.status(500).render('utilities', {
      title: 'Utilities',
      utilities: [],
      error: 'Error loading bills: ' + err.message,
    });
  }
});

export default router;
