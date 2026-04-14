const createSlug = (value, fallbackPrefix = "item") => {
  const source = String(value || "").trim().toLowerCase();
  const slug = source
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);

  if (slug) {
    return slug;
  }

  return `${fallbackPrefix}-${Date.now()}`;
};

module.exports = {
  createSlug,
};
