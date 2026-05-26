---
name: reviewing-code-quality
description: Pre-finish quality gate for Naturanza Food code. Use right before declaring a backend (or frontend) change done, or when asked to review a diff for design principles, modularity, and convention adherence. Enforces SOLID/modular design, the project's layered conventions, security rules, and the mandatory dead-code-removal policy.
---

# Reviewing code quality

Run this as the final step of any change. Review the actual diff (`git diff`), not from memory. Report
findings grouped as **Must-fix** (blocks done) vs. **Consider** (optional). If something is clean, say so.

## Design principles

- **Single Responsibility / modularity:** each function and module does one thing. Controllers stay thin;
  business rules + SQL live in models; reusable logic lives in `utils/`. Flag fat controllers or duplicated logic.
- **DRY:** no copy-pasted blocks — extract a shared helper. Check whether a util/model function already exists before adding a new one.
- **Clear naming & cohesion:** names describe intent; related code lives together.
- **Small surface area:** export only what's needed; avoid leaking internals.

## Project conventions (backend)

- [ ] Every route handler wrapped in `asyncHandler(...)`; controllers contain **no try/catch**.
- [ ] All SQL is parameterized (`dbPool.query(sql, [params])`) — **zero** string interpolation of inputs.
- [ ] Domain errors thrown via `createModelError(message, statusCode, code)` from the model layer.
- [ ] POST/PUT/PATCH routes use `restrictBody(...fields)`; auth-sensitive bodies validated with zod.
- [ ] Correct middleware order: `authenticateToken` → role guard → `restrictBody` → `asyncHandler`.
- [ ] New routers registered in `index.js`; admin routes guarded by `isAdmin`/`requireSuperAdmin`.
- [ ] Money is `DECIMAL`/PKR; enums match DB definitions.

## Security

- [ ] No secrets, tokens, passwords, or PII in logs or responses.
- [ ] No new auth bypass; protected resources still check ownership/role.
- [ ] User input never reaches SQL, shell, or file paths unsanitized.

## Dead-code removal (MANDATORY — `.github/copilot-instructions.md`)

- [ ] No commented-out code blocks left behind.
- [ ] No duplicate or now-unused functions, imports, routes, or CSS.
- [ ] Replaced code is deleted, not left alongside the new version.
- [ ] The file is **cleaner** after the change than before.

## Output

Summarize pass/fail per section, list Must-fix items with `file:line`, and confirm the dead-code check
explicitly. Do not declare the task done while any Must-fix remains.
