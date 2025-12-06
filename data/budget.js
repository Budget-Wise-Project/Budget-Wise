import { ObjectId } from 'mongodb';
import { budgets, transactions } from '../config/mongoCollections.js';

//To validate ObjectId strings
const validateId = (id, varName) => {
    if(!id) throw new Error(`${varName} is required`);
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
        endDate: end
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

    const budgetList = await budgetsCollection
        .find({userId: new ObjectId(userId) })
        .toArray();

    if (budgetList.length === 0) return [];

    return budgetList.map((budget) => {
        budget._id = budget._id.toString();
        budget.userId = budget.userId.toString();
        return budget;
    });
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
                    $lte: end
                },
                ...(category && { category: category })
            }
        },
        {
            $group: {
                _id: null,
                totalSpent: { $sum: '$amount' }
            }
        }
    ];

    const result = await transactionsCollection.aggregate(aggregationPipeline).toArray();

    const amountUsed = result.length > 0 ? result[0].totalSpent: 0;
    const amountRemaining = amountLimit - amountUsed;
    const percentageUsed = (amountUsed / amountLimit) * 100;

    return {
        ...budgetDocument,
        amountUsed: amountUsed,
        amountRemaining: amountRemaining,
        percentageUsed: Math.min(percentageUsed, 100)
    };
} ;
//DELETE a user's budget
export const deleteBudgetById = async (budgetId) => {
    budgetId = validateId(budgetId, 'budgetId');

    const budgetsCollection = await budgets();

    const deletionInfo = await budgetsCollection.findOneAndDelete({
        _id: new ObjectId(budgetId)
    });

    if (!deletionInfo.value) {
        return false;
    }

    return true;
};