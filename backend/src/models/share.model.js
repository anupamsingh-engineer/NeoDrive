import { model, Schema } from "mongoose";

const shareSchema = new Schema(
  {
    // Public, unguessable link identifier - never the Mongo _id (avoids exposing/aiding
    // enumeration of internal ids, same rationale as the parentDirId ownership-guessing fix
    // in directory.service.js).
    token: { type: String, required: true, unique: true },
    resourceType: { type: String, enum: ["File", "Directory"], required: true },
    resourceId: { type: Schema.Types.ObjectId, required: true, refPath: "resourceType" },
    ownerId: { type: Schema.Types.ObjectId, required: true, ref: "User" },
  },
  { timestamps: true }
);

shareSchema.index({ resourceType: 1, resourceId: 1 });
shareSchema.index({ ownerId: 1 });

const Share = model("Share", shareSchema);

export default Share;
