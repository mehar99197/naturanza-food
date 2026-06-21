const { dbPool } = require("../config/db");

// The default About-page content mirrors the original hard-coded page, so the
// page looks identical until an admin edits it. Stored as a single JSON
// document in the about_content table (id = 1).
const DEFAULT_ABOUT_CONTENT = {
  hero: {
    eyebrow: "About Naturanza",
    titleTop: "Our Journey Towards",
    titleHighlight: "Natural Wellness",
    subtitle:
      "Since 2010, we have been on a mission to bring the healing power of nature to every home, one organic product at a time.",
  },
  story: {
    heading: "From Farm to Family",
    image: "/images/about-herbs.jpg",
    paragraphs: [
      "Naturanza Food was born from a simple belief: that nature provides everything we need to live healthy, vibrant lives. Our founder, after experiencing the transformative power of herbal remedies firsthand, set out to create a brand that would make these natural solutions accessible to everyone.",
      "We started small, working directly with local organic farmers who shared our passion for purity and sustainability. Today, we have grown into a trusted name in natural wellness, but our core values remain unchanged.",
      "Every product in our collection is a testament to our commitment to quality. From the moment a seed is planted to the final product reaching your doorstep, we ensure that every step meets our rigorous standards.",
    ],
  },
  stats: [
    { value: 14, suffix: "+", label: "Years Experience" },
    { value: 50, suffix: "K+", label: "Happy Customers" },
    { value: 100, suffix: "+", label: "Organic Products" },
    { value: 25, suffix: "+", label: "Partner Farms" },
  ],
  values: {
    eyebrow: "Our Values",
    heading: "What We Stand For",
    items: [
      { icon: "Leaf", title: "Purity First", description: "We never compromise on the purity of our products. Every item is tested for quality and authenticity." },
      { icon: "Heart", title: "Customer Care", description: "Your health and satisfaction are our top priorities. We are here to support your wellness journey." },
      { icon: "Globe", title: "Sustainability", description: "We are committed to eco-friendly practices, from sourcing to packaging, to protect our planet." },
      { icon: "Shield", title: "Transparency", description: "Full disclosure of ingredients and sourcing. Know exactly what you are putting in your body." },
    ],
  },
  team: {
    eyebrow: "Our Team",
    heading: "Meet the People Behind Naturanza",
  },
  certifications: {
    heading: "Our Certifications",
    subtitle: "Trusted and certified for your peace of mind",
    items: ["USDA Organic", "Non-GMO Project", "Fair Trade", "GMP Certified"],
  },
  sections: {
    story: true,
    stats: true,
    values: true,
    team: true,
    certifications: true,
  },
};

// Allowed lucide icon names for value cards (whitelist — keeps the frontend map small).
const ALLOWED_VALUE_ICONS = [
  "Leaf", "Heart", "Globe", "Shield", "Award", "Sparkles",
  "Sprout", "Sun", "Droplet", "Recycle", "HandHeart", "BadgeCheck",
];

const isPlainObject = (v) => v && typeof v === "object" && !Array.isArray(v);
const str = (v, fallback = "") => (v === undefined || v === null ? fallback : String(v));
const num = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const bool = (v, fallback = true) => (typeof v === "boolean" ? v : fallback);

// Sanitize an incoming content object against the schema, falling back to the
// current/default value for anything missing or malformed. Caps array sizes.
const sanitizeContent = (input = {}, base = DEFAULT_ABOUT_CONTENT) => {
  const src = isPlainObject(input) ? input : {};

  const hero = isPlainObject(src.hero) ? src.hero : {};
  const story = isPlainObject(src.story) ? src.story : {};
  const values = isPlainObject(src.values) ? src.values : {};
  const team = isPlainObject(src.team) ? src.team : {};
  const certifications = isPlainObject(src.certifications) ? src.certifications : {};
  const sections = isPlainObject(src.sections) ? src.sections : {};

  return {
    hero: {
      eyebrow: str(hero.eyebrow, base.hero.eyebrow).slice(0, 80),
      titleTop: str(hero.titleTop, base.hero.titleTop).slice(0, 160),
      titleHighlight: str(hero.titleHighlight, base.hero.titleHighlight).slice(0, 160),
      subtitle: str(hero.subtitle, base.hero.subtitle).slice(0, 600),
    },
    story: {
      heading: str(story.heading, base.story.heading).slice(0, 160),
      image: str(story.image, base.story.image).slice(0, 500),
      paragraphs: (Array.isArray(story.paragraphs) ? story.paragraphs : base.story.paragraphs)
        .slice(0, 8)
        .map((p) => str(p).slice(0, 1500))
        .filter((p) => p.trim().length > 0),
    },
    stats: (Array.isArray(src.stats) ? src.stats : base.stats)
      .slice(0, 8)
      .map((s) => ({
        value: num(s?.value, 0),
        suffix: str(s?.suffix, "").slice(0, 6),
        label: str(s?.label, "").slice(0, 60),
      }))
      .filter((s) => s.label.trim().length > 0),
    values: {
      eyebrow: str(values.eyebrow, base.values.eyebrow).slice(0, 80),
      heading: str(values.heading, base.values.heading).slice(0, 160),
      items: (Array.isArray(values.items) ? values.items : base.values.items)
        .slice(0, 8)
        .map((it) => ({
          icon: ALLOWED_VALUE_ICONS.includes(str(it?.icon)) ? str(it.icon) : "Leaf",
          title: str(it?.title, "").slice(0, 80),
          description: str(it?.description, "").slice(0, 500),
        }))
        .filter((it) => it.title.trim().length > 0),
    },
    team: {
      eyebrow: str(team.eyebrow, base.team.eyebrow).slice(0, 80),
      heading: str(team.heading, base.team.heading).slice(0, 160),
    },
    certifications: {
      heading: str(certifications.heading, base.certifications.heading).slice(0, 160),
      subtitle: str(certifications.subtitle, base.certifications.subtitle).slice(0, 300),
      items: (Array.isArray(certifications.items) ? certifications.items : base.certifications.items)
        .slice(0, 12)
        .map((c) => str(c).slice(0, 60))
        .filter((c) => c.trim().length > 0),
    },
    sections: {
      story: bool(sections.story, base.sections.story),
      stats: bool(sections.stats, base.sections.stats),
      values: bool(sections.values, base.sections.values),
      team: bool(sections.team, base.sections.team),
      certifications: bool(sections.certifications, base.sections.certifications),
    },
  };
};

const getAboutContent = async (connection = null) => {
  const db = connection || dbPool;
  const [rows] = await db.query("SELECT content FROM about_content WHERE id = 1 LIMIT 1");
  if (!rows.length) {
    return DEFAULT_ABOUT_CONTENT;
  }
  try {
    const parsed = JSON.parse(rows[0].content);
    // Sanitize stored content against the schema so missing keys fall back to defaults.
    return sanitizeContent(parsed);
  } catch {
    return DEFAULT_ABOUT_CONTENT;
  }
};

const updateAboutContent = async (connection = null, updates = {}) => {
  const db = connection || dbPool;
  const current = await getAboutContent(db);
  // Merge incoming over current, then sanitize the whole thing.
  const merged = sanitizeContent({ ...current, ...updates }, current);
  const json = JSON.stringify(merged);
  await db.query(
    `INSERT INTO about_content (id, content) VALUES (1, ?)
     ON DUPLICATE KEY UPDATE content = VALUES(content)`,
    [json],
  );
  return merged;
};

module.exports = {
  DEFAULT_ABOUT_CONTENT,
  ALLOWED_VALUE_ICONS,
  getAboutContent,
  updateAboutContent,
};
