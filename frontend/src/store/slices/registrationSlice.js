import { createSlice } from "@reduxjs/toolkit";

// Tracks progress through the 3-step signup wizard (email -> otp -> details) so a page reload
// mid-flow doesn't force the user back through email entry and a brand new OTP email - see
// pages/public/Register. Deliberately never stores the raw OTP (only good for one use, nothing
// worth persisting) or the password typed into the details step (kept in that component's own
// local state only) - only what's needed to resume: which step, which email, and the
// verificationToken issued by POST /auth/verify-otp once that email's OTP is confirmed.
export const registrationInitialState = {
  step: "email", // "email" | "otp" | "details"
  email: "",
  verificationToken: null,
  verificationTokenExpiresAt: null, // epoch ms, decoded client-side from the JWT's `exp` claim -
  // a UI hint only; the backend independently re-verifies signature + expiry on every
  // POST /auth/register call regardless, so nothing security-sensitive rides on this being accurate.
};

const registrationSlice = createSlice({
  name: "registration",
  initialState: registrationInitialState,
  reducers: {
    // After a successful send-otp: remember the email, move to the otp step. Also used when
    // bouncing back from the details step (e.g. an expired verificationToken at register time)
    // to re-enter the otp step without losing the known-good email.
    otpSent(state, action) {
      state.step = "otp";
      state.email = action.payload.email;
      state.verificationToken = null;
      state.verificationTokenExpiresAt = null;
    },
    // After a successful verify-otp: remember the token, move to the details step.
    otpVerified(state, action) {
      state.step = "details";
      state.verificationToken = action.payload.verificationToken;
      state.verificationTokenExpiresAt = action.payload.expiresAt;
    },
    // Registration finished (or the user explicitly restarted with a different email) - clear
    // everything so the next visit to this page starts fresh.
    registrationReset() {
      return registrationInitialState;
    },
  },
});

export const { otpSent, otpVerified, registrationReset } = registrationSlice.actions;
export default registrationSlice.reducer;

export const selectRegistration = (state) => state.registration;
