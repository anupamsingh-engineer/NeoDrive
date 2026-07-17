import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password can be at most 72 characters")
  .regex(/[a-z]/, "Password must contain a lowercase letter")
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/\d/, "Password must contain a digit")
  .regex(/[^a-zA-Z0-9]/, "Password must contain a special character");

const emailSchema = z.string().email("Please enter a valid email").toLowerCase();

const otpDigitsSchema = z.string().regex(/^\d{6}$/, "Please enter a valid 6 digit OTP");

export const sendOtpSchema = z.object({
  email: emailSchema,
});

export const verifyOtpSchema = z.object({
  email: emailSchema,
  otp: otpDigitsSchema,
});

export const registerSchema = z.object({
  name: z.string().min(3, "Name should be at least 3 characters").max(100, "Name can be at max 100 characters"),
  email: emailSchema,
  password: passwordSchema,
  otp: otpDigitsSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

export const googleLoginSchema = z.object({
  idToken: z.string().min(1, "idToken is required"),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: passwordSchema,
});
