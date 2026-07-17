import { model, Schema } from "mongoose";

const fileSchema = new Schema(
  {
    name: { type: String, required: true },
    size: { type: Number, required: true },
    extension: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, required: true },
    isUploading: { type: Boolean, default: false },
    parentDirId: { type: Schema.Types.ObjectId, ref: "Directory", required: true },
  },
  { timestamps: true }
);

fileSchema.index({ parentDirId: 1, userId: 1 });

const File = model("File", fileSchema);

export default File;
