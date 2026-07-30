import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AnimatePresence, motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { User, Mail, Lock, Hash, ArrowLeft } from "lucide-react";
import {
  useSendOtpMutation,
  useVerifyOtpMutation,
  useRegisterMutation,
} from "../../../store/api/features/authApi";
import {
  selectRegistration,
  otpSent,
  otpVerified,
  registrationReset,
} from "../../../store/slices/registrationSlice";
import { getJwtExpiryMs } from "../../../utils/jwt";
import AuthCard from "../_shared/AuthCard";
import { Button, Input, InlineAlert } from "../../../components/ui";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Mirrors the backend's password.schema.js rules exactly (see backend/docs/frontend-integration-guide.md).
const PASSWORD_RULES = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,72}$/;

// Three separate steps rather than "OTP + details on one screen": verifying the code happens
// (via POST /auth/verify-otp, which now consumes the OTP and returns a verificationToken - see
// backend/docs/authentication.md#post-authverify-otp) before the user ever fills in name/
// password, so a wrong or expired code fails right there instead of discarding a filled-out
// form. `step`/`email`/`verificationToken` live in the persisted `registration` Redux slice
// (registrationSlice.js), not local component state, specifically so a page reload mid-flow
// resumes here instead of forcing the user back through email entry and a new OTP email. Name/
// password/otp-input stay in local state and are never persisted.
const STEPS = ["email", "otp", "details"];

const stepVariants = {
  initial: (direction) => ({ opacity: 0, x: direction > 0 ? 24 : -24 }),
  animate: { opacity: 1, x: 0, transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] } },
  exit: (direction) => ({ opacity: 0, x: direction > 0 ? -24 : 24, transition: { duration: 0.15 } }),
};

const RegisterPage = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { step, email, verificationToken } = useSelector(selectRegistration);

  const [sendOtp, { isLoading: isSendingOtp }] = useSendOtpMutation();
  const [verifyOtp, { isLoading: isVerifyingOtp }] = useVerifyOtpMutation();
  const [register, { isLoading: isRegistering }] = useRegisterMutation();

  const [direction, setDirection] = useState(1);
  const [emailInput, setEmailInput] = useState(email || "");
  const [otp, setOtp] = useState("");
  const [details, setDetails] = useState({ name: "", password: "", confirmPassword: "" });

  const [errorMsg, setErrorMsg] = useState("");
  const [emailFieldError, setEmailFieldError] = useState("");
  const [otpFieldError, setOtpFieldError] = useState("");
  const [detailErrors, setDetailErrors] = useState({});

  const setDetailField = (field) => (e) => setDetails((d) => ({ ...d, [field]: e.target.value }));

  const goToStep = (nextStep) => {
    setDirection(STEPS.indexOf(nextStep) > STEPS.indexOf(step) ? 1 : -1);
    setErrorMsg("");
  };

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    if (!emailInput.trim()) {
      setEmailFieldError("Email is required");
      return;
    }
    if (!EMAIL_PATTERN.test(emailInput)) {
      setEmailFieldError("Enter a valid email");
      return;
    }
    setEmailFieldError("");

    try {
      await sendOtp({ email: emailInput }).unwrap();
      goToStep("otp");
      dispatch(otpSent({ email: emailInput }));
    } catch (err) {
      setErrorMsg(err?.data?.message || "Failed to send OTP. Please try again.");
    }
  };

  const handleResendOtp = async () => {
    setErrorMsg("");
    try {
      await sendOtp({ email }).unwrap();
    } catch (err) {
      setErrorMsg(err?.data?.message || "Please wait before requesting another OTP.");
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    if (!/^\d{6}$/.test(otp)) {
      setOtpFieldError("Enter the 6-digit code");
      return;
    }
    setOtpFieldError("");

    try {
      const { data } = await verifyOtp({ email, otp }).unwrap();
      goToStep("details");
      dispatch(
        otpVerified({
          verificationToken: data.verificationToken,
          expiresAt: getJwtExpiryMs(data.verificationToken),
        }),
      );
    } catch (err) {
      setErrorMsg(err?.data?.message || "Invalid or expired code.");
    }
  };

  const handleChangeEmail = () => {
    goToStep("email");
    dispatch(registrationReset());
    setOtp("");
  };

  const validateDetails = () => {
    const errors = {};
    if (!details.name.trim()) errors.name = "Name is required";
    else if (details.name.trim().length < 3 || details.name.trim().length > 100)
      errors.name = "3–100 characters";

    if (!details.password) errors.password = "Password is required";
    else if (!PASSWORD_RULES.test(details.password))
      errors.password = "Min 8 chars with uppercase, lowercase, number & special character";

    if (!details.confirmPassword) errors.confirmPassword = "Please confirm your password";
    else if (details.confirmPassword !== details.password) errors.confirmPassword = "Passwords do not match";

    setDetailErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    if (!validateDetails()) return;

    try {
      await register({ name: details.name, email, password: details.password, verificationToken }).unwrap();
      dispatch(registrationReset());
      navigate("/app/drive");
    } catch (err) {
      const message = err?.data?.message || "Registration failed. Please try again.";
      // Most likely cause: verificationToken expired (30 min default) while filling this form.
      // Send back to re-verify with the still-known email rather than a dead-end retry that
      // would just fail the exact same way again.
      if (err?.status === 400 && /verif/i.test(message)) {
        setErrorMsg(message);
        goToStep("otp");
        dispatch(otpSent({ email }));
        return;
      }
      setErrorMsg(message);
    }
  };

  const stepTitle = step === "email" ? "Create account" : step === "otp" ? "Verify your email" : "Almost there";
  const stepSubtitle =
    step === "email"
      ? "Enter your email to get started"
      : step === "otp"
        ? `Code sent to ${email}`
        : `Choose a name and password for ${email}`;

  return (
    <AuthCard title={stepTitle} subtitle={stepSubtitle}>
      <InlineAlert type="error" title={errorMsg} />

      <AnimatePresence mode="wait" custom={direction} initial={false}>
        {step === "email" && (
          <motion.form
            key="email"
            custom={direction}
            variants={stepVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            onSubmit={handleRequestOtp}
            noValidate
            className="flex flex-col gap-4"
          >
            <Input
              type="email"
              prefixIcon={Mail}
              placeholder="Email address"
              autoComplete="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              error={emailFieldError}
            />
            <Button type="submit" variant="primary" size="lg" block loading={isSendingOtp}>
              Send verification code
            </Button>
            <p className="text-center text-sm text-ink-soft">
              Already have an account?{" "}
              <Link to="/auth/login" className="font-medium text-brand hover:underline">
                Sign in
              </Link>
            </p>
          </motion.form>
        )}

        {step === "otp" && (
          <motion.form
            key="otp"
            custom={direction}
            variants={stepVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            onSubmit={handleVerifyOtp}
            noValidate
            className="flex flex-col gap-4"
          >
            <Input
              prefixIcon={Hash}
              placeholder="6-digit code"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              error={otpFieldError}
            />
            <Button type="submit" variant="primary" size="lg" block loading={isVerifyingOtp}>
              Verify code
            </Button>
            <Button type="button" variant="ghost" size="sm" block loading={isSendingOtp} onClick={handleResendOtp}>
              Resend code
            </Button>
            <button
              type="button"
              onClick={handleChangeEmail}
              className="flex items-center justify-center gap-1 text-sm text-ink-soft hover:text-ink"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Change email
            </button>
          </motion.form>
        )}

        {step === "details" && (
          <motion.form
            key="details"
            custom={direction}
            variants={stepVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            onSubmit={handleRegister}
            noValidate
            className="flex flex-col gap-4"
          >
            <Input
              prefixIcon={User}
              placeholder="Full name"
              autoComplete="name"
              value={details.name}
              onChange={setDetailField("name")}
              error={detailErrors.name}
            />
            <Input
              type="password"
              prefixIcon={Lock}
              placeholder="Password"
              autoComplete="new-password"
              value={details.password}
              onChange={setDetailField("password")}
              error={detailErrors.password}
            />
            <Input
              type="password"
              prefixIcon={Lock}
              placeholder="Confirm password"
              autoComplete="new-password"
              value={details.confirmPassword}
              onChange={setDetailField("confirmPassword")}
              error={detailErrors.confirmPassword}
            />
            <Button type="submit" variant="primary" size="lg" block loading={isRegistering}>
              Create Account
            </Button>
          </motion.form>
        )}
      </AnimatePresence>
    </AuthCard>
  );
};

export default RegisterPage;
