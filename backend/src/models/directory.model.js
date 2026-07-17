import { model, Schema } from "mongoose";

const directorySchema = new Schema(
  {
    name: { type: String, required: true },
    size: { type: Number, required: true, default: 0 },
    userId: { type: Schema.Types.ObjectId, required: true },
    parentDirId: { type: Schema.Types.ObjectId, default: null, ref: "Directory" },
  },
  { timestamps: true }
);

directorySchema.index({ parentDirId: 1, userId: 1 });

const Directory = model("Directory", directorySchema);

export default Directory;
