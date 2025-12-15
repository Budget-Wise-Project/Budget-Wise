// routes/dashboard.js
import { Router } from "express";
import { budgetData, billsData, remindersData } from "../data/index.js";

const router = Router();

const ensureLoggedIn = (req, res, next) => {
  if (!req.session || !req.session.user) return res.redirect("/login");
  next();
};

router.get("/", ensureLoggedIn, async (req, res) => {
  const userId = req.session.user._id;

  try {
    // Budgets
    const rawBudgets = await budgetData.getBudgetsForUser(userId);

    const activeBudgets = rawBudgets.filter((b) => b.active !== true);

    //Show only active budgets
    const budgetSummaries = await Promise.all(
        activeBudgets.map(async (budget) => {
            const summary = await budgetData.calculateBudgetSummary(budget);
                
            return {
                ...summary,
                amountLimitFormatted: Number(summary.amountLimit || 0).toFixed(2),
                amountUsedFormatted: Number(summary.amountUsed || 0).toFixed(2),
                amountRemainingFormatted: Number(summary.amountRemaining || 0).toFixed(2),
                percentageUsedRounded: Math.round(Number(summary.percentageUsed || 0))
            };
        })
    );
    // Bills summary
    const bills = await billsData.getBillsForUser(userId);
    const utilitySummary = {
      paid: bills.filter((b) => b.status === "paid").length,
      due: bills.filter((b) => b.status === "due").length,
      upcoming: bills.filter((b) => b.status === "upcoming").length,
      overdue: bills.filter((b) => b.status === "overdue").length,
      total: bills.length,
    };

    // In-app reminders: due now and not yet sent
    const dueReminders =
      (await remindersData.getDueRemindersForUserWithDetails(userId)) || [];


    res.render("dashboard", {
      title: "BudgetWise Dashboard",
      budgetSummaries,
      utilitySummary,
      reminders: dueReminders, // pass to template
    });
  } catch (error) {
    res.status(500).render("dashboard", {
      title: "BudgetWise Dashboard",
      budgetSummaries: [],
      error: error.message || "Unable to load dashboard data.",
    });
  }
});

export default router;
