export const up = async (db) => {
  await db.collection("shares").createIndex({ token: 1 }, { unique: true });
  await db.collection("shares").createIndex({ resourceType: 1, resourceId: 1 });
  await db.collection("shares").createIndex({ ownerId: 1 });
};

export const down = async (db) => {
  await db.collection("shares").dropIndex("token_1").catch(() => {});
  await db.collection("shares").dropIndex("resourceType_1_resourceId_1").catch(() => {});
  await db.collection("shares").dropIndex("ownerId_1").catch(() => {});
};
