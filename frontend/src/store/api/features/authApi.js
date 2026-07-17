import { baseApi } from "../baseApi";
import { API_ROUTES } from "../../../configs/apiRoutes";

export const authApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // POST /auth/send-otp
    sendOtp: builder.mutation({
      query: (body) => ({ url: API_ROUTES.AUTH.SEND_OTP, method: "POST", body }),
    }),

    // POST /auth/verify-otp — standalone check, does not consume the OTP
    verifyOtp: builder.mutation({
      query: (body) => ({ url: API_ROUTES.AUTH.VERIFY_OTP, method: "POST", body }),
    }),

    // POST /auth/register — consumes the OTP, auto-logs-in on success
    register: builder.mutation({
      query: (body) => ({ url: API_ROUTES.AUTH.REGISTER, method: "POST", body }),
      invalidatesTags: ["User"],
    }),

    // POST /auth/login
    login: builder.mutation({
      query: (credentials) => ({ url: API_ROUTES.AUTH.LOGIN, method: "POST", body: credentials }),
      invalidatesTags: ["User"],
    }),

    // POST /auth/google
    loginWithGoogle: builder.mutation({
      query: (body) => ({ url: API_ROUTES.AUTH.GOOGLE, method: "POST", body }),
      invalidatesTags: ["User"],
    }),

    // POST /auth/refresh — also called automatically by baseQuery on a 401
    refresh: builder.mutation({
      query: () => ({ url: API_ROUTES.AUTH.REFRESH, method: "POST" }),
    }),

    // POST /auth/logout
    logout: builder.mutation({
      query: () => ({ url: API_ROUTES.AUTH.LOGOUT, method: "POST" }),
      invalidatesTags: ["User"],
    }),

    // POST /auth/logout-all
    logoutAll: builder.mutation({
      query: () => ({ url: API_ROUTES.AUTH.LOGOUT_ALL, method: "POST" }),
      invalidatesTags: ["User"],
    }),

    // POST /auth/forgot-password — always 200 (anti-enumeration)
    forgotPassword: builder.mutation({
      query: (body) => ({ url: API_ROUTES.AUTH.FORGOT_PASSWORD, method: "POST", body }),
    }),

    // POST /auth/reset-password — body: { token, password }
    resetPassword: builder.mutation({
      query: (body) => ({ url: API_ROUTES.AUTH.RESET_PASSWORD, method: "POST", body }),
    }),
  }),
  overrideExisting: true,
});

export const {
  useSendOtpMutation,
  useVerifyOtpMutation,
  useRegisterMutation,
  useLoginMutation,
  useLoginWithGoogleMutation,
  useRefreshMutation,
  useLogoutMutation,
  useLogoutAllMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
} = authApi;
