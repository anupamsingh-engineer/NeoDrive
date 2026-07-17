export const up = async (db) => {
  await db.collection("webhooklogs").createIndex({ userId: 1 });
  await db.collection("webhooklogs").createIndex({ createdAt: -1 });
};

export const down = async (db) => {
  await db.collection("webhooklogs").dropIndex("userId_1").catch(() => {});
  await db.collection("webhooklogs").dropIndex("createdAt_-1").catch(() => {});
};
