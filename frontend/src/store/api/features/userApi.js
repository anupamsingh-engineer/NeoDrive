import { baseApi } from "../baseApi";
import { API_ROUTES } from "../../../configs/apiRoutes";

export const userApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // GET /users/me
    getCurrentUser: builder.query({
      query: () => API_ROUTES.USERS.ME,
      providesTags: ["User"],
    }),

    // GET /users?page&limit — Admin/Manager only
    getAllUsers: builder.query({
      query: ({ page = 1, limit = 20 } = {}) => ({
        url: API_ROUTES.USERS.LIST,
        params: { page, limit },
      }),
      providesTags: ["User"],
    }),

    // POST /users/:userId/logout — Admin/Manager only, force-ends every session for that user
    logoutUserById: builder.mutation({
      query: (userId) => ({ url: API_ROUTES.USERS.LOGOUT_BY_ID(userId), method: "POST" }),
      invalidatesTags: ["User"],
    }),

    // DELETE /users/:userId — Admin only, soft-delete (cannot target yourself)
    deleteUser: builder.mutation({
      query: (userId) => ({ url: API_ROUTES.USERS.DELETE(userId), method: "DELETE" }),
      invalidatesTags: ["User"],
    }),
  }),
  overrideExisting: true,
});

export const {
  useGetCurrentUserQuery,
  useLazyGetCurrentUserQuery,
  useGetAllUsersQuery,
  useLogoutUserByIdMutation,
  useDeleteUserMutation,
} = userApi;
