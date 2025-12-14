// Routes for managing the transactions

import { Router } from 'express';
import transactionsData from '../data/transactions.js';

const router = Router();

router.get('/', async (req, res) => {
    try {
        const transactions = await transactionsData.getAllTransactions();
        res.render('transactions', { transactions });
    } catch (e) {
        res.status(500).render('transactions', { error: e });
    }
});

router.post('/', async (req, res) => {
    const { title, amount, category, date, notes } = req.body;

    try {
        await transactionsData.addTransaction(title, amount, category, date, notes);
        res.redirect('/transactions');
    } catch (e) {
        let transactions = [];
        try {
            transactions = await transactionsData.getAllTransactions();
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
        const trans = await transactionsData.getTransactionById(req.params.id);
        res.render('editTransaction', { trans });
    } catch (e) {
        res.status(404).render('editTransaction', { error: e });
    }
});

router.post('/edit/:id', async (req, res) => {
    const { title, amount, category, date, notes } = req.body;

    try {
        await transactionsData.updateTransaction(req.params.id, {
            title,
            amount,
            category,
            date,
            notes
        });

        res.redirect('/transactions');
    } catch (e) {
        res.status(400).render('editTransaction', {
            error: e,
            trans: { _id: req.params.id, title, amount, category, date, notes }
        });
    }
});

router.post('/delete/:id', async (req, res) => {
    try {
        await transactionsData.deleteTransaction(req.params.id);
        res.redirect('/transactions');
    } catch (e) {
        res.status(500).render('error', { error: e });
    }
});

export default router;
