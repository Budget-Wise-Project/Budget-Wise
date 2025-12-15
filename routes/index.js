import { Router } from "express";
import homeRoutes from "./budgetRoutes.js";
import authRoutes from "./authRoutes.js";
import historyRoutes from "./historyRoutes.js";
import dashboardRoutes from "./dashboardRoutes.js";
import budgetFeatureRoutes from "./budgets.js";
import utilitiesRoutes from "./utilitiesRoutes.js";
import billsRoutes from "./billRoutes.js";
import transactionsRoutes from "./transactions.js";
import remindersRoutes from "./remindersRoutes.js";

const router = Router();

//Homepage
router.use("/", homeRoutes);

//Auth routes: /signup, /login, /logout/
router.use("/", authRoutes);

//Authenticated views like bill history
router.use("/", historyRoutes);

//Budget feature
router.use("/budgets", budgetFeatureRoutes);

// Dashboard
router.use("/dashboard", dashboardRoutes);

// Utilities feature
router.use("/utilities", utilitiesRoutes);

// Bills feature
router.use("/bills", billsRoutes);

// Transactions feature
router.use("/transactions", transactionsRoutes); // transactions pages

router.use("/reminders", remindersRoutes);

//404 handler (no path so it acts as a catch-all middleware)
router.use((req, res) => {
  return res.status(404).render("error", {
    title: "Not Found",
    error: "This page does not exist.",
  });
});

export default router;
