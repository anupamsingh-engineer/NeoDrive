export const up = async (db) => {
  await db.collection("users").createIndex({ email: 1 }, { unique: true });
  await db.collection("users").createIndex({ deleted: 1 });

  await db.collection("directories").createIndex({ parentDirId: 1, userId: 1 });

  await db.collection("files").createIndex({ parentDirId: 1, userId: 1 });

  await db.collection("otps").createIndex({ email: 1 }, { unique: true });
  await db.collection("otps").createIndex({ createdAt: 1 }, { expireAfterSeconds: 600 });

  await db.collection("refreshtokens").createIndex({ userId: 1 });
  await db.collection("refreshtokens").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

  await db.collection("subscriptions").createIndex(
    { razorpaySubscriptionId: 1 },
    { unique: true }
  );
  await db.collection("subscriptions").createIndex({ userId: 1 });
};

export const down = async (db) => {
  await db.collection("users").dropIndex("email_1").catch(() => {});
  await db.collection("users").dropIndex("deleted_1").catch(() => {});
  await db.collection("directories").dropIndex("parentDirId_1_userId_1").catch(() => {});
  await db.collection("files").dropIndex("parentDirId_1_userId_1").catch(() => {});
  await db.collection("otps").dropIndex("email_1").catch(() => {});
  await db.collection("otps").dropIndex("createdAt_1").catch(() => {});
  await db.collection("refreshtokens").dropIndex("userId_1").catch(() => {});
  await db.collection("refreshtokens").dropIndex("expiresAt_1").catch(() => {});
  await db.collection("subscriptions").dropIndex("razorpaySubscriptionId_1").catch(() => {});
  await db.collection("subscriptions").dropIndex("userId_1").catch(() => {});
};
