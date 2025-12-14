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
    if (!userId) throw 'UserId required';

    const trans = await transactions();
    let all = await trans.find({ userId: userId }).toArray();
    return all;
};

let addTransaction = async function (userId, name, title, amount, category, type, date, notes) {
    if (!userId) throw 'UserId required';
    if (!name) throw 'Name required';

    const trans = await transactions();

    let newTrans = {
        _id: await getNextTransId(),
        userId: userId.trim(),
        name: name.trim(),
        title: title.trim(),
        amount: Number(amount),
        category: category.trim(),
        type: type.trim(),
        date: date.trim(),
        notes: notes ? notes.trim() : ''
    };

    let insertInfo = await trans.insertOne(newTrans);
    if (!insertInfo.acknowledged) throw 'Could not add transaction';

    return await getTransactionById(newTrans._id, userId);
};

let getTransactionById = async function (id, userId) {
    if (!id) throw 'Id required';
    if (!userId) throw 'UserId required';

    const trans = await transactions();
    let transaction = await trans.findOne({ _id: id, userId: userId });
    if (!transaction) throw 'Transaction not found';

    return transaction;
};

let updateTransaction = async function (id, userId, updated) {
    if (!id) throw 'Id required';
    if (!userId) throw 'UserId required';

    const trans = await transactions();

    let updateObj = {
        title: updated.title.trim(),
        amount: Number(updated.amount),
        category: updated.category.trim(),
        type: updated.type.trim(),
        date: updated.date.trim(),
        notes: updated.notes ? updated.notes.trim() : ''
    };

    let result = await trans.findOneAndUpdate(
        { _id: id, userId: userId },
        { $set: updateObj },
        { returnDocument: 'after' }
    );

    if (!result || !result.value) throw 'Could not update';
    return result.value;
};

let deleteTransaction = async function (id, userId) {
    if (!id) throw 'Id required';
    if (!userId) throw 'UserId required';

    const trans = await transactions();
    let deletion = await trans.deleteOne({ _id: id, userId: userId });
    if (!deletion.deletedCount) throw 'Could not delete';

    return true;
};

export {
    getAllTransactions,
    addTransaction,
    getTransactionById,
    updateTransaction,
    deleteTransaction
};

export default {
    getAllTransactions,
    addTransaction,
    getTransactionById,
    updateTransaction,
    deleteTransaction
};
