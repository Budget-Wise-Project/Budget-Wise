import { transactions, budgets } from '../config/mongoCollections.js';
import { ObjectId } from 'mongodb';

const parseDateLocal = (dateInput) => {
  if (!dateInput) return new Date();
  // If input is a plain YYYY-MM-DD string (from date inputs), construct a local Date
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    const [y, m, d] = dateInput.split('-').map((s) => parseInt(s, 10));
    return new Date(y, m - 1, d);
  }
  return new Date(dateInput);
};

let getAllTransactions = async function (userId) {
  if (!userId) throw 'UserId required';

  const trans = await transactions();

  const userObjId = typeof userId === 'string' ? new ObjectId(userId) : userId;

  return await trans.find({ userId: userObjId }).toArray();
};

let addTransaction = async function (userId, name, title, amount, category, type, date, notes) {
  if (!userId) throw 'UserId required';
  if (!name) throw 'Name required';

  const trans = await transactions();
  const userObjId = typeof userId === 'string' ? new ObjectId(userId.trim()) : userId;

  const newTrans = {
    userId: userObjId,
    name: name ? name.trim() : '',
    title: title ? title.trim() : '',
    amount: Number(amount),
    category: category ? category.trim() : '',
    type: type ? type.trim() : '',
    date: date ? parseDateLocal(date) : new Date(),
    notes: notes ? notes.trim() : '',
  };

  // Attempt to link this transaction to an active budget for the same category
  try {
    const normalizedCat = (newTrans.category || '').trim().toLowerCase();
    const allowed = ['food', 'housing', 'travel', 'utilities', 'entertainment', 'other'];
    if (allowed.includes(normalizedCat) && newTrans.date) {
      const budgetsCollection = await budgets();
      const matchingBudget = await budgetsCollection.findOne({
        userId: userObjId,
        active: true,
        category: {
          $regex: `^${newTrans.category.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
          $options: 'i',
        },
        startDate: { $lte: newTrans.date },
        endDate: { $gte: newTrans.date },
      });
      if (matchingBudget && matchingBudget._id) {
        newTrans.budgetId = matchingBudget._id;
      }
    }
  } catch (e) {
    // Don't block transaction creation on budget lookup failure
    console.warn('Budget link lookup failed:', e?.message || e);
  }

  const insertInfo = await trans.insertOne(newTrans);
  if (!insertInfo.acknowledged || !insertInfo.insertedId) throw 'Could not add transaction';

  return await getTransactionById(insertInfo.insertedId.toString(), userId);
};

let getTransactionById = async function (id, userId) {
  if (!id) throw 'Id required';
  if (!userId) throw 'UserId required';

  const trans = await transactions();
  const txObjId = new ObjectId(id);
  const userObjId = typeof userId === 'string' ? new ObjectId(userId) : userId;

  const transaction = await trans.findOne({ _id: txObjId, userId: userObjId });
  if (!transaction) throw 'Transaction not found';

  return transaction;
};

let updateTransaction = async function (id, userId, updated) {
  if (!id) throw 'Id required';
  if (!userId) throw 'UserId required';

  const trans = await transactions();
  const txObjId = new ObjectId(id);
  const userObjId = typeof userId === 'string' ? new ObjectId(userId) : userId;

  // Verify ownership/existence before attempting update
  const existing = await trans.findOne({ _id: txObjId, userId: userObjId });
  if (!existing) throw new Error('Transaction not found or not authorized');

  // Build $set only for provided fields to avoid overwriting with blanks
  const setObj = {};
  if (updated?.title !== undefined)
    setObj.title = updated.title ? String(updated.title).trim() : '';
  if (updated?.name !== undefined) setObj.name = updated.name ? String(updated.name).trim() : '';
  if (updated?.amount !== undefined) setObj.amount = Number(updated.amount);
  if (updated?.category !== undefined)
    setObj.category = updated.category ? String(updated.category).trim() : '';
  if (updated?.type !== undefined) setObj.type = updated.type ? String(updated.type).trim() : '';
  if (updated?.date !== undefined)
    setObj.date = updated.date ? parseDateLocal(updated.date) : new Date();
  if (updated?.notes !== undefined)
    setObj.notes = updated.notes ? String(updated.notes).trim() : '';

  // If category or date is being changed (or both), recompute budget linking
  const willChangeCategory = Object.prototype.hasOwnProperty.call(updated || {}, 'category');
  const willChangeDate = Object.prototype.hasOwnProperty.call(updated || {}, 'date');
  if (willChangeCategory || willChangeDate) {
    try {
      const resultingCategory = willChangeCategory
        ? updated.category
          ? String(updated.category).trim()
          : ''
        : existing.category;
      const resultingDate = willChangeDate
        ? updated.date
          ? parseDateLocal(updated.date)
          : new Date()
        : existing.date;

      const normalizedCat = (resultingCategory || '').trim().toLowerCase();
      const allowed = ['food', 'housing', 'travel', 'utilities', 'entertainment', 'other'];
      if (allowed.includes(normalizedCat) && resultingDate) {
        const budgetsCollection = await budgets();
        const matchingBudget = await budgetsCollection.findOne({
          userId: userObjId,
          active: true,
          category: {
            $regex: `^${resultingCategory.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
            $options: 'i',
          },
          startDate: { $lte: resultingDate },
          endDate: { $gte: resultingDate },
        });
        if (matchingBudget && matchingBudget._id) {
          setObj.budgetId = matchingBudget._id;
        } else {
          setObj.budgetId = null;
        }
      } else {
        // category not in allowed list -> clear any existing budget link
        setObj.budgetId = null;
      }
    } catch (e) {
      console.warn('Budget relink failed during update:', e?.message || e);
      // do not block update on budget lookup failure
    }
  }

  if (Object.keys(setObj).length === 0) return existing;

  const result = await trans.findOneAndUpdate(
    { _id: txObjId, userId: userObjId },
    { $set: setObj },
    { returnDocument: 'after' }
  );

  // Some driver versions return the updated document directly, others return { value: doc }
  const updatedDoc = result && result.value ? result.value : result;
  if (!updatedDoc || !updatedDoc._id) {
    console.warn(
      'Transaction update failed for filter',
      { _id: txObjId, userId: userObjId },
      'set:',
      Object.keys(setObj)
    );
    throw new Error('Could not update transaction');
  }

  return updatedDoc;
};

let deleteTransaction = async function (id, userId) {
  if (!id) throw 'Id required';
  if (!userId) throw 'UserId required';

  const trans = await transactions();
  const txObjId = new ObjectId(id);
  const userObjId = typeof userId === 'string' ? new ObjectId(userId) : userId;

  const deletion = await trans.deleteOne({ _id: txObjId, userId: userObjId });
  if (!deletion.deletedCount) throw 'Could not delete';

  return true;
};

export {
  getAllTransactions,
  addTransaction,
  getTransactionById,
  updateTransaction,
  deleteTransaction,
};

export default {
  getAllTransactions,
  addTransaction,
  getTransactionById,
  updateTransaction,
  deleteTransaction,
};
