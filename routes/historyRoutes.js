import { Router } from "express";
import { getBillsHistoryForUser } from "../data/bills.js";

const router = Router();

const ensureLoggedIn = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }
  next();
};

const parseMonthFilter = (monthValue) => {
  if (!monthValue) return {};
  const [yearStr, monthStr] = monthValue.split("-");
  const year = Number.parseInt(yearStr, 10);
  const monthIndex = Number.parseInt(monthStr, 10) - 1; // JS months are 0-based.
  if (Number.isNaN(year) || Number.isNaN(monthIndex)) return {};
  const startDate = new Date(year, monthIndex, 1);
  const endDate = new Date(year, monthIndex + 1, 1);
  return { startDate, endDate };
};

router.get("/history", ensureLoggedIn, async (req, res) => {
  const { month, status, search } = req.query;

  const { startDate, endDate } = parseMonthFilter(month);

  try {
    const bills = await getBillsHistoryForUser(req.session.user._id, {
      startDate,
      endDate,
      status,
      searchTerm: search,
    });

    res.render("history", {
      title: "Bill History - BudgetWise",
      bills,
      filters: {
        month: month || "",
        status: status || "",
        search: search || "",
      },
    });
  } catch (error) {
    res.status(500).render("history", {
      title: "Bill History - BudgetWise",
      error: error.message || "Unable to load history.",
      bills: [],
      filters: {
        month: month || "",
        status: status || "",
        search: search || "",
      },
    });
  }
});

export default router;
