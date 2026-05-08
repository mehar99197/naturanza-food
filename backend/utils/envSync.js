const fs = require("fs/promises");
const path = require("path");

const ENV_PATH = path.join(__dirname, "..", ".env");
const DEFAULT_ADMIN_EMAIL = String(process.env.DEFAULT_ADMIN_EMAIL || "")
  .trim()
  .toLowerCase();

const formatEnvValue = (key, value, existingLine) => {
  const stringValue = String(value ?? "");
  const existingHasQuotes =
    typeof existingLine === "string" &&
    new RegExp(`^${key}="`).test(existingLine.trim());
  const needsQuotes = existingHasQuotes || /[\s#]/.test(stringValue);

  if (!needsQuotes) {
    return `${key}=${stringValue}`;
  }

  const escaped = stringValue.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
  return `${key}="${escaped}"`;
};

const updateEnvValue = async (key, value, envPath = ENV_PATH) => {
  const fileContent = await fs.readFile(envPath, "utf8");
  const newline = fileContent.includes("\r\n") ? "\r\n" : "\n";
  const lines = fileContent.split(/\r?\n/);
  let found = false;

  const updatedLines = lines.map((line) => {
    if (line.startsWith(`${key}=`)) {
      found = true;
      return formatEnvValue(key, value, line);
    }
    return line;
  });

  if (!found) {
    updatedLines.push(formatEnvValue(key, value));
  }

  const updatedContent = updatedLines.join(newline);
  if (updatedContent !== fileContent) {
    await fs.writeFile(envPath, updatedContent, "utf8");
  }
};

const syncDefaultAdminPassword = async (email, newPassword) => {
  const normalizedEmail = String(email || "").trim().toLowerCase();

  if (!normalizedEmail || !DEFAULT_ADMIN_EMAIL) {
    return false;
  }

  if (normalizedEmail !== DEFAULT_ADMIN_EMAIL) {
    return false;
  }

  await updateEnvValue("DEFAULT_ADMIN_PASSWORD", newPassword);
  process.env.DEFAULT_ADMIN_PASSWORD = String(newPassword ?? "");
  return true;
};

module.exports = { syncDefaultAdminPassword };
