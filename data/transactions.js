import { transactions } from '../config/mongoCollections.js';
import { ObjectId } from "mongodb";


let getAllTransactions = async function (userId) {
    if (!userId) throw 'UserId required';

    const trans = await transactions();

    const userObjId = typeof userId === "string" ? new ObjectId(userId) : userId;

    return await trans.find({ userId: userObjId }).toArray();
};

let addTransaction = async function (userId, name, title, amount, category, type, date, notes) {
    if (!userId) throw 'UserId required';
    if (!name) throw 'Name required';

    const trans = await transactions();
    const userObjId = 
        typeof userId === "string" ? new ObjectId(userId.trim()) : userId;

    const newTrans = {
        userId: userObjId,
        name: name ? name.trim() : "",
        title: title ? title.trim() : "",
        amount: Number(amount),
        category: category ? category.trim() : "",
        type: type ? type.trim() : "",
        date: date ? new Date(date) : new Date(),
        notes: notes ? notes.trim() : ''
    };

    const insertInfo = await trans.insertOne(newTrans);
    if (!insertInfo.acknowledged || !insertInfo.insertedId) 
        throw 'Could not add transaction';

    return await getTransactionById(insertInfo.insertedId.toString(), userId);
};

let getTransactionById = async function (id, userId) {
    if (!id) throw 'Id required';
    if (!userId) throw 'UserId required';

    const trans = await transactions();
    const txObjId = new ObjectId(id);
    const userObjId = typeof userId === "string" ? new ObjectId(userId) : userId;
    
    const transaction = await trans.findOne({ _id: txObjId, userId: userObjId });
    if (!transaction) throw 'Transaction not found';

    return transaction;
};

let updateTransaction = async function (id, userId, updated) {
    if (!id) throw 'Id required';
    if (!userId) throw 'UserId required';

    const trans = await transactions();
    const txObjId = new ObjectId(id);
    const userObjId = typeof userId === "string" ? new ObjectId(userId) : userId;

    const updateObj = {
        title: updated?.title ? updated.title.trim() : "",
        name: updated?.name ? updated.name.trim() : "",
        amount: Number(updated?.amount),
        category: updated?.category ? updated.category.trim() : "",
        type: updated?.type ? updated.type.trim() : "",
        date: updated?.date ? new Date(updated.date) : new Date(),
        notes: updated.notes ? updated.notes.trim() : "",
    };

    const result = await trans.findOneAndUpdate(
        { _id: txObjId, userId: userObjId },
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
    const txObjId = new ObjectId(id);
    const userObjId = typeof userId === "string" ? new ObjectId(userId) : userId;

    const deletion = await trans.deleteOne({ _id: txObjId, userId: userObjId });
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
