import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail } from "lucide-react";
import { useForgotPasswordMutation } from "../../../store/api/features/authApi";
import AuthCard from "../_shared/AuthCard";
import { Button, Input, InlineAlert } from "../../../components/ui";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ForgotPasswordPage = () => {
  const [forgotPassword, { isLoading }] = useForgotPasswordMutation();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setEmailError("Email is required");
      return;
    }
    if (!EMAIL_PATTERN.test(email)) {
      setEmailError("Enter a valid email");
      return;
    }
    setEmailError("");

    try {
      await forgotPassword({ email }).unwrap();
    } catch {
      // Intentionally ignored — always show the same success message
      // to prevent user enumeration (backend always returns 200).
    }
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <AuthCard title="Check your email">
        <InlineAlert
          type="success"
          title="If that email address is registered, a password reset link has been sent."
          description="The link is valid for 15 minutes. Check your spam folder if you don't see it."
        />
        <p className="text-center text-sm text-ink-soft">
          Remember your password?{" "}
          <Link to="/auth/login" className="font-medium text-brand hover:underline">
            Back to sign in
          </Link>
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Forgot password" subtitle="Enter your email and we'll send a reset link">
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <Input
          type="email"
          prefixIcon={Mail}
          placeholder="Email address"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={emailError}
        />
        <Button type="submit" variant="primary" size="lg" block loading={isLoading}>
          Send Reset Link
        </Button>
      </form>

      <p className="mt-5 text-center text-sm">
        <Link to="/auth/login" className="font-medium text-brand hover:underline">
          Back to sign in
        </Link>
      </p>
    </AuthCard>
  );
};

export default ForgotPasswordPage;
