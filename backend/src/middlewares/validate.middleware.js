import { ApiError } from "../errors/ApiError.js";

export function validate(schema, source = "body") {
  return function (req, res, next) {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return next(ApiError.badRequest("Validation failed", result.error.flatten().fieldErrors));
    }
    req[source] = result.data;
    next();
  };
}
