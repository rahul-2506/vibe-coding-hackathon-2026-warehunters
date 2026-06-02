USE ai_recommender;

-- Clear previous keywords for these specifically to start fresh
DELETE FROM product_keywords WHERE product_name IN ('The Derma Co facewash', 'Himalaya facewash', 'Mamaearth facewash');

-- Insert The Derma Co Facewash Keywords
INSERT IGNORE INTO product_keywords (keyword, skin_concern, keyword_type, product_name, priority_score) VALUES
('acne facewash', 'acne', 'feature', 'The Derma Co facewash', 10),
('pimple facewash', 'acne', 'feature', 'The Derma Co facewash', 10),
('salicylic acid 2%', 'acne', 'feature', 'The Derma Co facewash', 10),
('oily skin facewash', 'oily', 'feature', 'The Derma Co facewash', 9),
('60 second massage', 'acne', 'feature', 'The Derma Co facewash', 9),
('pore unclogging', 'oily', 'feature', 'The Derma Co facewash', 9),
('blackheads facewash', 'acne', 'problem', 'The Derma Co facewash', 8),
('best facewash for acne', 'acne', 'general', 'The Derma Co facewash', 10);

-- Insert Himalaya Facewash Keywords
INSERT IGNORE INTO product_keywords (keyword, skin_concern, keyword_type, product_name, priority_score) VALUES
('herbal facewash', 'normal', 'feature', 'Himalaya facewash', 8),
('neem facewash', 'acne', 'feature', 'Himalaya facewash', 10),
('antibacterial wash', 'acne', 'feature', 'Himalaya facewash', 9),
('gentle acne wash', 'acne', 'general', 'Himalaya facewash', 9),
('daily herbal wash', 'normal', 'general', 'Himalaya facewash', 8),
('natural pimple cure', 'acne', 'problem', 'Himalaya facewash', 9);

-- Insert Mamaearth Facewash Keywords
INSERT IGNORE INTO product_keywords (keyword, skin_concern, keyword_type, product_name, priority_score) VALUES
('glowing skin facewash', 'dull', 'feature', 'Mamaearth facewash', 10),
('brightening facewash', 'dull', 'feature', 'Mamaearth facewash', 10),
('ubtan facewash', 'dull', 'feature', 'Mamaearth facewash', 10),
('tan removal', 'dull', 'problem', 'Mamaearth facewash', 10),
('saffron facewash', 'dull', 'feature', 'Mamaearth facewash', 9),
('turmeric brightening', 'dull', 'feature', 'Mamaearth facewash', 9);
