export const selectAuthState = (state) => state.auth;
export const selectIsAuthenticated = (state) => state.auth.isAuthenticated;
export const selectCurrentUser = (state) => state.auth.user;
export const selectIsAuthLoading = (state) => state.auth.isAuthLoading;
export const selectLoginError = (state) => state.auth.loginError;
export const selectNetworkError = (state) => state.auth.networkError;
export const selectUserRole = (state) => state.auth.user?.role;
