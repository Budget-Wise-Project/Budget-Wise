import { transactions } from '../config/mongoCollections.js';

let getNextTransId = async function () {
  const trans = await transactions();

  let last = await trans
    .find({ _id: { $regex: /^t\d+$/ } })
    .sort({ _id: -1 })
    .limit(1)
    .toArray();

  if (!last || last.length === 0) return 't001';

  let lastId = last[0]._id;
  let lastNum = parseInt(lastId.substring(1), 10);
  let nextNum = lastNum + 1;

  return 't' + String(nextNum).padStart(3, '0');
};

let getAllTransactions = async function (userId) {
  if (!userId) throw new Error('UserId required');

  const trans = await transactions();
  let all = await trans.find({ userId: userId }).toArray();
  return all.map((t) => {
    const out = { ...t };
    let dt = out.date;
    if (!dt) dt = new Date();
    else if (typeof dt === 'string') dt = new Date(dt);
    else if (!(dt instanceof Date)) dt = new Date(dt);

    const dd = String(dt.getDate()).padStart(2, '0');
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const yyyy = dt.getFullYear();

    out.dateFormatted = `${mm}/${dd}/${yyyy}`;
    out.dateForInput = `${yyyy}-${mm}-${dd}`;
    out.isIncome = String(out.type).toLowerCase() === 'income';

    return out;
  });
};

let addTransaction = async function (userId, name, title, amount, category, type, date, notes) {
  if (!userId) throw new Error('UserId required');
  if (!name) throw new Error('Name required');

  const trans = await transactions();

  let parsedDate;
  if (!date) parsedDate = new Date();
  else if (date instanceof Date) parsedDate = date;
  else parsedDate = new Date(String(date).trim());

  const normalizeToMidnight = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const todayMid = normalizeToMidnight(new Date());
  const parsedMid = normalizeToMidnight(parsedDate);
  if (parsedMid.getTime() > todayMid.getTime()) throw new Error('Date cannot be in the future');

  let newTrans = {
    _id: await getNextTransId(),
    userId: userId.trim(),
    name: name.trim(),
    title: title.trim(),
    amount: Number(amount),
    category: category.trim(),
    type: type.trim(),
    date: parsedDate,
    notes: notes ? notes.trim() : '',
  };

  let insertInfo = await trans.insertOne(newTrans);
  if (!insertInfo.acknowledged) throw new Error('Could not add transaction');

  return await getTransactionById(newTrans._id, userId);
};

let getTransactionById = async function (id, userId) {
  if (!id) throw new Error('Id required');
  if (!userId) throw new Error('UserId required');

  const trans = await transactions();
  let transaction = await trans.findOne({ _id: id, userId: userId });
  if (!transaction) throw new Error('Transaction not found');

  let dt = transaction.date;
  if (!dt) dt = new Date();
  else if (typeof dt === 'string') dt = new Date(dt);
  else if (!(dt instanceof Date)) dt = new Date(dt);

  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const yyyy = dt.getFullYear();

  transaction.dateFormatted = `${mm}/${dd}/${yyyy}`;
  transaction.dateForInput = `${yyyy}-${mm}-${dd}`;
  transaction.isIncome = String(transaction.type).toLowerCase() === 'income';

  return transaction;
};

let updateTransaction = async function (id, userId, updated) {
  if (!id) throw new Error('Id required');
  if (!userId) throw new Error('UserId required');

  const trans = await transactions();

  const title = updated.title !== undefined ? String(updated.title).trim() : null;
  const amount = updated.amount !== undefined ? Number(updated.amount) : null;
  const category = updated.category !== undefined ? String(updated.category).trim() : null;
  const type = updated.type !== undefined ? String(updated.type).trim() : null;
  const notes = updated.notes !== undefined ? String(updated.notes).trim() : '';

  // date handling
  let parsedDate;
  if (!updated.date) parsedDate = new Date();
  else if (updated.date instanceof Date) parsedDate = updated.date;
  else parsedDate = new Date(String(updated.date).trim());

  // prevent future dates on update as well
  const normalizeToMidnight = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const todayMid = normalizeToMidnight(new Date());
  const parsedMid = normalizeToMidnight(parsedDate);
  if (parsedMid.getTime() > todayMid.getTime()) throw new Error('Date cannot be in the future');

  // Basic validation
  if (title === null || title.length === 0) throw new Error('Title is required');
  if (category === null || category.length === 0) throw new Error('Category is required');
  if (type === null || type.length === 0) throw new Error('Type is required');
  if (Number.isNaN(amount)) throw new Error('Amount must be a number');

  const updateDoc = {
    title,
    amount: Number(amount),
    category,
    type,
    date: parsedDate,
    notes,
  };

  const result = await trans.updateOne(
    { _id: id, userId: String(userId).trim() },
    { $set: updateDoc }
  );

  if (!result || result.matchedCount === 0) {
    throw new Error('Could not update - transaction not found or you do not have permission');
  }

  return await getTransactionById(id, userId);
};

let deleteTransaction = async function (id, userId) {
  if (!id) throw new Error('Id required');
  if (!userId) throw new Error('UserId required');

  const trans = await transactions();
  let deletion = await trans.deleteOne({ _id: id, userId: userId });
  if (!deletion.deletedCount) throw new Error('Could not delete');

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
