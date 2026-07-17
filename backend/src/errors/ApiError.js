export class ApiError extends Error {
  constructor(statusCode, message, details = undefined) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = "Bad request", details) {
    return new ApiError(400, message, details);
  }

  static unauthorized(message = "Not authenticated") {
    return new ApiError(401, message);
  }

  static forbidden(message = "Not authorized") {
    return new ApiError(403, message);
  }

  static notFound(message = "Not found") {
    return new ApiError(404, message);
  }

  static conflict(message = "Conflict") {
    return new ApiError(409, message);
  }

  static insufficientStorage(message = "Not enough storage") {
    return new ApiError(507, message);
  }

  static internal(message = "Something went wrong") {
    return new ApiError(500, message);
  }
}
