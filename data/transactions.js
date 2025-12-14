
import { ObjectId } from 'mongodb';
import { transactions } from '../config/mongoCollections.js';

let getAllTransactions = async function () {
    const trans = await transactions();
    let all = await trans.find({}).toArray();
    return all.map(t => ({ ...t, _id: t._id.toString() }));
};

let addTransaction = async function (title, amount, category, date, notes) {
    const trans = await transactions();

    let newTrans = {
        title: title.trim(),
        amount: Number(amount),
        category: category.trim(),
        date: date.trim(),
        notes: notes ? notes.trim() : ''
    };

    let insertInfo = await trans.insertOne(newTrans);
    if (!insertInfo.insertedId) throw 'Could not add transaction';

    return await getTransactionById(insertInfo.insertedId.toString());
};

let getTransactionById = async function (id) {
    if (!id) throw 'Id required';
    if (!ObjectId.isValid(id)) throw 'Invalid id';

    const trans = await transactions();
    let transaction = await trans.findOne({ _id: new ObjectId(id) });
    if (!transaction) throw 'Transaction not found';
    transaction._id = transaction._id.toString();

    return transaction;
};

let updateTransaction = async function (id, updated) {
    if (!id) throw 'Id required';
    if (!ObjectId.isValid(id)) throw 'Invalid id';

    const trans = await transactions();

    let updateObj = {
        title: updated.title.trim(),
        amount: Number(updated.amount),
        category: updated.category.trim(),
        date: updated.date.trim(),
        notes: updated.notes ? updated.notes.trim() : ''
    };

    let result = await trans.findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: updateObj },
        { returnDocument: 'after' }
    );

    if (!result) throw 'Could not update';
    result._id = result._id.toString();
    return result;
};

let deleteTransaction = async function (id) {
    if (!ObjectId.isValid(id)) throw 'Invalid id';

    const trans = await transactions();
    let deletion = await trans.deleteOne({ _id: new ObjectId(id) });
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
