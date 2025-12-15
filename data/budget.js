import { ObjectId } from 'mongodb';
import { budgets, transactions, bills } from '../config/mongoCollections.js';

//To validate ObjectId strings
const validateId = (id, varName) => {
  if (!id) throw new Error(`${varName} is required`);
  if (typeof id !== 'string') throw new Error(`${varName} must be a string`);
  id = id.trim();
  if (id.length === 0) throw new Error(`${varName} cannot be an empty string`);
  if (!ObjectId.isValid(id)) throw new Error(`${varName} is not a valid ObjectId`);
  return id;
};

const validateNonNegativeNumber = (value, varName) => {
  if (value === undefined || value === null) {
    throw new Error(`${varName} is required`);
  }
  const num = Number(value);
  if (Number.isNaN(num)) {
    throw new Error(`${varName} must be a number`);
  }
  if (num < 0) {
    throw new Error(`${varName} must be a non-negative number`);
  }
  return num;
};

const validateDateString = (dateStr, varName) => {
  if (!dateStr) throw new Error(`${varName} is required`);
  if (typeof dateStr !== 'string') throw new Error(`${varName} must be a string`);
  dateStr = dateStr.trim();
  if (dateStr.length === 0) throw new Error(`${varName} cannot be empty`);

  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${varName} is not a valid date.`);
  }
  return date;
};

const validateCategory = (category, varName) => {
  if (!category) throw new Error(`${varName} is required`);
  if (typeof category !== 'string') throw new Error(`${varName} must be a string`);
  category = category.trim();
  if (category.length < 2) throw new Error(`${varName} must be at least 2 characters.`);
  return category;
};

//Core Feature
//Create a new budget document with category and date limits
export const createBudget = async ({ userId, category, amountLimit, startDate, endDate }) => {
  userId = validateId(userId, 'userId');
  category = validateCategory(category, 'category');
  amountLimit = validateNonNegativeNumber(amountLimit, 'amountLimit');
  const start = validateDateString(startDate, 'startDate');
  const end = validateDateString(endDate, 'endDate');

  if (start >= end) {
    throw new Error('End date must be after the start date.');
  }

  const budgetsCollection = await budgets();

  const newBudget = {
    userId: new ObjectId(userId),
    category,
    amountLimit,
    startDate: start,
    endDate: end,
    active: true,
  };

  const insertInfo = await budgetsCollection.insertOne(newBudget);
  if (!insertInfo.acknowledged || !insertInfo.insertedId) {
    throw new Error('Could not create budget successfully');
  }

  const dbResult = await budgetsCollection.findOne({ _id: insertInfo.insertedId });

  dbResult._id = dbResult._id.toString();
  dbResult.userId = dbResult.userId.toString();
  return dbResult;
};

//GET a budget document for a user if it exists
export const getBudgetsForUser = async (userId) => {
  userId = validateId(userId, 'userId');

  const budgetsCollection = await budgets();

  const budgetList = await budgetsCollection.find({ userId: new ObjectId(userId) }).toArray();

  if (budgetList.length === 0) return [];

  return budgetList.map((budget) => {
    budget._id = budget._id.toString();
    budget.userId = budget.userId.toString();
    budget.active = budget.active ?? true;
    return budget;
  });
};

export const toggleBudgetActive = async (budgetId, userId) => {
  budgetId = validateId(budgetId, 'budgetId');
  userId = validateId(userId, 'userId');

  const budgetsCollection = await budgets();

  const budget = await budgetsCollection.findOne({ _id: new ObjectId(budgetId) });
  if (!budget) throw new Error('Budget not found');

  if (budget.userId.toString() !== userId) {
    throw new Error('Not authorized to update this budget');
  }

  const newActiveState = !budget.active;

  const updateInfo = await budgetsCollection.updateOne(
    { _id: new ObjectId(budgetId) },
    { $set: { active: newActiveState } }
  );

  if (updateInfo.modifiedCount === 0) {
    throw new Error('Could not update budget status');
  }

  const updated = await budgetsCollection.findOne({ _id: new ObjectId(budgetId) });
  updated._id = updated._id.toString();
  updated.userId = updated.userId.toString();

  return updated;
};

export const calculateBudgetSummary = async (budgetDocument) => {
  const { userId, category, amountLimit, startDate, endDate } = budgetDocument;

  const start = new Date(startDate);
  const end = new Date(endDate);

  const transactionsCollection = await transactions();

  const aggregationPipeline = [
    {
      $match: {
        userId: new ObjectId(userId),
        type: 'Expense',
        date: {
          $gte: start,
          $lte: end,
        },
        ...(category && {
          category: {
            $regex: `^${category.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
            $options: 'i',
          },
        }),
      },
    },
    {
      $group: {
        _id: null,
        totalSpent: { $sum: '$amount' },
      },
    },
  ];

  const result = await transactionsCollection.aggregate(aggregationPipeline).toArray();

  const amountUsed = result.length > 0 ? result[0].totalSpent : 0;
  // If this budget is for Utilities, include bill amounts (generated by utilities) in the amount used
  let billTotal = 0;
  try {
    if (category && String(category).trim().toLowerCase() === 'utilities') {
      const billsCollection = await bills();
      const billAgg = await billsCollection
        .aggregate([
          {
            $match: {
              userId: new ObjectId(userId),
              dueDate: { $gte: start, $lte: end },
              status: 'paid',
            },
          },
          { $group: { _id: null, total: { $sum: '$amount' } } },
        ])
        .toArray();
      if (billAgg.length > 0) billTotal = billAgg[0].total || 0;
    }
  } catch (e) {
    // If bill lookup fails, don't block summary — treat as zero additional amount
    billTotal = 0;
  }
  const totalUsed = Number(amountUsed || 0) + Number(billTotal || 0);
  const amountRemaining = amountLimit - totalUsed;
  const percentageUsed = amountLimit > 0 ? (totalUsed / amountLimit) * 100 : 0;

  return {
    ...budgetDocument,
    amountUsed: totalUsed,
    amountRemaining: amountRemaining,
    percentageUsed: Math.min(percentageUsed, 100),
  };
};
//DELETE a user's budget
export const deleteBudgetById = async (budgetId) => {
  budgetId = validateId(budgetId, 'budgetId');

  const budgetsCollection = await budgets();

  const deletionInfo = await budgetsCollection.findOneAndDelete({
    _id: new ObjectId(budgetId),
  });

  if (!deletionInfo.value) {
    return false;
  }

  return true;
};
