import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Lock } from "lucide-react";
import { useLoginMutation, useLoginWithGoogleMutation } from "../../../store/api/features/authApi";
import AuthCard from "../_shared/AuthCard";
import GoogleSignInButton from "../_shared/GoogleSignInButton";
import { Button, Input, InlineAlert } from "../../../components/ui";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const LoginPage = () => {
  const navigate = useNavigate();
  const [login, { isLoading }] = useLoginMutation();
  const [loginWithGoogle, { isLoading: isGoogleLoading }] = useLoginWithGoogleMutation();

  const [values, setValues] = useState({ email: "", password: "" });
  const [fieldErrors, setFieldErrors] = useState({});
  const [errorMsg, setErrorMsg] = useState("");

  const setField = (field) => (e) => setValues((v) => ({ ...v, [field]: e.target.value }));

  const validate = () => {
    const errors = {};
    if (!values.email.trim()) errors.email = "Email is required";
    else if (!EMAIL_PATTERN.test(values.email)) errors.email = "Enter a valid email";
    if (!values.password) errors.password = "Password is required";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    if (!validate()) return;

    try {
      await login({ email: values.email, password: values.password }).unwrap();
      navigate("/app/drive");
    } catch (err) {
      const status = err?.status;
      const msg = err?.data?.message || "";
      if (status === 401) setErrorMsg(msg || "Invalid email or password.");
      else if (status === 403) setErrorMsg(msg || "Your account is locked. Try again later.");
      else if (status === 400) setErrorMsg(msg);
      else setErrorMsg("Something went wrong. Please try again.");
    }
  };

  const handleGoogleCredential = async (idToken) => {
    setErrorMsg("");
    try {
      await loginWithGoogle({ idToken }).unwrap();
      navigate("/app/drive");
    } catch (err) {
      setErrorMsg(err?.data?.message || "Google sign-in failed.");
    }
  };

  return (
    <AuthCard title="Welcome back" subtitle="Sign in to your account">
      <InlineAlert type="error" title={errorMsg} />

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <Input
          type="email"
          prefixIcon={Mail}
          placeholder="Email address"
          autoComplete="email"
          value={values.email}
          onChange={setField("email")}
          error={fieldErrors.email}
        />
        <div>
          <Input
            type="password"
            prefixIcon={Lock}
            placeholder="Password"
            autoComplete="current-password"
            value={values.password}
            onChange={setField("password")}
            error={fieldErrors.password}
          />
          <div className="mt-2 text-right">
            <Link to="/auth/forgot-password" className="text-sm text-brand hover:underline">
              Forgot password?
            </Link>
          </div>
        </div>

        <Button type="submit" variant="primary" size="lg" block loading={isLoading}>
          Sign In
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-ink-faint">or</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <div className={isGoogleLoading ? "pointer-events-none opacity-60" : ""}>
        <GoogleSignInButton onCredential={handleGoogleCredential} />
      </div>

      <p className="mt-5 text-center text-sm text-ink-soft">
        Don&apos;t have an account?{" "}
        <Link to="/auth/register" className="font-medium text-brand hover:underline">
          Create one
        </Link>
      </p>
    </AuthCard>
  );
};

export default LoginPage;
