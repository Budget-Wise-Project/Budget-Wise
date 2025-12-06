import { dbConnection } from "./mongoConnection.js";

const getCollectionFn = (collection) => {
  let _col = undefined;

  return async () => {
    if (!_col) {
      const db = await dbConnection();
      _col = await db.collection(collection);
    }

    return _col;
  };
};

// Core collections based on the data model.
export const users = getCollectionFn("users");
export const transactions = getCollectionFn("transactions");
export const utilities = getCollectionFn("utilities");
export const bills = getCollectionFn("bills");
export const reminders = getCollectionFn("reminders");
export const budgets = getCollectionFn('budgets');

// Legacy/demo collection (can be removed once everything uses the collections above).
export const budgetWise = getCollectionFn("budgetWise");


