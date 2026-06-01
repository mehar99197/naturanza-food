/**
 * Creates the blog_posts table and seeds the initial posts (idempotent).
 * Run once:  node run-blog-migration.js
 */
const { db } = require("./config/db");

const CREATE_TABLE = `
CREATE TABLE IF NOT EXISTS blog_posts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  slug VARCHAR(200) NOT NULL UNIQUE,
  title VARCHAR(200) NOT NULL,
  excerpt VARCHAR(500),
  content LONGTEXT NOT NULL,
  author VARCHAR(120) DEFAULT 'Naturanza Food Team',
  category VARCHAR(80),
  image_url VARCHAR(255),
  read_time VARCHAR(40),
  keywords VARCHAR(500),
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  published_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_blog_published (is_published, published_at),
  INDEX idx_blog_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`;

const SEED_POSTS = [
  {
    slug: "pure-mountain-honey-benefits-uses",
    title: "Pure Mountain Honey: Benefits, Daily Uses & Why It Matters",
    excerpt:
      "Everything you need to know about pure, natural mountain honey — its real health benefits, the best ways to use it every day, and how to spot the genuine thing.",
    category: "Honey",
    read_time: "6 min read",
    featured: true,
    keywords:
      "pure honey Pakistan, mountain honey, natural honey benefits, raw honey, buy honey online Pakistan",
    content: `Pure honey is one of the oldest natural foods on earth — and one of the most misunderstood. Most of what sells in the market is blended, heated, or mixed with sugar syrup. Real, raw mountain honey is a completely different product: alive with enzymes, antioxidants and natural goodness.

## What makes mountain honey special

Our [Naturanza honey](/product/4) is harvested from mountain farms and minimally processed, so it keeps the natural enzymes and pollen that mass-produced honey loses during heavy heating and filtering.

- **Raw & unheated** — natural enzymes stay intact
- **No added sugar or syrup** — just honey
- **Rich, full flavour** — the taste of real flowers, not factory sweetness

## Health benefits of pure honey

| Benefit | How it helps |
|---|---|
| Natural energy | Easy-to-digest natural sugars for a steady lift |
| Soothes throat | A spoonful calms a sore or irritated throat |
| Antioxidants | Helps the body fight everyday oxidative stress |
| Better than sugar | A more natural sweetener for tea, milk and food |

## Easy ways to use honey every day

1. **Morning tonic** — warm water, lemon and a teaspoon of honey
2. **In tea & milk** — a natural sweetener instead of refined sugar
3. **On toast or with yogurt** — a quick, wholesome breakfast
4. **Before bed** — a small spoon to soothe the throat

## How to know it's pure

Pure honey is thick, drips in a steady stream, and has a natural aroma. If it's watery, foamy, or tastes only "sweet" with no depth, it's likely blended. (We cover home tests in our guide on **identifying pure honey**.)

Ready to taste the difference? Try our [pure mountain honey](/product/4) or [browse the full shop](/shop).`,
  },
  {
    slug: "ispaghol-husk-benefits-how-to-use",
    title: "Ispaghol Husk: Benefits for Digestion, Gut Health & How to Use It",
    excerpt:
      "Ispaghol husk (psyllium) is a gentle natural fibre that supports digestion, regularity and gut comfort. Here's what it does and exactly how to take it.",
    category: "Digestive Health",
    read_time: "6 min read",
    featured: true,
    keywords:
      "ispaghol husk benefits, psyllium husk Pakistan, ispaghol for digestion, natural fibre, gut health",
    content: `If your digestion feels sluggish or irregular, the answer is often simpler — and more natural — than you think. **Ispaghol husk** (also called psyllium) is a soluble fibre that has been used for generations to support comfortable, regular digestion.

## What is ispaghol husk?

Ispaghol is the husk of the *Plantago ovata* seed. It's almost pure soluble fibre: when mixed with water it forms a soft gel that gently moves through your digestive system. Our [Ispaghol Husk](/product/3) is natural fibre with nothing added.

## Key benefits

- **Supports regularity** — adds gentle bulk and softness for easier digestion
- **Gut comfort** — the soft gel soothes and supports the digestive tract
- **Feeling full** — fibre can help you feel satisfied for longer
- **Heart-friendly habit** — soluble fibre is part of a balanced, healthy diet

## How much and when

| When | How |
|---|---|
| Daily | 1–2 teaspoons, once or twice a day |
| With | A full glass of water or milk |
| Timing | Many people prefer it before bed or after meals |

> **Important:** Always take ispaghol with plenty of water, and drink water through the day. Fibre needs water to work gently.

## How to take it (step by step)

1. Add **1–2 teaspoons** of ispaghol husk to a full glass of water or milk
2. **Stir well** and drink immediately, before it thickens
3. Follow with **another glass of water**
4. Start with a small amount and build up over a few days

## Who should be careful

If you're pregnant, on medication, or have a medical condition, check with your doctor first. Take ispaghol separately from medicines (about 1–2 hours apart) so it doesn't affect absorption.

A small daily habit can make a real difference to how you feel. Try our [natural ispaghol husk](/product/3) or [explore the shop](/shop).`,
  },
  {
    slug: "how-to-identify-pure-honey-tests",
    title: "How to Identify Pure Honey: 7 Simple Tests You Can Do at Home",
    excerpt:
      "Worried your honey is mixed with sugar syrup? Try these 7 quick, at-home tests to check whether your honey is pure and natural.",
    category: "Honey",
    read_time: "5 min read",
    featured: false,
    keywords:
      "how to check pure honey, honey purity test at home, fake honey vs real honey, pure honey Pakistan",
    content: `Adulterated honey is everywhere — often cut with sugar syrup, glucose or water. The good news: you can run a few simple checks at home before you trust a jar.

## 1. The thumb test
Put a small drop on your thumb. Pure honey stays put and doesn't spread or run; fake honey is runny and spreads quickly.

## 2. The water test
Add a spoon of honey to a glass of water. Pure honey settles at the bottom as a lump; adulterated honey starts dissolving and clouds the water.

## 3. The thread test
Pure honey drips in a slow, continuous thread. Watery, broken dripping suggests it's been diluted.

## 4. The flame test (careful!)
A dry matchstick dipped in pure honey can still light, because pure honey doesn't hold moisture. Mixed honey often has water and resists lighting.

## 5. Crystallisation
Natural honey **crystallises** (turns grainy/solid) over time — this is a good sign, not a fault. Honey that never crystallises may be heavily processed.

## 6. Taste & aroma
Pure honey has a natural floral aroma and a rich, layered taste. If it just tastes flatly "sweet," be suspicious.

## 7. Read the label
Avoid jars listing glucose, fructose syrup or added sugar. Real honey should list one ingredient: **honey**.

---

No single test is perfect, but together they tell the story. The simplest path is to buy from a source you trust — our [pure mountain honey](/product/4) is raw and unblended. [Shop now](/shop).`,
  },
  {
    slug: "honey-vs-sugar-healthier-swap",
    title: "Honey vs Sugar: A Healthier Everyday Swap",
    excerpt:
      "Thinking of cutting back on refined sugar? Here's an honest look at how pure honey compares — and simple ways to make the switch.",
    category: "Honey",
    read_time: "4 min read",
    featured: false,
    keywords: "honey vs sugar, natural sweetener, replace sugar with honey, healthy sweetener Pakistan",
    content: `Refined white sugar gives sweetness and little else. Pure honey is still a sugar — so enjoy it in moderation — but it brings more along with it.

## The honest comparison

| | Refined Sugar | Pure Honey |
|---|---|---|
| Source | Heavily processed | Natural, minimally processed |
| Extras | None | Trace enzymes, antioxidants, aroma |
| Flavour | Flat sweetness | Rich, floral, complex |
| Use | Baking, drinks | Drinks, toast, yogurt, tonics |

## Why people make the switch

- A **more natural** sweetener with real flavour
- A little goes a long way — honey is sweeter, so you often use less
- Pairs beautifully with tea, milk, lemon water and breakfast

## Simple swaps to try

1. **Tea & coffee** — replace a sugar spoon with a smaller honey spoon
2. **Breakfast** — drizzle over yogurt, oats or toast instead of jam
3. **Lemon water** — warm water + lemon + honey to start the day

## A note on balance

Honey is still natural sugar, so it's about *better*, not *unlimited*. Used in place of refined sugar, [pure honey](/product/4) is a simple, tasty upgrade to your daily routine. [Visit the shop](/shop) to get started.`,
  },
];

(async () => {
  const pool = db.promise();
  try {
    console.log("Creating blog_posts table...");
    await pool.query(CREATE_TABLE);

    const [[{ count }]] = await pool.query("SELECT COUNT(*) AS count FROM blog_posts");
    if (count > 0) {
      console.log(`blog_posts already has ${count} rows — skipping seed (safe).`);
      process.exit(0);
    }

    for (const post of SEED_POSTS) {
      await pool.query(
        `INSERT INTO blog_posts
           (slug, title, excerpt, content, author, category, image_url, read_time, keywords, featured, is_published)
         VALUES (?, ?, ?, ?, 'Naturanza Food Team', ?, NULL, ?, ?, ?, TRUE)`,
        [
          post.slug,
          post.title,
          post.excerpt,
          post.content,
          post.category,
          post.read_time,
          post.keywords,
          post.featured ? 1 : 0,
        ],
      );
      console.log("seeded:", post.slug);
    }

    const [[{ total }]] = await pool.query("SELECT COUNT(*) AS total FROM blog_posts");
    console.log(`Done. blog_posts now has ${total} posts.`);
    process.exit(0);
  } catch (error) {
    console.error("BLOG MIGRATION ERROR:", error.message);
    process.exit(1);
  }
})();
