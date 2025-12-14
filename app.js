// app.js
import express from "express";
import exphbs from "express-handlebars";
import session from "express-session";

import indexRoutes from "./routes/index.js";

const app = express();
const PORT = 3000;

const hbs = exphbs.create({
  defaultLayout: "main",
  helpers: {
    eq: (a, b) => a === b,
    formatDate: (date) => {
      if (!date) return "";
      return new Date(date).toLocaleDateString("en-US");
    },
    formatMoney: (amount) => {
      if (amount === undefined || amount === null || isNaN(amount)) return "";
      return Number(amount).toFixed(2);
    },
    calcPercent: (count, total) => {
      if (!total || total === 0) return 0;
      return Math.round((count / total) * 100);
    },
  },
});

app.engine("handlebars", hbs.engine);
app.set("view engine", "handlebars");


const rewriteUnsupportedBrowserMethods = (req, res, next) => {
  if (req.body && req.body._method) {
    req.method = req.body._method;
    delete req.body._method;
  }
  next();
};

app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(rewriteUnsupportedBrowserMethods);

app.use(
  session({
    name: "BudgetWiseSession",
    secret: "super-secret-string-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24, // 1 day
    },
  })
);

app.use((req, res, next) => {
  res.locals.user = req.session.user;
  next();
});

// Use consolidated routes router
app.use("/", indexRoutes);

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
