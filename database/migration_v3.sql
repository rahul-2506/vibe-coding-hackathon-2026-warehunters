USE ai_recommender;

-- Drop dependent tables first
DROP TABLE IF EXISTS recommendation_cache;
DROP TABLE IF EXISTS synthetic_reviews;
DROP TABLE IF EXISTS reviews;
DROP TABLE IF EXISTS products;

-- Recreate products with expanded inventory fields
CREATE TABLE products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    price DECIMAL(10, 2) NOT NULL,
    rating DECIMAL(3, 2),
    brand VARCHAR(100),
    stock INT DEFAULT 0,
    thumbnail VARCHAR(255),
    images JSON,
    trust_score INT DEFAULT 80,
    keywords JSON DEFAULT NULL,
    ai_summary_cache JSON DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Recreate reviews with expanded verification stats
CREATE TABLE reviews (
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

-- Create synthetic reviews table
CREATE TABLE synthetic_reviews (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    rating INT NOT NULL,
    review_text TEXT NOT NULL,
    verdict VARCHAR(20) DEFAULT 'Suspicious',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- Create recommendation cache table
CREATE TABLE recommendation_cache (
    product_id INT PRIMARY KEY,
    recommendations JSON NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);
