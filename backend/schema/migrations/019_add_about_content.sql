-- Migration 019: About-page content store
-- A single-row JSON document that lets the admin manage the entire About page
-- (hero, story, stats, values, certifications, section visibility) from the
-- dashboard. Team members stay in their own table. Re-runnable.

CREATE TABLE IF NOT EXISTS about_content (
    id INT PRIMARY KEY DEFAULT 1,
    content LONGTEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
