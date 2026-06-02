USE ai_recommender;

DROP TABLE IF EXISTS feedbacks;
CREATE TABLE IF NOT EXISTS feedbacks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_name VARCHAR(255) NOT NULL,
    rating INT NOT NULL,
    review_text TEXT NOT NULL,
    emoji VARCHAR(10) NOT NULL,
    source VARCHAR(50) NOT NULL,
    mentioned_ingredients TEXT,
    trust_score INT NOT NULL,
    verdict VARCHAR(20) NOT NULL,
    is_public BOOLEAN DEFAULT FALSE,
    user_id INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
