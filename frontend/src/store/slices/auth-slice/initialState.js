export const authInitialState = {
  isAuthenticated: false,
  user: null,
  error: null,
  isAuthLoading: true, // true until bootstrapAuth() resolves (GET /users/me)
  loginError: null,
  networkError: null,
};
