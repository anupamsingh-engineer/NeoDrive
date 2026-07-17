import { baseApi } from "../baseApi";
import { API_ROUTES } from "../../../configs/apiRoutes";
import { API_CONFIG } from "../../../configs/apiConfig";

export const fileApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // POST /file/upload/initiate — returns { uploadSignedUrl, fileId }.
    // The caller PUTs the raw file bytes to `uploadSignedUrl` directly (S3, not this API),
    // then calls uploadComplete. See pages/app/drive for the full 3-step flow.
    uploadInitiate: builder.mutation({
      query: (body) => ({ url: API_ROUTES.FILE.UPLOAD_INITIATE, method: "POST", body }),
    }),

    // POST /file/upload/complete — body: { fileId }
    uploadComplete: builder.mutation({
      query: (body) => ({ url: API_ROUTES.FILE.UPLOAD_COMPLETE, method: "POST", body }),
      invalidatesTags: [{ type: "Directory", id: "LIST" }],
    }),

    // PATCH /file/:fileId — body: { newFilename }
    renameFile: builder.mutation({
      query: ({ fileId, newFilename }) => ({
        url: API_ROUTES.FILE.RENAME(fileId),
        method: "PATCH",
        body: { newFilename },
      }),
      invalidatesTags: [{ type: "Directory", id: "LIST" }],
    }),

    // DELETE /file/:fileId
    deleteFile: builder.mutation({
      query: (fileId) => ({ url: API_ROUTES.FILE.DELETE(fileId), method: "DELETE" }),
      invalidatesTags: [{ type: "Directory", id: "LIST" }],
    }),
  }),
  overrideExisting: true,
});

// GET /file/:fileId is a 302 redirect to a signed CloudFront URL, not JSON — use as a plain
// link (<a href> / window.open), never as an RTK Query call.
export function getFileDownloadHref(fileId, action) {
  return `${API_CONFIG.baseUrl}${API_ROUTES.FILE.GET(fileId, action)}`;
}

export const {
  useUploadInitiateMutation,
  useUploadCompleteMutation,
  useRenameFileMutation,
  useDeleteFileMutation,
} = fileApi;
