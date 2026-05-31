CREATE DATABASE IF NOT EXISTS ai_recommender;

USE ai_recommender;

DROP TABLE IF EXISTS recommendation_cache;
DROP TABLE IF EXISTS synthetic_reviews;
DROP TABLE IF EXISTS reviews;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS product_scientific_verifiers;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    preferences JSON DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) DEFAULT '',
    name VARCHAR(255) DEFAULT '',
    description TEXT,
    explanation TEXT,
    features JSON DEFAULT NULL,
    category VARCHAR(100),
    price DECIMAL(10, 2) NOT NULL,
    rating DECIMAL(3, 2),
    brand VARCHAR(100) DEFAULT 'Generic',
    stock INT DEFAULT 0,
    thumbnail VARCHAR(255),
    image_url VARCHAR(255),
    images JSON DEFAULT NULL,
    trust_score INT DEFAULT 80,
    keywords JSON DEFAULT NULL,
    ai_summary_cache JSON DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reviews (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    rating INT NOT NULL,
    review_text TEXT NOT NULL,
    emoji VARCHAR(10),
    source VARCHAR(50) DEFAULT 'Customer',
    mentioned_ingredients TEXT,
    trust_score INT DEFAULT 100,
    verdict VARCHAR(20) DEFAULT 'Genuine',
    is_public BOOLEAN DEFAULT TRUE,
    user_id INT DEFAULT NULL,
    sentiment VARCHAR(20) DEFAULT 'neutral',
    authenticity_score INT DEFAULT 100,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS synthetic_reviews (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    rating INT NOT NULL,
    review_text TEXT NOT NULL,
    verdict VARCHAR(20) DEFAULT 'Suspicious',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS recommendation_cache (
    product_id INT PRIMARY KEY,
    recommendations JSON NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS product_scientific_verifiers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_name VARCHAR(255) NOT NULL,
    term VARCHAR(255) NOT NULL,
    category VARCHAR(100) DEFAULT 'general',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
