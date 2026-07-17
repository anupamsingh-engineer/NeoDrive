import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { User, Mail, Lock, Hash } from "lucide-react";
import { useSendOtpMutation, useRegisterMutation } from "../../../store/api/features/authApi";
import AuthCard from "../_shared/AuthCard";
import { Button, Input, InlineAlert } from "../../../components/ui";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Mirrors the backend's password.schema.js rules exactly (see FRONTEND_INTEGRATION_GUIDE.md).
const PASSWORD_RULES = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,72}$/;

const stepVariants = {
  initial: (direction) => ({ opacity: 0, x: direction > 0 ? 24 : -24 }),
  animate: { opacity: 1, x: 0, transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] } },
  exit: (direction) => ({ opacity: 0, x: direction > 0 ? -24 : 24, transition: { duration: 0.15 } }),
};

const RegisterPage = () => {
  const navigate = useNavigate();
  const [sendOtp, { isLoading: isSendingOtp }] = useSendOtpMutation();
  const [register, { isLoading: isRegistering }] = useRegisterMutation();

  const [step, setStep] = useState("email"); // "email" | "details"
  const [email, setEmail] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [otpSent, setOtpSent] = useState(false);

  const [emailFieldError, setEmailFieldError] = useState("");
  const [details, setDetails] = useState({ otp: "", name: "", password: "", confirmPassword: "" });
  const [detailErrors, setDetailErrors] = useState({});

  const setDetailField = (field) => (e) => setDetails((d) => ({ ...d, [field]: e.target.value }));

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    if (!email.trim()) {
      setEmailFieldError("Email is required");
      return;
    }
    if (!EMAIL_PATTERN.test(email)) {
      setEmailFieldError("Enter a valid email");
      return;
    }
    setEmailFieldError("");

    try {
      await sendOtp({ email }).unwrap();
      setStep("details");
      setOtpSent(true);
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

  const validateDetails = () => {
    const errors = {};
    if (!details.otp.trim()) errors.otp = "Code is required";
    else if (!/^\d{6}$/.test(details.otp)) errors.otp = "Enter the 6-digit code";

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
      await register({ name: details.name, email, password: details.password, otp: details.otp }).unwrap();
      navigate("/app/drive");
    } catch (err) {
      setErrorMsg(err?.data?.message || "Registration failed. Please try again.");
    }
  };

  const direction = step === "details" ? 1 : -1;

  return (
    <AuthCard
      title={step === "email" ? "Create account" : "Verify & create account"}
      subtitle={step === "email" ? "Enter your email to get started" : `Code sent to ${email}`}
    >
      <InlineAlert type="error" title={errorMsg} />
      {step === "details" && otpSent && !errorMsg && (
        <InlineAlert type="success" title="Verification code sent — check your inbox." />
      )}

      <AnimatePresence mode="wait" custom={direction} initial={false}>
        {step === "email" ? (
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
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
        ) : (
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
              prefixIcon={Hash}
              placeholder="6-digit code"
              maxLength={6}
              value={details.otp}
              onChange={setDetailField("otp")}
              error={detailErrors.otp}
            />
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
            <Button type="button" variant="ghost" size="sm" block loading={isSendingOtp} onClick={handleResendOtp}>
              Resend code
            </Button>
          </motion.form>
        )}
      </AnimatePresence>
    </AuthCard>
  );
};

export default RegisterPage;
