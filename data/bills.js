import { ObjectId } from "mongodb";
import { bills as billsCollectionFn } from "../config/mongoCollections.js";

const validateString = (name, value) => {
  if (!value || typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${name} must be a non-empty string`);
  }
};

// History query
export const getBillsHistoryForUser = async (
  userId,
  { startDate, endDate, status, searchTerm } = {}
) => {
  if (!userId) throw new Error("User id is required for history lookup.");
  const billsCollection = await billsCollectionFn();

  const matchStage = { userId: new ObjectId(userId) };
  if (startDate && endDate) {
    matchStage.dueDate = { $gte: new Date(startDate), $lt: new Date(endDate) };
  }
  if (status && status.trim() !== "") {
    matchStage.status = new RegExp(`^${status.trim()}$`, "i");
  }

  const pipeline = [
    { $match: matchStage },
    {
      $lookup: {
        from: "utilities",
        localField: "utilityId",
        foreignField: "_id",
        as: "utility",
      },
    },
    { $unwind: "$utility" },
  ];

  if (searchTerm && searchTerm.trim() !== "") {
    const regex = new RegExp(searchTerm.trim(), "i");
    pipeline.push({
      $match: {
        $or: [
          { "utility.provider": regex },
          { "utility.accountNumber": regex },
          { notes: regex },
        ],
      },
    });
  }

  pipeline.push({ $sort: { dueDate: -1 } });
  const results = await billsCollection.aggregate(pipeline).toArray();

  return results.map((bill) => ({
    ...bill,
    _id: bill._id.toString(),
    userId: bill.userId.toString(),
    utilityId: bill.utilityId.toString(),
    utility: {
      ...bill.utility,
      _id: bill.utility._id.toString(),
      userId: bill.utility.userId.toString(),
    },
  }));
};

// Create
export const createBill = async (
  userId,
  utilityId,
  dueDate,
  amount,
  status = "upcoming",
  notes = ""
) => {
  const billsCollection = await billsCollectionFn();
  const newBill = {
    userId: new ObjectId(userId),
    utilityId: new ObjectId(utilityId),
    dueDate: new Date(dueDate),
    amount: typeof amount === "number" ? amount : Number(amount) || 0,
    status,
    paidDate: null,
    notes: notes ? String(notes).trim() : "",
    createdAt: new Date(),
  };
  const insertResult = await billsCollection.insertOne(newBill);
  if (!insertResult.acknowledged) throw new Error("Could not create bill");
  const created = await billsCollection.findOne({
    _id: insertResult.insertedId,
  });
  created._id = created._id.toString();
  created.userId = created.userId.toString();
  created.utilityId = created.utilityId.toString();
  return created;
};

// Read
export const getBillsForUser = async (userId) => {
  const billsCollection = await billsCollectionFn();
  const results = await billsCollection
    .find({ userId: new ObjectId(userId) })
    .toArray();
  return results.map((b) => ({
    ...b,
    _id: b._id.toString(),
    userId: b.userId.toString(),
    utilityId: b.utilityId.toString(),
  }));
};

export const getBillsForUtility = async (userId, utilityId) => {
  const billsCollection = await billsCollectionFn();
  const results = await billsCollection
    .find({
      userId: new ObjectId(userId),
      utilityId: new ObjectId(utilityId),
    })
    .toArray();
  return results.map((b) => ({
    ...b,
    _id: b._id.toString(),
    userId: b.userId.toString(),
    utilityId: b.utilityId.toString(),
  }));
};

export const getBillById = async (id) => {
  const billsCollection = await billsCollectionFn();
  const bill = await billsCollection.findOne({ _id: new ObjectId(id) });
  if (!bill) throw new Error("Bill not found");
  bill._id = bill._id.toString();
  bill.userId = bill.userId.toString();
  bill.utilityId = bill.utilityId.toString();
  return bill;
};

// Update
export const updateBill = async (id, updates = {}) => {
  const billsCollection = await billsCollectionFn();
  const updateDoc = {};
  if (updates.dueDate !== undefined)
    updateDoc.dueDate = new Date(updates.dueDate);
  if (updates.amount !== undefined)
    updateDoc.amount =
      typeof updates.amount === "number"
        ? updates.amount
        : Number(updates.amount) || 0;
  if (updates.status !== undefined)
    updateDoc.status = String(updates.status).trim();
  if (updates.paidDate !== undefined)
    updateDoc.paidDate = updates.paidDate ? new Date(updates.paidDate) : null;
  if (updates.notes !== undefined)
    updateDoc.notes = String(updates.notes).trim();

  const result = await billsCollection.updateOne(
    { _id: new ObjectId(id) },
    { $set: updateDoc }
  );
  if (result.modifiedCount === 0) throw new Error("Could not update bill");
  return getBillById(id);
};

// Delete
export const deleteBill = async (id) => {
  const billsCollection = await billsCollectionFn();
  const result = await billsCollection.deleteOne({ _id: new ObjectId(id) });
  if (result.deletedCount === 0) throw new Error("Could not delete bill");
  return true;
};

//Sync current month’s bill when utility is updated
export const updateCurrentBillForUtility = async (utilityId, updates = {}) => {
  const billsCollection = await billsCollectionFn();
  const now = new Date();
  const currentBill = await billsCollection.findOne(
    {
      utilityId: new ObjectId(utilityId),
      dueDate: {
        $gte: new Date(now.getFullYear(), now.getMonth(), 1),
        $lt: new Date(now.getFullYear(), now.getMonth() + 1, 1),
      },
    },
    { sort: { dueDate: -1 } }
  );
  if (!currentBill) return null;

  const updateDoc = {};
  if (updates.defaultDay)
    updateDoc.dueDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      updates.defaultDay
    );
  if (updates.defaultAmount !== undefined)
    updateDoc.amount = Number(updates.defaultAmount) || 0;

  if (Object.keys(updateDoc).length > 0) {
    await billsCollection.updateOne(
      { _id: currentBill._id },
      { $set: updateDoc }
    );
  }

  return {
    ...currentBill,
    ...updateDoc,
    _id: currentBill._id.toString(),
    userId: currentBill.userId.toString(),
    utilityId: currentBill.utilityId.toString(),
  };
};

export const deleteBillsByUtilityId = async (utilityId) => {
  const billsCollection = await billsCollectionFn();
  const result = await billsCollection.deleteMany({
    utilityId: new ObjectId(utilityId),
  });
  return result.deletedCount;
};

export default {
  createBill,
  getBillsForUser,
  getBillsForUtility,
  getBillById,
  updateBill,
  deleteBill,
  getBillsHistoryForUser,
  updateCurrentBillForUtility,
  deleteBillsByUtilityId,
};
