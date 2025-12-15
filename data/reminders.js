// data/reminders.js
import { ObjectId } from 'mongodb';
import { reminders as remindersCollectionFn } from '../config/mongoCollections.js';
import { billsData, utilitiesData } from './index.js';

export const createBillReminders = async (userId, bill, daysBefore = 3) => {
  const col = await remindersCollectionFn();
  if (!bill || !bill._id) throw new Error('Bill is required');
  await col.deleteMany({ billId: new ObjectId(bill._id) });

  const reminders = [];

  const due = new Date(bill.dueDate);
  const normalizeToMidnight = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const now = new Date();
  const today = normalizeToMidnight(now);
  const dueMid = normalizeToMidnight(due);
  const msPerDay = 24 * 60 * 60 * 1000;
  const diffDays = Math.floor((dueMid.getTime() - today.getTime()) / msPerDay);

  if (diffDays < 0) {
    // Due date already past -> create a single 'before' reminder for today
    reminders.push({
      userId: new ObjectId(userId),
      billId: new ObjectId(bill._id),
      type: 'before',
      reminderDate: today,
      sent: false,
    });
  } else if (diffDays === 0) {
    // Due today -> create an 'on' reminder for today
    reminders.push({
      userId: new ObjectId(userId),
      billId: new ObjectId(bill._id),
      type: 'on',
      reminderDate: today,
      sent: false,
    });
  } else if (diffDays <= daysBefore) {
    // Within the upcoming window -> create a single 'upcoming' reminder set to (due - daysBefore)
    const remDate = normalizeToMidnight(new Date(due));
    remDate.setDate(remDate.getDate() - daysBefore);
    reminders.push({
      userId: new ObjectId(userId),
      billId: new ObjectId(bill._id),
      type: 'upcoming',
      reminderDate: remDate,
      sent: false,
    });
  } else {
    // Far future -> create a 'before' reminder (due - daysBefore) and an 'on' reminder (due date)
    const beforeDate = normalizeToMidnight(new Date(due));
    beforeDate.setDate(beforeDate.getDate() - daysBefore);
    const onDate = normalizeToMidnight(new Date(due));
    reminders.push({
      userId: new ObjectId(userId),
      billId: new ObjectId(bill._id),
      type: 'before',
      reminderDate: beforeDate,
      sent: false,
    });

    reminders.push({
      userId: new ObjectId(userId),
      billId: new ObjectId(bill._id),
      type: 'on',
      reminderDate: onDate,
      sent: false,
    });
  }

  if (reminders.length > 0) {
    const seen = new Set();
    const unique = [];
    for (const r of reminders) {
      const key = `${r.type}:${new Date(r.reminderDate).getTime()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(r);
    }
    if (unique.length > 0) {
      await col.insertMany(unique);
    }
    return unique;
  }
  return [];
};

export const getDueRemindersForUserWithDetails = async (userId) => {
  const col = await remindersCollectionFn();
  const now = new Date();

  const reminders = await col
    .find({
      userId: new ObjectId(userId),
      reminderDate: { $lte: now },
      sent: false,
    })
    .sort({ reminderDate: 1 })
    .toArray();

  // Attach bill & utility details
  const enriched = [];
  for (const r of reminders) {
    try {
      const bill = await billsData.getBillById(r.billId.toString());
      const utility = await utilitiesData.getUtilityById(bill.utilityId.toString());
      enriched.push({
        ...r,
        _id: r._id.toString(),
        billId: r.billId.toString(),
        userId: r.userId.toString(),
        utilityName: utility?.provider || 'Unknown Utility',
        amount: bill?.amount || 0,
      });
    } catch (err) {
      continue;
    }
  }

  return enriched;
};

export const createReminder = async (userId, billId, reminderDate, type = 'before') => {
  if (!userId) throw new Error('userId required');
  if (!billId) throw new Error('billId required');
  const col = await remindersCollectionFn();
  const normalizeToMidnight = (d) => {
    const dt = new Date(d);
    return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
  };

  const remDate = reminderDate
    ? normalizeToMidnight(new Date(reminderDate))
    : normalizeToMidnight(new Date());
  const doc = {
    userId: new ObjectId(userId),
    billId: new ObjectId(billId),
    type: String(type || 'before'),
    reminderDate: remDate,
    sent: false,
    createdAt: new Date(),
  };

  const result = await col.insertOne(doc);
  if (!result.acknowledged) throw new Error('Could not create reminder');
  const created = await col.findOne({ _id: result.insertedId });
  created._id = created._id.toString();
  created.billId = created.billId.toString();
  created.userId = created.userId.toString();
  return created;
};

export const getRemindersForUser = async (userId) => {
  if (!userId) throw new Error('userId required');
  const col = await remindersCollectionFn();
  const results = await col
    .find({ userId: new ObjectId(userId) })
    .sort({ reminderDate: 1 })
    .toArray();

  const enriched = [];
  for (const r of results) {
    try {
      const bill = await billsData.getBillById(r.billId.toString());
      const utility = await utilitiesData.getUtilityById(bill.utilityId.toString());
      enriched.push({
        ...r,
        _id: r._id.toString(),
        billId: r.billId.toString(),
        userId: r.userId.toString(),
        utilityName: utility?.provider || 'Unknown Utility',
        amount: bill?.amount || 0,
      });
    } catch (err) {
      continue;
    }
  }
  return enriched;
};

export const markManySent = async (reminderIds) => {
  if (!reminderIds || !reminderIds.length) return;
  const col = await remindersCollectionFn();

  await col.updateMany(
    { _id: { $in: reminderIds.map((id) => new ObjectId(id)) } },
    { $set: { sent: true, sentAt: new Date() } }
  );
};

export const markRemindersForBillSent = async (billId) => {
  if (!billId) return;
  const col = await remindersCollectionFn();
  const result = await col.updateMany(
    { billId: new ObjectId(billId), sent: false },
    { $set: { sent: true, sentAt: new Date() } }
  );
  return result.modifiedCount || 0;
};

export const replaceRemindersForBill = async (userId, bill, daysBefore = 3) => {
  if (!bill || !bill._id) throw new Error('Bill is required to replace reminders');
  const col = await remindersCollectionFn();
  // remove existing reminders for this bill
  await col.deleteMany({ billId: new ObjectId(bill._id) });
  // create new reminders according to rules
  return await createBillReminders(userId, bill, daysBefore);
};

export const syncRemindersForUser = async (userId, daysBefore = 3) => {
  if (!userId) throw new Error('userId is required');
  const col = await remindersCollectionFn();
  // load all bills for the user
  const bills = await billsData.getBillsForUser(userId);

  for (const b of bills) {
    try {
      const existing = await col.findOne({ billId: new ObjectId(b._id) });
      if (!existing) {
        // create reminders for bills that have none
        await createBillReminders(userId, b, daysBefore);
      }
    } catch (err) {
      console.error('Error syncing reminders for bill', b._id, err);
      continue;
    }
  }
};
