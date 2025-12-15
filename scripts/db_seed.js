#!/usr/bin/env node
/*
  Clean db_seed.js
  - Single coherent seed script
  - Supports `--no-clear` and `--dry-run`
  - Deterministic/demo dataset (single demo user)
*/

import { dbConnection, closeConnection } from '../config/mongoConnection.js';
import { reminders as remindersColFn } from '../config/mongoCollections.js';
import { userData, billsData, utilitiesData, budgetData } from '../data/index.js';
import transactionsData from '../data/transactions.js';
import { ObjectId } from 'mongodb';

const argv = process.argv.slice(2);
const noClear = argv.includes('--no-clear');
const dryRun = argv.includes('--dry-run');

const collectionsToClear = ['users', 'transactions', 'utilities', 'bills', 'reminders', 'budgets'];

const clearCollections = async (db) => {
  for (const name of collectionsToClear) {
    try {
      await db.collection(name).deleteMany({});
      console.log(`Cleared collection: ${name}`);
    } catch (e) {
      console.warn(`Could not clear ${name}:`, e.message || e);
    }
  }
};

const run = async () => {
  let db;
  try {
    db = await dbConnection();
    console.log('Connected to DB:', db.databaseName || '(unknown)');

    if (!noClear) {
      if (dryRun) console.log('[dry-run] Skipping clear of collections');
      else await clearCollections(db);
    } else {
      console.log('--no-clear provided: skipping clearing collections');
    }

    // Demo user
    const demoUser = {
      firstName: 'Demo',
      lastName: 'User',
      email: 'demo@example.com',
      password: 'demo12345',
    };
    let createdUser;
    if (dryRun) {
      console.log('[dry-run] Would create user:', demoUser.email);
      createdUser = { _id: 'DRYRUN_USER_ID', ...demoUser };
    } else {
      createdUser = await userData.createUser(demoUser);
      console.log('Created user:', createdUser.email, createdUser._id);
    }

    // Utilities
    const utilitiesToCreate = [
      { provider: 'Electric Co', account: 'ELEC-1001', day: 20, amount: 120.0 },
      { provider: 'Water Works', account: 'WTR-2002', day: 15, amount: 40.0 },
      { provider: 'Internet LLC', account: 'INT-3003', day: 10, amount: 60.0 },
      { provider: 'StreamingPlus', account: 'STR-5005', day: 28, amount: 9.99 },
    ];

    const createdUtils = [];
    for (const u of utilitiesToCreate) {
      if (dryRun) {
        console.log(`[dry-run] Would create utility: ${u.provider}`);
        createdUtils.push({
          provider: u.provider,
          _id: `DRY_${u.provider}`,
          defaultDay: u.day,
          defaultAmount: u.amount,
        });
      } else {
        const res = await utilitiesData.createUtility(
          createdUser._id,
          u.provider,
          u.account,
          u.day,
          u.amount,
          `${u.provider} service`
        );
        createdUtils.push(res.utility);
        console.log('Created utility:', res.utility.provider, res.utility._id);
      }
    }

    // Bills: past and upcoming for each utility
    const now = new Date();
    const bills = [];
    for (const u of createdUtils) {
      const past = new Date(now.getFullYear(), now.getMonth() - 1, u.defaultDay || 15);
      const upcoming = new Date(now.getFullYear(), now.getMonth(), u.defaultDay || 15);
      if (dryRun) {
        bills.push({ _id: `DRY_PAST_${u.provider}`, dueDate: past });
        bills.push({ _id: `DRY_UP_${u.provider}`, dueDate: upcoming });
        console.log(`[dry-run] Would create past and upcoming bills for ${u.provider}`);
      } else {
        const b1 = await billsData.createBill(
          createdUser._id,
          u._id,
          past,
          u.defaultAmount,
          'paid',
          `Demo past bill for ${u.provider}`
        );
        const b2 = await billsData.createBill(
          createdUser._id,
          u._id,
          upcoming,
          u.defaultAmount,
          'upcoming',
          `Demo upcoming bill for ${u.provider}`
        );
        bills.push(b1, b2);
      }
    }

    // Budgets: create focused budgets for current month so transactions can link to them
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
    const budgetDefs = [
      { category: 'Food', amountLimit: 600 },
      { category: 'Utilities', amountLimit: 350 },
      { category: 'Entertainment', amountLimit: 150 },
      { category: 'Housing', amountLimit: 1200 },
      { category: 'Travel', amountLimit: 300 },
    ];
    const createdBudgets = [];
    for (const b of budgetDefs) {
      if (dryRun) {
        console.log(`[dry-run] Would create budget: ${b.category} $${b.amountLimit}`);
        createdBudgets.push({
          _id: `DRY_BUDGET_${b.category}`,
          ...b,
          startDate: start,
          endDate: end,
        });
      } else {
        const nb = await budgetData.createBudget({
          userId: createdUser._id,
          category: b.category,
          amountLimit: b.amountLimit,
          startDate: start,
          endDate: end,
          active: true,
        });
        createdBudgets.push(nb);
        console.log('Created budget:', nb.category, nb._id);
      }
    }

    // Transactions: deterministic small set using budget-aligned categories
    const transactions = [
      {
        name: 'Paycheck',
        title: 'Salary',
        amount: 2500,
        category: 'Other',
        type: 'Income',
        daysAgo: 2,
      },
      {
        name: 'Grocery',
        title: 'Supermarket',
        amount: 120.45,
        category: 'Food',
        type: 'Expense',
        daysAgo: 4,
      },
      {
        name: 'Cafe',
        title: 'Coffee',
        amount: 18.5,
        category: 'Food',
        type: 'Expense',
        daysAgo: 1,
      },
      {
        name: 'Movie Night',
        title: 'Cinema',
        amount: 45.0,
        category: 'Entertainment',
        type: 'Expense',
        daysAgo: 7,
      },
      {
        name: 'Taxi',
        title: 'Ride',
        amount: 18.25,
        category: 'Travel',
        type: 'Expense',
        daysAgo: 3,
      },
    ];

    for (const t of transactions) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - t.daysAgo);
      if (dryRun) {
        console.log(
          '[dry-run] Would add transaction: ' +
            t.title +
            ' $' +
            t.amount +
            ' on ' +
            d.toISOString().slice(0, 10) +
            ` (category: ${t.category})`
        );
      } else {
        await transactionsData.addTransaction(
          createdUser._id,
          `${createdUser.firstName} ${createdUser.lastName}`,
          t.title,
          t.amount,
          t.category,
          t.type,
          d,
          t.name
        );
      }
    }

    // Reminders for upcoming bills
    if (!dryRun) {
      const remCol = await remindersColFn();
      for (const b of bills) {
        const due = new Date(b.dueDate);
        if (due >= new Date(now.getFullYear(), now.getMonth(), 1)) {
          await remCol.insertOne({
            userId: new ObjectId(createdUser._id),
            billId: new ObjectId(b._id),
            type: 'before',
            reminderDate: due,
            sent: false,
            createdAt: new Date(),
          });
        }
      }
      console.log('Inserted reminders for upcoming bills');
    } else {
      console.log('[dry-run] Would insert reminders for upcoming bills');
    }

    console.log('db_seed finished' + (dryRun ? ' (dry-run)' : ''));
  } catch (err) {
    console.error('db_seed error:', err);
  } finally {
    try {
      await closeConnection();
    } catch (e) {
      console.warn('Error closing DB connection:', e);
    }
    process.exit(0);
  }
};

if (
  import.meta.url === `file://${process.argv[1]}` ||
  (process.argv[1] && process.argv[1].endsWith('db_seed.js'))
) {
  run();
}

export default run;
