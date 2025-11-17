# BudgetWise

BudgetWise is a full-stack budgeting app that lets users record expenses, organize them by category, and view spending summaries. Users can record daily expenses, categorize them, and instantly see how much they’ve spent this month. The app provides an intuitive dashboard where users can set monthly budgets, track income versus expenses, and monitor their financial goals over time. A reminder feature notifies users of upcoming due dates so they stay on top of payments.

**Core Features**

- **User Authentication:** Users create an account and securely login/logout.
- **Dashboard:** Summary of all utilities, how many are paid, due, or upcoming. Allows the user to add a utility service with default due date, amount, and notes. Users can update bill details or edit the service defaults (due dates, amounts, etc.).
- **Reminders:** Send reminders before due dates and on the due date.
- **Add/Edit/Delete Transactions:** Record income or expense transactions (title, amount, category, date).
- **History & Search:** Show prior months' bills with filters for quick lookups. Search by provider, account number, or tags. Filter by month and status.

**How to Run Locally**

1. Clone the repository:

	```bash
	git clone <repo-url>
	cd Budget-Wise
	```

2. Install dependencies:

	```bash
	npm install
	```

3. Start the app:

	```bash
	npm start
	# or
	node app.js
	```

	The server runs by default on port `3000`. Open `http://localhost:3000` in a browser.

**Notes & Configuration**

- Views use `express-handlebars` and layouts are in `views/layouts`.
- Static assets are served from the `public/` folder (mounted at `/public`).
- If your app requires environment variables (e.g., database URLs, session secrets), create a `.env` file and load them before starting the server. Example variables are not required for the basic local run described above.

**Development & Contribution**

- To make changes, create a feature branch, then open a pull request.
- If you'd like, I can commit this README update for you. Run the commands below to commit locally:

```bash
git add README.md
git commit -m "Update README with project description and run instructions"
git push origin main
```
