const { z } = require("zod");

const emailSchema = z
  .string({ required_error: "Email is required" })
  .trim()
  .email("Invalid email address")
  .max(254, "Email is too long");

const passwordSchema = z
  .string({ required_error: "Password is required" })
  .min(12, "Password must be at least 12 characters")
  .max(128, "Password must be at most 128 characters")
  .regex(/[A-Z]/, "Password must include at least one uppercase letter")
  .regex(/[a-z]/, "Password must include at least one lowercase letter")
  .regex(/[0-9]/, "Password must include at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must include at least one special character");

const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(120, "Name must be at most 120 characters")
    .optional(),
}).strict();

const loginSchema = z.object({
  email: emailSchema,
  password: z
    .string({ required_error: "Password is required" })
    .min(1, "Password is required")
    .max(128, "Password is too long"),
}).strict();

// Refresh endpoint uses HttpOnly cookie, so body must be empty.
const refreshTokenSchema = z.object({}).strict();

const validationError = (issueMessage) => {
  const err = new Error(issueMessage || "Invalid request payload");
  err.statusCode = 400;
  err.code = "VALIDATION_ERROR";
  err.isOperational = true;
  return err;
};

const validateBody = (schema) => (req, res, next) => {
  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message;
    return next(validationError(firstIssue));
  }

  req.validatedBody = parsed.data;
  return next();
};

module.exports = {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  validateBody,
};
