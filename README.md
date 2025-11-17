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

**Development & Contribution**

- To make changes, create a feature branch and open a pull request (PR) when your changes are ready for review.
- Commit locally with a clear, descriptive message and push your branch to the remote repository:

```bash
# stage your changes
git add <files>
# commit with a short, descriptive message
git commit -m "Short, descriptive message about your change"
# push the branch (replace <branch-name> with your branch)
git push origin <branch-name>
```

- Open a PR from your branch and request reviews. Follow project guidelines for reviews and merging.
 
