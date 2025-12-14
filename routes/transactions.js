// Routes for managing the transactions

import { Router } from 'express';
import transactionsData from '../data/transactions.js';

const router = Router();

router.get('/', async (req, res) => {
    try {
        if (!req.session.user) return res.redirect('/login');

        const userId = req.session.user._id;
        const transactions = await transactionsData.getAllTransactions(userId);
        res.render('transactions', { transactions });
    } catch (e) {
        res.status(500).render('transactions', { error: e });
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
     
        }

        res.status(400).render('transactions', {
            error: e,
            transactions
        });
    }
});

router.get('/edit/:id', async (req, res) => {
    try {
        if (!req.session.user) return res.redirect('/login');

        const userId = req.session.user._id;
        const trans = await transactionsData.getTransactionById(req.params.id, userId);
        res.render('editTransaction', { trans });
    } catch (e) {
        res.status(404).render('editTransaction', { error: e });
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
            notes
        });

        res.redirect('/transactions');
    } catch (e) {
        res.status(400).render('editTransaction', {
            error: e,
            trans: { _id: req.params.id, title, amount, category, type, date, notes }
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
