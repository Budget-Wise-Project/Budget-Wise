import { ObjectId } from "mongodb";
import { bills as billsCollectionFn } from "../config/mongoCollections.js";

// History query for prior bills with filters.
export const getBillsHistoryForUser = async (
  userId,
  { startDate, endDate, status, searchTerm } = {}
) => {
  if (!userId) throw new Error("User id is required for history lookup.");

  const billsCollection = await billsCollectionFn();

  const matchStage = {
    userId: new ObjectId(userId),
  };

  if (startDate && endDate) {
    matchStage.dueDate = { $gte: startDate, $lt: endDate };
  }

  if (status && status.trim() !== "") {
    // Match status case-insensitively (e.g., "Paid", "paid").
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
          // Treat notes as a simple way to store tags for now.
          { notes: regex },
        ],
      },
    });
  }

  pipeline.push({ $sort: { dueDate: -1 } });

  const results = await billsCollection.aggregate(pipeline).toArray();

  // Map _id and nested ids to strings for templates.
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
