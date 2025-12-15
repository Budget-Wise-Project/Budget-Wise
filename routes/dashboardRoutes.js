// routes/dashboard.js
import { Router } from "express";
import { budgetData, billsData, remindersData, utilitiesData } from "../data/index.js";

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
    const budgetSummaries = await Promise.all(
      rawBudgets.map(budgetData.calculateBudgetSummary)
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

    const dueReminders = [];

    // Show lists of overdue bills and upcoming bills within the next 3 days
    const overdueBills = await billsData.getBillsHistoryForUser(userId, {
      status: "overdue",
    });

    // Compute date window: tomorrow (inclusive) up to 3 days ahead (inclusive)
    const now = new Date();
    const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startDate = new Date(todayMid);
    startDate.setDate(startDate.getDate() + 1); // tomorrow
    const endDate = new Date(todayMid);
    endDate.setDate(endDate.getDate() + 4); // exclusive end (day after 3-day window)

    const upcomingBills = await billsData.getBillsHistoryForUser(userId, {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      status: "upcoming",
    });


    res.render("dashboard", {
      title: "BudgetWise Dashboard",
      budgetSummaries,
      utilitySummary,
      overdueBills,
      upcomingBills,
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
