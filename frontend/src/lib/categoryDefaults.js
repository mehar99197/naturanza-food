const CATEGORY_DESCRIPTION_DEFAULTS = {
  honey: 'Pure, raw, and naturally infused honey harvested from trusted mountain farms.',
  ispaghol: 'Natural psyllium husk fiber supporting everyday digestion and gut health.',
  'ispaghol-husk': 'Natural psyllium husk fiber supporting everyday digestion and gut health.',
  psyllium: 'Natural psyllium husk fiber supporting everyday digestion and gut health.',
  spices: '100% pure, chemical-free organic spices freshly ground for authentic taste.',
  'organic-spices': '100% pure, chemical-free organic spices freshly ground for authentic taste.',
  cereal: 'Wholesome, naturally milled whole grains and traditional organic cereals.',
};

const normalizeKey = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');

export function getCategoryDescription(category) {
  const existing = String(category?.description || '').trim();
  if (existing) {
    return existing;
  }

  const slugKey = normalizeKey(category?.slug);
  if (slugKey && CATEGORY_DESCRIPTION_DEFAULTS[slugKey]) {
    return CATEGORY_DESCRIPTION_DEFAULTS[slugKey];
  }

  const nameKey = normalizeKey(category?.name);
  if (nameKey && CATEGORY_DESCRIPTION_DEFAULTS[nameKey]) {
    return CATEGORY_DESCRIPTION_DEFAULTS[nameKey];
  }

  const searchable = `${slugKey} ${nameKey}`;
  if (searchable.includes('honey')) {
    return CATEGORY_DESCRIPTION_DEFAULTS.honey;
  }
  if (searchable.includes('ispaghol') || searchable.includes('psyllium')) {
    return CATEGORY_DESCRIPTION_DEFAULTS.ispaghol;
  }
  if (searchable.includes('spice') || searchable.includes('masala')) {
    return CATEGORY_DESCRIPTION_DEFAULTS.spices;
  }

  const displayName = String(category?.name || '').trim();
  if (displayName) {
    return `100% pure, naturally sourced ${displayName.toLowerCase()} from trusted farms.`;
  }

  return '100% pure, naturally sourced organic products from trusted farms.';
}

export { CATEGORY_DESCRIPTION_DEFAULTS };
