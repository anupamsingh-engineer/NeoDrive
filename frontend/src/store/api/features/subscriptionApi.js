import { baseApi } from "../baseApi";
import { API_ROUTES } from "../../../configs/apiRoutes";

export const subscriptionApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // POST /subscriptions — body: { planId }, returns { subscriptionId } to hand to
    // Razorpay Checkout. maxStorageInBytes only updates once Razorpay's webhook fires.
    createSubscription: builder.mutation({
      query: (body) => ({ url: API_ROUTES.SUBSCRIPTIONS.CREATE, method: "POST", body }),
    }),
  }),
  overrideExisting: true,
});

export const { useCreateSubscriptionMutation } = subscriptionApi;
