// The backend sets a non-httpOnly `csrfToken` cookie (signed double-submit pattern) on every
// login/register/google/refresh response. It rotates on every one of those, so it must be read
// fresh from document.cookie at request time rather than cached in Redux (which would go stale
// the moment a refresh rotates it without a corresponding Redux update).
export function getCsrfTokenFromCookie() {
  const match = document.cookie.split("; ").find((row) => row.startsWith("csrfToken="));
  return match ? decodeURIComponent(match.split("=")[1]) : null;
}
