import { Router } from "express";
import { budgetData } from "../data/index.js";
//import { billsData } from "../data/index.js"; -- KV

const router = Router();

const ensureLoggedIn = (req, res, next) => {
    if (!req.session ||!req.session.user) {
        return res.redirect('/login');
    }
    next();
};

//GET dashboard

router.get("/", ensureLoggedIn, async (req, res) => {
    const userId = req.session.user._id;

    try {
        
        const rawBudgets = await budgetData.getBudgetsForUser(userId);

        const budgetSummaries = await Promise.all(
            rawBudgets.map(budgetData.calculateBudgetSummary)
        );

        // NR's feature for utilitySummary

        res.render("dashboard", {
            title: "BudgetWise Dashboard",
            budgetSummaries, 
            //utilitySumary: utilitySummary || {}
        });
    } catch (error) {
        res.status(500).render("dashboard", {
            title: "BudgetWise Dashboard",
            budgetSummaries: [],
            error: error.message || "Unable to load dashboard data."
        });
    }
});

export default router;