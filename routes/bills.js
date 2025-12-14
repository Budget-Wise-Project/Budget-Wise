//routes/bills.js

import { Router } from 'express';
import { getBillById, updateBill, addBill, getAllBills } from '../data/bills.js';

const router = Router();

router.get('/add', (req, res) => {
    res.render('addBill');
});

router.post('/add', async (req, res) => {
    const { serviceName, amount, dueDate, notes } = req.body;

    try {
        await addBill(serviceName, amount, dueDate, notes);
        res.redirect('/bills/list');
    } catch (e) {
        res.status(400).render('addBill', {
            error: e,
            serviceName,
            amount,
            dueDate,
            notes
        });
    }
});

router.get('/list', async (req, res) => {
    try {
        const bills = await getAllBills();
        res.render('billsList', { bills });
    } catch (e) {
        res.status(500).render('billsList', { error: e, bills: [] });
    }
});

router.get('/edit/:id', async (req, res) => {
    try {
        const bill = await getBillById(req.params.id);
        res.render('editBill', { bill });
    } catch (e) {
        res.status(404).render('editBill', { error: e });
    }
});

router.post('/edit/:id', async (req, res) => {
    const { serviceName, amount, dueDate, notes } = req.body;

    try {
        await updateBill(req.params.id, {
            serviceName,
            amount,
            dueDate,
            notes
        });

        res.redirect('/bills/list');
    } catch (e) {
        res.status(400).render('editBill', {
            error: e,
            bill: { _id: req.params.id, serviceName, amount, dueDate, notes }
        });
    }
});

export default router;
