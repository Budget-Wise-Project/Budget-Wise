// Routes for managing the transactions

import { Router } from 'express';
import transactionsData from '../data/transactions.js';
import { budgets } from '../config/mongoCollections.js';
import { ObjectId } from 'mongodb';

const router = Router();

router.get('/', async (req, res) => {
  try {
    if (!req.session.user) return res.redirect('/login');

    const userId = req.session.user._id;
    const transactions = await transactionsData.getAllTransactions(userId);

    // Resolve linked budgets for transactions that have a budgetId
    const budgetMap = {};
    try {
      const budgetIds = [
        ...new Set(
          transactions
            .filter((t) => t && t.budgetId)
            .map((t) =>
              t.budgetId && typeof t.budgetId === 'object' ? String(t.budgetId) : t.budgetId
            )
        ),
      ].filter(Boolean);

      if (budgetIds.length > 0) {
        const budgetsCollection = await budgets();
        const objs = budgetIds.map((id) => new ObjectId(id));
        const found = await budgetsCollection.find({ _id: { $in: objs } }).toArray();
        found.forEach((b) => {
          budgetMap[String(b._id)] = b;
        });
      }
    } catch (e) {
      console.warn('Failed to resolve budgets for transactions:', e?.message || e);
    }

    const formattedTransactions = transactions.map((t) => ({
      ...t,
      dateFormatted: t.date ? new Date(t.date).toLocaleDateString('en-US') : '',
      budget: t.budgetId ? budgetMap[String(t.budgetId)] || null : null,
    }));

    res.render('transactions', { transactions: formattedTransactions });
  } catch (e) {
    res.status(500).render('transactions', { error: e.message || String(e), transactions: [] });
  }
});

router.post('/', async (req, res) => {
  const { title, amount, category, type, date, notes } = req.body;

  try {
    if (!req.session.user) return res.redirect('/login');

    const userId = req.session.user._id;

    let name = 'Unknown';
    if (req.session.user.firstName && req.session.user.lastName) {
      name = `${req.session.user.firstName} ${req.session.user.lastName}`;
    } else if (req.session.user.name) {
      name = req.session.user.name;
    }

    await transactionsData.addTransaction(userId, name, title, amount, category, type, date, notes);
    res.redirect('/transactions');
  } catch (e) {
    let transactions = [];
    try {
      if (req.session.user) {
        const userId = req.session.user._id;
        transactions = await transactionsData.getAllTransactions(userId);
      }
    } catch (err) {
      console.error('Error fetching transactions for user in error handler:', err);
    }

    const formattedTransactions = transactions.map((t) => ({
      ...t,
      dateFormatted: t.date ? new Date(t.date).toLocaleDateString('en-US') : '',
    }));

    res.status(400).render('transactions', {
      error: e.message || String(e),
      transactions: formattedTransactions,
    });
  }
});

router.get('/edit/:id', async (req, res) => {
  try {
    if (!req.session.user) return res.redirect('/login');

    const userId = req.session.user._id;
    const trans = await transactionsData.getTransactionById(req.params.id, userId);
    // Format date for date input (YYYY-MM-DD)
    if (trans && trans.date) {
      try {
        trans.date = new Date(trans.date).toISOString().slice(0, 10);
      } catch (e) {
        // leave as-is on error
      }
    }
    res.render('editTransaction', { trans });
  } catch (e) {
    res.status(404).render('editTransaction', { error: e && e.message ? e.message : String(e) });
  }
});

router.post('/edit/:id', async (req, res) => {
  const { title, amount, category, type, date, notes } = req.body;

  try {
    if (!req.session.user) return res.redirect('/login');

    const userId = req.session.user._id;

    await transactionsData.updateTransaction(req.params.id, userId, {
      title,
      amount,
      category,
      type,
      date,
      notes,
    });

    res.redirect('/transactions');
  } catch (e) {
    // Normalize error and date for re-render
    console.error('Error updating transaction:', e);
    const errorMessage = e && e.message ? e.message : String(e);
    let formattedDate = '';
    if (date) {
      try {
        formattedDate =
          typeof date === 'string' && date.indexOf('T') !== -1 ? date.split('T')[0] : date;
      } catch (ex) {
        formattedDate = date;
      }
    }

    res.status(400).render('editTransaction', {
      error: errorMessage,
      trans: { _id: req.params.id, title, amount, category, type, date: formattedDate, notes },
    });
  }
});

router.post('/delete/:id', async (req, res) => {
  try {
    if (!req.session.user) return res.redirect('/login');

    const userId = req.session.user._id;

    await transactionsData.deleteTransaction(req.params.id, userId);
    res.redirect('/transactions');
  } catch (e) {
    res.status(500).render('error', { error: e });
  }
});

export default router;
