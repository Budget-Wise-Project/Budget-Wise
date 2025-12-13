import { ObjectId } from "mongodb";
import {
  utilities as utilitiesCollectionFn,
  bills as billsCollectionFn,
} from "../config/mongoCollections.js";
import { createBill, updateBill } from "./bills.js";

const validateString = (name, value) => {
  if (!value || typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${name} must be a non-empty string`);
  }
};

const validateDay = (day) => {
  const num = Number(day);
  if (!Number.isInteger(num) || num < 1 || num > 31) {
    throw new Error("defaultDay must be an integer between 1 and 31");
  }
  return num;
};

export const createUtility = async (
  userId,
  provider,
  accountNumber,
  defaultDay,
  defaultAmount,
  notes = "",
  active = true
) => {
  validateString("userId", userId);
  validateString("provider", provider);
  validateString("accountNumber", accountNumber);

  const utilitiesCollection = await utilitiesCollectionFn();

  const newUtility = {
    userId: new ObjectId(userId),
    provider: provider.trim(),
    accountNumber: accountNumber.trim(),
    defaultDay: defaultDay ? validateDay(defaultDay) : null,
    defaultAmount:
      typeof defaultAmount === "number"
        ? defaultAmount
        : Number(defaultAmount) || 0,
    notes: notes ? String(notes).trim() : "",
    active: Boolean(active),
    createdAt: new Date(),
  };

  const insertResult = await utilitiesCollection.insertOne(newUtility);
  if (!insertResult.acknowledged) throw new Error("Could not create utility");

  const created = await utilitiesCollection.findOne({
    _id: insertResult.insertedId,
  });
  created._id = created._id.toString();
  created.userId = created.userId.toString();

  // Only auto-create a bill if the utility is active
  if (created.active && created.defaultDay) {
    const now = new Date();
    const dueDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      created.defaultDay
    );

    await createBill(
      created.userId,
      created._id,
      dueDate,
      created.defaultAmount,
      "upcoming",
      `Auto-generated bill for ${created.provider}`
    );
  }

  return created;
};

export const getUtilitiesForUser = async (userId) => {
  validateString("userId", userId);
  const utilitiesCollection = await utilitiesCollectionFn();
  const results = await utilitiesCollection
    .find({ userId: new ObjectId(userId) })
    .toArray();
  return results.map((u) => ({
    ...u,
    _id: u._id.toString(),
    userId: u.userId.toString(),
  }));
};

export const getUtilityById = async (id) => {
  validateString("id", id);
  const utilitiesCollection = await utilitiesCollectionFn();
  const util = await utilitiesCollection.findOne({ _id: new ObjectId(id) });
  if (!util) throw new Error("Utility not found");
  util._id = util._id.toString();
  util.userId = util.userId.toString();
  return util;
};

export const updateUtility = async (id, updates = {}) => {
  validateString("id", id);
  const utilitiesCollection = await utilitiesCollectionFn();

  // Block edits on inactive utilities
  const existing = await utilitiesCollection.findOne({ _id: new ObjectId(id) });
  if (!existing) throw new Error("Utility not found");
  if (!existing.active) {
    throw new Error("Cannot edit an inactive utility. Reactivate it first.");
  }

  const updateDoc = {};
  if (updates.provider !== undefined)
    updateDoc.provider = String(updates.provider).trim();
  if (updates.accountNumber !== undefined)
    updateDoc.accountNumber = String(updates.accountNumber).trim();
  if (updates.defaultDay !== undefined) {
    updateDoc.defaultDay =
      updates.defaultDay !== null && updates.defaultDay !== ""
        ? validateDay(updates.defaultDay)
        : null;
  }
  if (updates.defaultAmount !== undefined) {
    updateDoc.defaultAmount =
      typeof updates.defaultAmount === "number"
        ? updates.defaultAmount
        : Number(updates.defaultAmount) || 0;
  }
  if (updates.notes !== undefined)
    updateDoc.notes = String(updates.notes).trim();
  if (updates.active !== undefined) {
    updateDoc.active = updates.active === "on" || updates.active === true;
  }

  const result = await utilitiesCollection.updateOne(
    { _id: new ObjectId(id) },
    { $set: updateDoc }
  );
  if (result.modifiedCount === 0) throw new Error("Could not update utility");

  const updatedUtility = await getUtilityById(id);

  // Sync current month’s bill if due date or amount changed
  if (updates.defaultDay !== undefined || updates.defaultAmount !== undefined) {
    const now = new Date();
    const dueDate = updates.defaultDay
      ? new Date(now.getFullYear(), now.getMonth(), updates.defaultDay)
      : undefined;

    const billUpdates = {};
    if (dueDate) billUpdates.dueDate = dueDate;
    if (updates.defaultAmount !== undefined)
      billUpdates.amount = updates.defaultAmount;

    const billsCollection = await billsCollectionFn();
    const latestBill = await billsCollection.findOne(
      { utilityId: new ObjectId(id) },
      { sort: { dueDate: -1 } }
    );
    if (latestBill) {
      await updateBill(latestBill._id.toString(), billUpdates);
    }
  }

  // If active toggled on: ensure a bill exists for current month
  if (updateDoc.active === true) {
    const billsCollection = await billsCollectionFn();
    const now = new Date();
    if (updatedUtility.defaultDay) {
      const dueDate = new Date(
        now.getFullYear(),
        now.getMonth(),
        updatedUtility.defaultDay
      );
      const existingBill = await billsCollection.findOne({
        utilityId: new ObjectId(id),
        dueDate: {
          $gte: new Date(now.getFullYear(), now.getMonth(), 1),
          $lt: new Date(now.getFullYear(), now.getMonth() + 1, 1),
        },
      });
      if (!existingBill) {
        await createBill(
          updatedUtility.userId,
          updatedUtility._id,
          dueDate,
          updatedUtility.defaultAmount,
          "upcoming",
          `Auto-generated bill for ${updatedUtility.provider}`
        );
      }
    }
  }

  // If active toggled off: delete future bill for current month, keep past
  if (updateDoc.active === false) {
    const billsCollection = await billsCollectionFn();
    const now = new Date();
    const currentBill = await billsCollection.findOne(
      {
        utilityId: new ObjectId(id),
        dueDate: {
          $gte: new Date(now.getFullYear(), now.getMonth(), 1),
          $lt: new Date(now.getFullYear(), now.getMonth() + 1, 1),
        },
      },
      { sort: { dueDate: -1 } }
    );
    if (currentBill) {
      const dueDate = new Date(currentBill.dueDate);
      if (dueDate > now) {
        await billsCollection.deleteOne({ _id: currentBill._id });
      }
    }
  }

  return updatedUtility;
};

export const deleteUtility = async (id) => {
  validateString("id", id);
  const utilitiesCollection = await utilitiesCollectionFn();
  const result = await utilitiesCollection.deleteOne({ _id: new ObjectId(id) });
  if (result.deletedCount === 0) throw new Error("Could not delete utility");
  return true;
};

export const toggleUtilityActive = async (id) => {
  validateString("id", id);
  const utilitiesCollection = await utilitiesCollectionFn();
  const billsCollection = await billsCollectionFn();

  const util = await utilitiesCollection.findOne({ _id: new ObjectId(id) });
  if (!util) throw new Error("Utility not found");

  const newStatus = !util.active;
  await utilitiesCollection.updateOne(
    { _id: new ObjectId(id) },
    { $set: { active: newStatus } }
  );

  const now = new Date();

  if (newStatus) {
    if (util.defaultDay) {
      const dueDate = new Date(
        now.getFullYear(),
        now.getMonth(),
        util.defaultDay
      );
      const existingBill = await billsCollection.findOne({
        utilityId: new ObjectId(id),
        dueDate: {
          $gte: new Date(now.getFullYear(), now.getMonth(), 1),
          $lt: new Date(now.getFullYear(), now.getMonth() + 1, 1),
        },
      });
      if (!existingBill) {
        await createBill(
          util.userId.toString(),
          util._id.toString(),
          dueDate,
          util.defaultAmount,
          "upcoming",
          `Auto-generated bill for ${util.provider}`
        );
      }
    }
  } else {
    // Deactivated - delete future current-month bill; keep past
    const currentBill = await billsCollection.findOne(
      {
        utilityId: new ObjectId(id),
        dueDate: {
          $gte: new Date(now.getFullYear(), now.getMonth(), 1),
          $lt: new Date(now.getFullYear(), now.getMonth() + 1, 1),
        },
      },
      { sort: { dueDate: -1 } }
    );
    if (currentBill) {
      const dueDate = new Date(currentBill.dueDate);
      if (dueDate > now) {
        await billsCollection.deleteOne({ _id: currentBill._id });
      }
    }
  }

  return {
    ...util,
    active: newStatus,
    _id: util._id.toString(),
    userId: util.userId.toString(),
  };
};

export default {
  createUtility,
  getUtilitiesForUser,
  getUtilityById,
  updateUtility,
  deleteUtility,
  toggleUtilityActive,
};
