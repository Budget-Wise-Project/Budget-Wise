// routes/authRoutes.js
import { Router } from "express";
import { createUser, authenticateUser } from "../data/users.js";

const router = Router();

const redirectIfLoggedIn = (req, res, next) => {
  if (req.session.user) {
    return res.redirect("/dashboard");
  }
  next();
};

router.get("/signup", redirectIfLoggedIn, (req, res) => {
  res.render("signup", {
    title: "Sign Up - BudgetWise",
  });
});

router.post("/signup", redirectIfLoggedIn, async (req, res) => {
  const { firstName, lastName, email, password } = req.body;

  try {
    const newUser = await createUser({ firstName, lastName, email, password });
    req.session.user = newUser;
    return res.redirect("/dashboard");
  } catch (error) {
    return res.status(400).render("signup", {
      title: "Sign Up - BudgetWise",
      error: error.message || "Unable to create account.",
      formData: { firstName, lastName, email },
    });
  }
});

router.get("/login", redirectIfLoggedIn, (req, res) => {
  res.render("login", {
    title: "Log In - BudgetWise",
  });
});

router.post("/login", redirectIfLoggedIn, async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await authenticateUser(email, password);
    req.session.user = user;
    return res.redirect("/dashboard");
  } catch (error) {
    return res.status(401).render("login", {
      title: "Log In - BudgetWise",
      error: error.message || "Invalid email or password.",
      formData: { email },
    });
  }
});

router.post("/logout", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/");
  }

  req.session.destroy(() => {
    res.clearCookie("BudgetWiseSession");
    res.redirect("/");
  });
});

export default router;
