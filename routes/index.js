import { Router } from "express";

import budgetRoutes from "./budgetRoutes.js";
import authRoutes from "./authRoutes.js";
import historyRoutes from "./historyRoutes.js";

import billsRoutes from "./bills.js";
import transactionsRoutes from "./transactions.js";

const router = Router();

router.use("/", budgetRoutes);          // home page
router.use("/", authRoutes);            // /login, /signup, /logout
router.use("/", historyRoutes);         // /history

router.use("/bills", billsRoutes);      // bills pages
router.use("/transactions", transactionsRoutes); // transactions pages

router.use("*", (req, res) => {
  res.status(404).send("Not found");
});

export default router;
