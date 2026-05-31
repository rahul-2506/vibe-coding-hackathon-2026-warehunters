-- Table to store scientific and practical grounding data for RAG
DROP TABLE IF EXISTS knowledge_base;
CREATE TABLE IF NOT EXISTS knowledge_base (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category VARCHAR(50) NOT NULL, -- 'scientific' or 'practical'
    topic VARCHAR(100) NOT NULL,    -- e.g., 'Salicylic Acid', 'Pore Science'
    sub_topic VARCHAR(100),
    content TEXT NOT NULL,
    keywords TEXT,                   -- Comma-separated for retrieval
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster keyword searching
CREATE FULLTEXT INDEX idx_knowledge_keywords ON knowledge_base(keywords, topic);
