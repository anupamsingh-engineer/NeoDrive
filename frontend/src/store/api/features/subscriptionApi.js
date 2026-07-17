import { baseApi } from "../baseApi";
import { API_ROUTES } from "../../../configs/apiRoutes";

export const subscriptionApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // GET /subscriptions/plans — static pricing/feature metadata, single source of truth
    // shared with the backend (backend/src/config/constants.js:SUBSCRIPTION_PLANS).
    getPlans: builder.query({
      query: () => API_ROUTES.SUBSCRIPTIONS.PLANS,
    }),

    // POST /subscriptions — body: { planId }, returns { subscriptionId } to hand to
    // Razorpay Checkout. maxStorageInBytes only updates once Razorpay's webhook fires.
    createSubscription: builder.mutation({
      query: (body) => ({ url: API_ROUTES.SUBSCRIPTIONS.CREATE, method: "POST", body }),
    }),
  }),
  overrideExisting: true,
});

export const { useGetPlansQuery, useCreateSubscriptionMutation } = subscriptionApi;
