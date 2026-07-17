import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithReauth } from "./baseQuery";

export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithReauth,
  tagTypes: ["User", "Directory"],
  endpoints: () => ({}),
  keepUnusedDataFor: 60,
  refetchOnFocus: true,
  refetchOnReconnect: true,
});
