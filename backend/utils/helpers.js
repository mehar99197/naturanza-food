const toNullableString = (value) => {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }
  return String(value).trim();
};

const toBoolean = (value, fallback = false) => {
  if (value === null || value === undefined) return fallback;
  const str = String(value).toLowerCase().trim();
  if (str === "true" || str === "1" || str === "yes") return true;
  if (str === "false" || str === "0" || str === "no") return false;
  return fallback;
};

module.exports = { toNullableString, toBoolean };
