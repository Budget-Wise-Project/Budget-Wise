import { Router } from "express";
import { remindersData } from "../data/index.js";

const router = Router();

const ensureLoggedIn = (req, res, next) => {
  if (!req.session || !req.session.user) return res.redirect("/login");
  next();
};

// Create a manual reminder for a bill
router.post("/", ensureLoggedIn, async (req, res) => {
  try {
    const userId = req.session.user._id;
    const { billId, reminderDate, type = "before" } = req.body;

    const reminder = await remindersData.createReminder(userId, billId, reminderDate, type);
    res.redirect("/dashboard"); // or /reminders
  } catch (err) {
    console.error("Create reminder error:", err);
    res.status(500).render("dashboard", { error: "Could not create reminder." });
  }
});

// List user reminders
router.get("/", ensureLoggedIn, async (req, res) => {
  try {
    const userId = req.session.user._id;
    const reminders = await remindersData.getRemindersForUser(userId);

    res.render("reminders", {
      title: "Reminders",
      reminders
    });
  } catch (err) {
    console.error("List reminders error:", err);
    res.status(500).render("reminders", { title: "Reminders", reminders: [], error: "Unable to load reminders." });
  }
});

export default router;
