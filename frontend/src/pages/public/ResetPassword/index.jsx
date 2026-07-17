import { useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { Lock } from "lucide-react";
import { useResetPasswordMutation } from "../../../store/api/features/authApi";
import AuthCard from "../_shared/AuthCard";
import { Button, Input, InlineAlert } from "../../../components/ui";

const PASSWORD_RULES = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [resetPassword, { isLoading }] = useResetPasswordMutation();

  const [values, setValues] = useState({ newPassword: "", confirmPassword: "" });
  const [fieldErrors, setFieldErrors] = useState({});
  const [errorMsg, setErrorMsg] = useState("");
  const [tokenExpired, setTokenExpired] = useState(false);
  const [success, setSuccess] = useState(false);

  const setField = (field) => (e) => setValues((v) => ({ ...v, [field]: e.target.value }));

  const validate = () => {
    const errors = {};
    if (!values.newPassword) errors.newPassword = "New password is required";
    else if (!PASSWORD_RULES.test(values.newPassword))
      errors.newPassword = "Min 8 chars with uppercase, lowercase, number & special character";

    if (!values.confirmPassword) errors.confirmPassword = "Please confirm your password";
    else if (values.confirmPassword !== values.newPassword) errors.confirmPassword = "Passwords do not match";

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    if (!validate()) return;

    try {
      await resetPassword({ token, password: values.newPassword }).unwrap();
      setSuccess(true);
      setTimeout(() => navigate("/auth/login"), 3000);
    } catch (err) {
      const status = err?.status;
      const msg = err?.data?.message || "Failed to reset password.";
      if (status === 400 || status === 401) setTokenExpired(true);
      else setErrorMsg(msg);
    }
  };

  if (!token || tokenExpired) {
    return (
      <AuthCard title="Link expired or invalid">
        <InlineAlert
          type="error"
          title="This reset link is invalid or has expired."
          description="Reset links are only valid for 15 minutes."
        />
        <Link to="/auth/forgot-password">
          <Button variant="primary" size="lg" block>
            Request a new reset link
          </Button>
        </Link>
      </AuthCard>
    );
  }

  if (success) {
    return (
      <AuthCard title="Password reset">
        <InlineAlert
          type="success"
          title="Password reset successfully!"
          description="You will be redirected to sign in shortly."
        />
        <Link to="/auth/login">
          <Button variant="primary" size="lg" block>
            Go to Sign In
          </Button>
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Reset your password" subtitle="Choose a strong new password">
      <InlineAlert type="error" title={errorMsg} />

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <Input
          type="password"
          prefixIcon={Lock}
          placeholder="New password"
          autoComplete="new-password"
          value={values.newPassword}
          onChange={setField("newPassword")}
          error={fieldErrors.newPassword}
        />
        <Input
          type="password"
          prefixIcon={Lock}
          placeholder="Confirm new password"
          autoComplete="new-password"
          value={values.confirmPassword}
          onChange={setField("confirmPassword")}
          error={fieldErrors.confirmPassword}
        />
        <Button type="submit" variant="primary" size="lg" block loading={isLoading}>
          Reset Password
        </Button>
      </form>
    </AuthCard>
  );
};

export default ResetPasswordPage;
