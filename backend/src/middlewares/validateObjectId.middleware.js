import { Types } from "mongoose";
import { ApiError } from "../errors/ApiError.js";

export function validateObjectId(req, res, next, id) {
  if (!Types.ObjectId.isValid(id)) {
    return next(ApiError.badRequest(`Invalid ID: ${id}`));
  }
  next();
}
