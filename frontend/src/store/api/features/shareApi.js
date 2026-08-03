import { baseApi } from "../baseApi";
import { API_ROUTES } from "../../../configs/apiRoutes";
import { API_CONFIG } from "../../../configs/apiConfig";

export const shareApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // POST /share — body: { resourceType, resourceId }. Idempotent: returns the existing
    // link if the resource is already shared, rather than minting a new token every time.
    createShare: builder.mutation({
      query: (body) => ({ url: API_ROUTES.SHARE.CREATE, method: "POST", body }),
      invalidatesTags: [{ type: "Share", id: "LIST" }],
    }),

    // GET /share — every active share link owned by the caller.
    listShares: builder.query({
      query: () => API_ROUTES.SHARE.LIST,
      providesTags: [{ type: "Share", id: "LIST" }],
    }),

    // DELETE /share/:shareId
    revokeShare: builder.mutation({
      query: (shareId) => ({ url: API_ROUTES.SHARE.REVOKE(shareId), method: "DELETE" }),
      invalidatesTags: [{ type: "Share", id: "LIST" }],
    }),

    // GET /s/:token?dirId= — public, but returns JSON (unlike a file download), so it's still
    // a normal RTK Query call rather than a plain href.
    getShareView: builder.query({
      query: ({ token, dirId }) => API_ROUTES.PUBLIC_SHARE.VIEW(token, dirId),
    }),
  }),
  overrideExisting: true,
});

// GET /s/:token/file/:fileId is a 302 redirect to a signed CloudFront URL, not JSON — use as a
// plain link (<a href> / <img src>), never as an RTK Query call. Mirrors getFileDownloadHref.
export function getShareFileHref(token, fileId, action) {
  return `${API_CONFIG.baseUrl}${API_ROUTES.PUBLIC_SHARE.DOWNLOAD(token, fileId, action)}`;
}

export const { useCreateShareMutation, useListSharesQuery, useRevokeShareMutation, useGetShareViewQuery } = shareApi;
