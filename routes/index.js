import { Router } from 'express';
import homeRoutes from './budgetRoutes.js';
import authRoutes from './authRoutes.js';
import historyRoutes from './historyRoutes.js';
import budgetFeatureRoutes from './budgets.js';
import utilitiesRoutes from './utilities.js';

const router = Router();

//Homepage 
router.use('/', homeRoutes);

//Auth routes: /signup, /login, /logout/
router.use("/", authRoutes);

//Authenticated views like bill history
router.use("/", historyRoutes);

//Budget feature
router.use('/budgets', budgetFeatureRoutes);

// Utilities feature
router.use('/utilities', utilitiesRoutes);

//404 handler
router.use('*',(req, res) => {
    return res.status(404).render('error', {
        title: 'Not Found',
        error: 'This page does not exist.'
    });
});

export default router;
