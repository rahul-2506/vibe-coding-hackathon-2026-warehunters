USE ai_recommender;

-- Add Skincare Products to the products table
INSERT IGNORE INTO products (id, name, price, features, category, rating, image_url, explanation) 
VALUES 
(101, 'The Derma Co 1% Salicylic Acid Facewash', 300.00, '{"main_ingredient": "Salicylic Acid 1-2%", "benefit": "Unclogs pores, reduces acne", "skin_type": "Oily, acne-prone", "usage": "Twice daily, 60 second massage"}', 'Skincare', 4.2, 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=500&q=60', 'A highly effective exfoliating cleanser formulated with 1-2% Salicylic Acid. Designed specifically for oily and acne-prone skin, it penetrates deep into pores to dissolve sebum and prevent future breakouts. Best used with a 60-second massage for maximum contact time.'),
(102, 'Himalaya Purifying Neem Facewash', 150.00, '{"main_ingredient": "Neem & Turmeric", "benefit": "Antibacterial, clears skin", "skin_type": "All skin types", "usage": "Twice daily"}', 'Skincare', 4.3, 'https://images.unsplash.com/photo-1556228578-8c7c2f9a08e0?auto=format&fit=crop&w=500&q=60', 'A soap-free, herbal formulation that cleanses impurities and helps clear pimples. A natural blend of Neem and Turmeric brings together their antibacterial and antifungal properties to prevent the recurrence of acne over time.'),
(103, 'Mamaearth Ubtan Facewash', 325.00, '{"main_ingredient": "Turmeric & Saffron", "benefit": "Tan removal, skin brightening", "skin_type": "All skin types", "usage": "Twice daily"}', 'Skincare', 4.6, 'https://images.unsplash.com/photo-1612817288484-6f916006741a?auto=format&fit=crop&w=500&q=60', 'Inspired by traditional beauty secrets, this Ubtan facewash uses Turmeric and Saffron to deeply cleanse and brighten skin. It is effective in removing tan and restoring natural glow without stripping away essential moisture.');

-- Create Keywords Table
CREATE TABLE IF NOT EXISTS product_keywords (
    id INT AUTO_INCREMENT PRIMARY KEY,
    keyword VARCHAR(255) NOT NULL,
    skin_concern ENUM('acne', 'oily', 'dry', 'dull', 'normal') NOT NULL,
    keyword_type ENUM('problem', 'feature', 'general') NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    priority_score INT CHECK (priority_score BETWEEN 1 AND 10),
    UNIQUE KEY unique_kw (keyword, product_name)
);

-- Populate Keywords for The Derma Co
INSERT IGNORE INTO product_keywords (keyword, skin_concern, keyword_type, product_name, priority_score) VALUES
('pimples', 'acne', 'problem', 'The Derma Co facewash', 10),
('oily skin', 'oily', 'problem', 'The Derma Co facewash', 9),
('blackheads', 'acne', 'problem', 'The Derma Co facewash', 8),
('salicylic acid', 'acne', 'feature', 'The Derma Co facewash', 8),
('face bumps', 'acne', 'problem', 'The Derma Co facewash', 7),
('sebum control', 'oily', 'feature', 'The Derma Co facewash', 9),
('clear skin', 'acne', 'general', 'The Derma Co facewash', 8),
('dark spots', 'acne', 'problem', 'The Derma Co facewash', 7),
('hormonal acne', 'acne', 'problem', 'The Derma Co facewash', 9),
('greasy face', 'oily', 'problem', 'The Derma Co facewash', 8);

-- Populate Keywords for Himalaya
INSERT IGNORE INTO product_keywords (keyword, skin_concern, keyword_type, product_name, priority_score) VALUES
('natural facewash', 'normal', 'feature', 'Himalaya facewash', 8),
('neem facewash', 'acne', 'feature', 'Himalaya facewash', 9),
('daily wash', 'normal', 'general', 'Himalaya facewash', 7),
('herbal face wash', 'normal', 'feature', 'Himalaya facewash', 8),
('gentle cleanser', 'normal', 'general', 'Himalaya facewash', 9),
('chemical free', 'normal', 'feature', 'Himalaya facewash', 7),
('organic wash', 'normal', 'feature', 'Himalaya facewash', 8),
('mild facewash', 'normal', 'general', 'Himalaya facewash', 9),
('ayurvedic', 'normal', 'feature', 'Himalaya facewash', 8),
('safe for skin', 'normal', 'general', 'Himalaya facewash', 7);

-- Populate Keywords for Mamaearth
INSERT IGNORE INTO product_keywords (keyword, skin_concern, keyword_type, product_name, priority_score) VALUES
('glowing skin', 'dull', 'general', 'Mamaearth facewash', 9),
('dry skin', 'dry', 'problem', 'Mamaearth facewash', 10),
('hydration', 'dry', 'feature', 'Mamaearth facewash', 9),
('foaming wash', 'normal', 'feature', 'Mamaearth facewash', 7),
('ubtan facewash', 'dull', 'feature', 'Mamaearth facewash', 9),
('scrub wash', 'dull', 'feature', 'Mamaearth facewash', 8),
('vitamin c', 'dull', 'feature', 'Mamaearth facewash', 9),
('soft skin', 'dry', 'general', 'Mamaearth facewash', 8),
('moisture', 'dry', 'feature', 'Mamaearth facewash', 9),
('tan removal', 'dull', 'problem', 'Mamaearth facewash', 8);
