-- Blog CMS: admin-managed blog posts (replaces the hardcoded static blog data).
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
