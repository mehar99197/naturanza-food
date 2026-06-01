const { z } = require("zod");

const strongPassword = z
  .string({ required_error: "Password is required" })
  .min(12, "Password must be at least 12 characters")
  .max(128, "Password must be at most 128 characters")
  .regex(/[A-Z]/, "Password must include at least one uppercase letter")
  .regex(/[a-z]/, "Password must include at least one lowercase letter")
  .regex(/[0-9]/, "Password must include at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must include at least one special character");

const adminResetPasswordSchema = z
  .string({ required_error: "Password is required" })
  .min(12, "Admin password must be at least 12 characters")
  .max(128, "Password must be at most 128 characters")
  .regex(/[A-Z]/, "Password must include at least one uppercase letter")
  .regex(/[a-z]/, "Password must include at least one lowercase letter")
  .regex(/[0-9]/, "Password must include at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must include at least one special character");

const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(120),
  password: strongPassword,
  phone: z
    .string()
    .trim()
    .max(20)
    .optional()
    .or(z.literal("")),
  address: z
    .string()
    .trim()
    .max(500)
    .optional()
    .or(z.literal("")),
}).strict();

const loginSchema = z.object({
  email: z.string().trim().email().max(120),
  password: z.string().min(1).max(128),
}).strict();

const googleLoginSchema = z.object({
  idToken: z.string().min(20).max(4096),
}).strict();

const forgotPasswordSchema = z.object({
  email: z.string().trim().email().max(120),
}).strict();

const resetPasswordSchema = z.object({
  token: z.string().min(10).max(4096),
  newPassword: strongPassword,
}).strict();

const verifyEmailSchema = z.object({
  email: z.string().trim().email().max(120),
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code"),
}).strict();

const resendVerificationSchema = z.object({
  email: z.string().trim().email().max(120),
}).strict();

module.exports = {
  registerSchema,
  loginSchema,
  googleLoginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  strongPassword,
  adminResetPasswordSchema,
};
