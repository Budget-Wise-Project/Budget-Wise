import { Router } from 'express';
import { budgetData } from '../data/index.js';

const router = Router();

const ensureLoggedIn = (req, res, next) => {
    if (!req.session || !req.session.user) {
        return res.redirect('/login');
    }
    next();
};

const CATEGORY_OPTIONS = ['Food', 'Housing', 'Utilities', 'Entertainment', 'Other'];

//GET - show list of current budgets + form to add a new one
router.get('/', ensureLoggedIn, async (req, res) => {
    try {
        const userId = req.session.user._id;

        //Fetch budgets for the user. 
        const userBudgets = await budgetData.getBudgetsForUser(userId);

        return res.render('budget', {
            title: 'Manage Budgets',
            budgets: userBudgets,
            categories: CATEGORY_OPTIONS,
            error: null
        });
    } catch (e) {
        return res.status(500).render('budget', {
            title: 'Manage Budgets',
            budgets: [],
            categories: CATEGORY_OPTIONS,
            error: e.message
        });
    }
});

//POST - create a new budget
router.post('/', ensureLoggedIn, async (req, res) => {
  const userId = req.session.user._id;
  const { category, amountLimit, startDate, endDate } = req.body;
    const isAjax = req.xhr || (req.headers.accept && req.headers.accept.indexOf('application/json') !== -1);

  try {
        if (!category || !amountLimit || !startDate || !endDate) {
            const errMsg = 'All budget fields (category, amount, dates) are required.';
            if (isAjax) {
                return res.status(400).json({ success: false, error: errMsg });
            }

            const userBudgets = await budgetData.getBudgetsForUser(userId);
            return res.status(400).render('budget', {
                    title: 'Manage Budgets',
                    budgets: userBudgets,
                    categories: CATEGORY_OPTIONS,
                    error: errMsg
             });
        }

        const newBudget = await budgetData.createBudget({
                userId,
                category,
                amountLimit: Number(amountLimit),
                startDate,
                endDate 
        });

        if (isAjax) {
            return res.json({ success: true, budget: newBudget });
        }

        return res.redirect('/budgets');
} catch (e) {
    let userBudgets = [];
    try {
        userBudgets = await budgetData.getBudgetsForUser(userId);
    } catch { }
        const errMsg = e.message || "Could not save the new budget.";
        if (isAjax) {
            return res.status(500).json({ success: false, error: errMsg });
        }

        return res.status(500).render('budget', {
                title: 'Manage Budgets',
                budgets: userBudgets,
                categories: CATEGORY_OPTIONS,
                error: errMsg
            });
    } 
});


//POST /delete - a specific budget
router.post('/delete', ensureLoggedIn, async (req, res) => {
    const { budgetId } = req.body;

    try {
        const success = await budgetData.deleteBudgetById(budgetId);
            budgetId = validateId(budgetId, 'budgetId');

        if (!success) {
            return res.redirect(
                '/budgets?error=' + encodeURIComponent('Budget not found')
            );
        }

        return res.redirect(
            '/budgets?message=' + encodeURIComponent ('Budget deleted successfully')
        );
    } catch (e) {
        return res.redirect(
            '/budgets?error=' + encodeURIComponent(e.message || 'Failed to delete budget')
        );
    }
});

export default router;