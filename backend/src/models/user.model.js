import { model, Schema } from "mongoose";
import bcrypt from "bcrypt";
import env from "../config/env.js";
import { ROLES } from "../config/constants.js";

const userSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      minLength: [3, "name must be at least three characters"],
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, "please enter a valid email"],
    },
    // null for Google-only accounts (no local password set).
    password: {
      type: String,
      default: null,
      select: false,
    },
    rootDirId: {
      type: Schema.Types.ObjectId,
      ref: "Directory",
      required: true,
    },
    picture: {
      type: String,
      default:
        "https://static.vecteezy.com/system/resources/previews/002/318/271/non_2x/user-profile-icon-free-vector.jpg",
    },
    role: {
      type: String,
      enum: Object.values(ROLES),
      default: ROLES.USER,
    },
    maxStorageInBytes: {
      type: Number,
      required: true,
      default: env.storage.defaultMaxStorageBytes,
    },
    loginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
      default: null,
    },
    // any access token issued before this instant is rejected (admin/self "revoke all sessions").
    tokensValidAfter: {
      type: Date,
      default: null,
    },
    deleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

userSchema.index({ deleted: 1 });

userSchema.virtual("isLocked").get(function () {
  return Boolean(this.lockUntil && this.lockUntil > Date.now());
});

userSchema.pre("save", async function (next) {
  if (!this.isModified("password") || !this.password) return next();
  this.password = await bcrypt.hash(this.password, env.auth.bcryptSaltRounds);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toSafeJSON = function () {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    picture: this.picture,
    role: this.role,
    maxStorageInBytes: this.maxStorageInBytes,
  };
};

const User = model("User", userSchema);

export default User;
