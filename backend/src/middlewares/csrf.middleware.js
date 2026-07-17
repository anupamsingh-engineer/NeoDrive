import crypto from "node:crypto";
import env from "../config/env.js";
import { ApiError } from "../errors/ApiError.js";
import { COOKIE_NAMES } from "../config/constants.js";
import { csrfTokenCookieOptions } from "../utils/cookies.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function sign(random) {
  return crypto.createHmac("sha256", env.csrf.secret).update(random).digest("hex");
}

// Signed double-submit cookie token: `${random}.${hmac(random)}`. The signature ties the
// cookie value to our server secret, so an attacker who can only plant a matching cookie
// (e.g. via a related subdomain) still can't forge a header value that verifies.
export function generateCsrfToken() {
  const random = crypto.randomBytes(32).toString("hex");
  return `${random}.${sign(random)}`;
}

export function setCsrfCookie(res) {
  const token = generateCsrfToken();
  res.cookie(COOKIE_NAMES.CSRF_TOKEN, token, csrfTokenCookieOptions());
  return token;
}

function isValidToken(token) {
  if (typeof token !== "string") return false;
  const [random, signature] = token.split(".");
  if (!random || !signature) return false;
  const expected = sign(random);
  const expectedBuf = Buffer.from(expected, "hex");
  const actualBuf = Buffer.from(signature, "hex");
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

// Bearer-token requests carry no ambient cookie, so they're not vulnerable to CSRF - only
// cookie-authenticated requests need the double-submit check.
export function verifyCsrf(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  if (req.headers.authorization?.startsWith("Bearer ")) return next();

  const cookieToken = req.cookies?.[COOKIE_NAMES.CSRF_TOKEN];
  const headerToken = req.headers["x-csrf-token"];

  if (!cookieToken || !headerToken || cookieToken !== headerToken || !isValidToken(cookieToken)) {
    return next(ApiError.forbidden("Invalid or missing CSRF token"));
  }

  next();
}
