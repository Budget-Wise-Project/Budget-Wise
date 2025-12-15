// routes/dashboard.js
import { Router } from 'express';
import { budgetData, billsData } from '../data/index.js';

const router = Router();

const ensureLoggedIn = (req, res, next) => {
  if (!req.session || !req.session.user) return res.redirect('/login');
  next();
};

router.get('/', ensureLoggedIn, async (req, res) => {
  const userId = req.session.user._id;

  try {
    // Budgets
    const rawBudgets = await budgetData.getBudgetsForUser(userId);

    const activeBudgets = rawBudgets.filter((b) => b.active !== false);

    //Show only active budgets
    const budgetSummaries = await Promise.all(
      activeBudgets.map(async (budget) => {
        const summary = await budgetData.calculateBudgetSummary(budget);

        return {
          ...summary,
          amountLimitFormatted: Number(summary.amountLimit || 0).toFixed(2),
          amountUsedFormatted: Number(summary.amountUsed || 0).toFixed(2),
          amountRemainingFormatted: Number(summary.amountRemaining || 0).toFixed(2),
          percentageUsedRounded: Math.round(Number(summary.percentageUsed || 0)),
        };
      })
    );
    // Bills summary
    const bills = await billsData.getBillsForUser(userId);
    const utilitySummary = {
      paid: bills.filter((b) => b.status === 'paid').length,
      due: bills.filter((b) => b.status === 'due').length,
      upcoming: bills.filter((b) => b.status === 'upcoming').length,
      overdue: bills.filter((b) => b.status === 'overdue').length,
      total: bills.length,
    };

    // Show lists of overdue bills and upcoming bills within the next 3 days
    const overdueBills = await billsData.getBillsHistoryForUser(userId, {
      status: 'overdue',
    });

    const now = new Date();
    const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startDate = new Date(todayMid);
    startDate.setDate(startDate.getDate() + 1);
    const endDate = new Date(todayMid);
    endDate.setDate(endDate.getDate() + 4);

    const upcomingBills = await billsData.getBillsHistoryForUser(userId, {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      status: 'upcoming',
    });

    res.render('dashboard', {
      title: 'BudgetWise Dashboard',
      budgetSummaries,
      utilitySummary,
      overdueBills,
      upcomingBills,
    });
  } catch (error) {
    res.status(500).render('dashboard', {
      title: 'BudgetWise Dashboard',
      budgetSummaries: [],
      error: error.message || 'Unable to load dashboard data.',
    });
  }
});

export default router;
