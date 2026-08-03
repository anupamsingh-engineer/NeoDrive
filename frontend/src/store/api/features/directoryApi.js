import { baseApi } from "../baseApi";
import { API_ROUTES } from "../../../configs/apiRoutes";
import { API_CONFIG } from "../../../configs/apiConfig";

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

// GET /directory/:dirId/download streams a zip archive directly (not JSON, and not a redirect
// like file downloads) — use as a plain link (<a href>), never as an RTK Query call.
export function getDirectoryDownloadHref(dirId) {
  return `${API_CONFIG.baseUrl}${API_ROUTES.DIRECTORY.DOWNLOAD(dirId)}`;
}

export const {
  useGetDirectoryQuery,
  useCreateDirectoryMutation,
  useRenameDirectoryMutation,
  useDeleteDirectoryMutation,
} = directoryApi;
