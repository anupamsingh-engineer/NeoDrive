import { baseApi } from "../baseApi";
import { API_ROUTES } from "../../../configs/apiRoutes";

export const directoryApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // GET /directory or /directory/:dirId (omitted = caller's root)
    getDirectory: builder.query({
      query: (dirId) => API_ROUTES.DIRECTORY.GET(dirId),
      providesTags: (result, error, dirId) => [
        { type: "Directory", id: dirId || "ROOT" },
        { type: "Directory", id: "LIST" },
      ],
    }),

    // POST /directory or /directory/:parentDirId — folder name goes in a request header,
    // not the body, matching the backend's actual (slightly unusual) contract.
    createDirectory: builder.mutation({
      query: ({ parentDirId, dirname }) => ({
        url: API_ROUTES.DIRECTORY.CREATE(parentDirId),
        method: "POST",
        headers: { dirname: dirname || "New Folder" },
      }),
      invalidatesTags: [{ type: "Directory", id: "LIST" }],
    }),

    // PATCH /directory/:dirId — body: { newDirName }
    renameDirectory: builder.mutation({
      query: ({ dirId, newDirName }) => ({
        url: API_ROUTES.DIRECTORY.RENAME(dirId),
        method: "PATCH",
        body: { newDirName },
      }),
      invalidatesTags: [{ type: "Directory", id: "LIST" }],
    }),

    // DELETE /directory/:dirId — recursive delete, cannot target your own root directory
    deleteDirectory: builder.mutation({
      query: (dirId) => ({ url: API_ROUTES.DIRECTORY.DELETE(dirId), method: "DELETE" }),
      invalidatesTags: [{ type: "Directory", id: "LIST" }],
    }),
  }),
  overrideExisting: true,
});

export const {
  useGetDirectoryQuery,
  useCreateDirectoryMutation,
  useRenameDirectoryMutation,
  useDeleteDirectoryMutation,
} = directoryApi;
