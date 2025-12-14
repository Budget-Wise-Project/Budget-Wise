// data/reminders.js
import { ObjectId } from "mongodb";
import { reminders as remindersCollectionFn } from "../config/mongoCollections.js";
import { billsData, utilitiesData } from "./index.js";

export const createBillReminders = async (userId, bill, daysBefore = 3) => {
  const col = await remindersCollectionFn();

  const reminders = [];

  // Reminder N days before
  const beforeDate = new Date(bill.dueDate);
  beforeDate.setDate(beforeDate.getDate() - daysBefore);
  reminders.push({
    userId: new ObjectId(userId),
    billId: new ObjectId(bill._id),
    type: "before",
    reminderDate: beforeDate,
    sent: false,
  });

  // Reminder on due date
  reminders.push({
    userId: new ObjectId(userId),
    billId: new ObjectId(bill._id),
    type: "on",
    reminderDate: bill.dueDate,
    sent: false,
  });

  await col.insertMany(reminders);
  return reminders;
};

export const getDueRemindersForUserWithDetails = async (userId) => {
  const col = await remindersCollectionFn();
  const now = new Date();

  const reminders = await col.find({
    userId: new ObjectId(userId),
    reminderDate: { $lte: now },
    sent: false
  }).sort({ reminderDate: 1 }).toArray();

  // Attach bill + utility details
  const enriched = [];
  for (const r of reminders) {
    const bill = await billsData.getBillById(r.billId.toString());
    const utility = await utilitiesData.getUtilityById(bill.utilityId.toString());
    enriched.push({
      ...r,
      _id: r._id.toString(),
      billId: r.billId.toString(),
      userId: r.userId.toString(),
      utilityName: utility?.provider || "Unknown Utility",
      amount: bill?.amount || 0
    });
  }

  return enriched;
};

export const markManySent = async (reminderIds) => {
  if (!reminderIds || !reminderIds.length) return;
  const col = await remindersCollectionFn();

  await col.updateMany(
    { _id: { $in: reminderIds.map(id => new ObjectId(id)) } },
    { $set: { sent: true, sentAt: new Date() } }
  );
};