import { Router } from "express";
import budgetRoutes from "./budgetRoutes.js";
import authRoutes from "./authRoutes.js";
import historyRoutes from "./historyRoutes.js";

const router = Router();

// Public home page.
router.use("/", budgetRoutes);

// Auth routes: /signup, /login, /logout.
router.use("/", authRoutes);

// Authenticated views like bill history.
router.use("/", historyRoutes);

export default router;
