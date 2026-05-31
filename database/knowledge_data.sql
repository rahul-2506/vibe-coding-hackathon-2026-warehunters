USE ai_recommender;

-- Clear previous entries to avoid duplicates and ensure clean state
DELETE FROM knowledge_base;

-- ============================================================================
-- THE DERMA CO SALICYLIC ACID FACEWASH (10 Q&A)
-- ============================================================================

INSERT INTO knowledge_base (category, topic, sub_topic, content, keywords) VALUES
('practical', 'The Derma Co', 'Product Overview', 'The Derma Co facewash is a dermatology-based skincare product designed to cleanse the skin while targeting specific concerns like acne, oiliness, pigmentation, and dullness using active ingredients.', 'what is, overview, definition, derma co'),
('scientific', 'The Derma Co', 'Key Ingredients', 'Common active ingredients include Salicylic Acid (removes dead skin & unclogs pores), Niacinamide (controls oil & improves texture), Hyaluronic Acid (hydration), and Glycolic Acid (brightens).', 'ingredients, actives, salicylic, niacinamide, components'),
('scientific', 'The Derma Co', 'Mechanism of Action', 'The facewash combines surfactants with active ingredients. Salicylic Acid (a BHA) penetrates deep into pores to dissolve excess sebum and dead skin cells, effectively preventing acne formation.', 'how it works, scientific, mechanism, pores, sebum'),
('practical', 'The Derma Co', 'Skin Compatibility', 'Suitable variants exist for different types: Oily skin (Salicylic Acid), Dry skin (Hyaluronic Acid), and Sensitive skin (Mild, fragrance-free formulations).', 'suitable, skin types, dry, oily, sensitive'),
('practical', 'The Derma Co', 'Usage Protocol', 'Method: Wet face, take a small amount, gently massage for 30–60 seconds, and rinse. Frequency: Twice daily (morning and night).', 'how to use, instructions, frequency, massage, 60 seconds'),
('practical', 'The Derma Co', 'Key Benefits', 'Benefits include deep cleansing, effective acne and oil control, significantly improved skin texture, and maintaining a healthy moisture balance.', 'benefits, advantages, why use, improvement'),
('practical', 'The Derma Co', 'Safety & Side Effects', 'Potential side effects include dryness, mild irritation, or peeling due to active acids. These usually occur if the product is overused or not suitable for the specific skin type.', 'side effects, irritation, peeling, safety, dryness'),
('scientific', 'The Derma Co', 'Clinical Recommendation', 'Designed based on dermatological science; many variants are clinically tested for safety and effectiveness, making them highly recommended for active-led skincare.', 'dermatologist recommended, clinical, safety testing'),
('practical', 'The Derma Co', 'Teens & Adolescents', 'Suitable for teenagers, especially those with acne-prone skin. It is advised to choose mild formulations and avoid overuse of strong active acids initially.', 'teenagers, kids, young skin, acne'),
('scientific', 'The Derma Co', 'Product Differentiation', 'Unlike regular cleansers, it contains targeted active ingredients that solve specific skin problems rather than just removing surface dirt.', 'difference, normal facewash, why special, actives');

-- ============================================================================
-- HIMALAYA PURIFYING NEEM FACEWASH (10 Q&A)
-- ============================================================================

INSERT INTO knowledge_base (category, topic, sub_topic, content, keywords) VALUES
('practical', 'Himalaya', 'Product Overview', 'Himalaya Purifying Neem Facewash is a soap-free, herbal formulation that cleanses impurities and helps clear pimples using natural ingredients like Neem and Turmeric.', 'what is, himalaya, overview, neem wash'),
('scientific', 'Himalaya', 'Key Ingredients', 'Primary ingredients: Neem (antibacterial properties to kill problem-causing bacteria) and Turmeric (antiseptic and anti-inflammatory agent).', 'ingredients, neem, turmeric, herbal, natural'),
('scientific', 'Himalaya', 'Mechanism of Action', 'Uses a mild surfactant system that removes dirt without over-drying. Neem oil and leaves contain quercetin and nimbin which have direct antimicrobial action on acne-causing bacteria.', 'mechanism, how it works, antibacterial, antimicrobial'),
('practical', 'Himalaya', 'Skin Compatibility', 'Best suited for oily to combination skin that is prone to occasional breakouts. Its soap-free nature makes it gentle for daily use.', 'skin types, oily, combination, gentle'),
('practical', 'Himalaya', 'Usage Protocol', 'Moisten face, apply a small quantity and gently work up a lather using a circular motion. Wash off and pat dry. Use twice daily.', 'usage, instructions, circular motion, daily'),
('practical', 'Himalaya', 'Key Benefits', 'Effectively prevents recurrence of acne, removes excess oil without stripping moisture, and improves general skin health through herbal properties.', 'benefits, pimple prevention, oil control, healthy skin'),
('practical', 'Himalaya', 'Safety & Side Effects', 'Very high safety profile. Extremely rare cases of irritation. Does not cause the "purging" typically associated with chemical exfoliants.', 'safety, side effects, gentle, no purging'),
('scientific', 'Himalaya', 'Herbal Validation', 'A clinically tested formula based on Ayurvedic principles, combining traditional knowledge with modern safety standards.', 'clinical, ayurvedic, testing, herbal science'),
('practical', 'Himalaya', 'Teens & Adolescents', 'Highly recommended for teenagers as a first-line defense against puberty-induced breakouts due to its gentle, herbal composition.', 'teenagers, safe for kids, mild'),
('scientific', 'Himalaya', 'Product Differentiation', 'Distinguished by its herbal, soap-free approach. It relies on natural antibacterial agents rather than synthetic acids for acne control.', 'difference, herbal vs chemical, why himalaya');

-- ============================================================================
-- MAMAEARTH UBTAN FACEWASH (10 Q&A)
-- ============================================================================

INSERT INTO knowledge_base (category, topic, sub_topic, content, keywords) VALUES
('practical', 'Mamaearth', 'Product Overview', 'Mamaearth Ubtan Facewash is a brightening cleanser enriched with Turmeric, Saffron, and Walnut beads, designed to remove tan and restore natural glow.', 'what is, mamaearth, ubtan, brightening'),
('scientific', 'Mamaearth', 'Key Ingredients', 'Enriched with Turmeric (antioxidant), Saffron (brightening), Walnut Beads (physical exfoliation), and Carrot Seed Oil (tan removal).', 'ingredients, saffron, turmeric, walnut, carrot seed'),
('scientific', 'Mamaearth', 'Mechanism of Action', 'Uses walnut beads to physically exfoliate dead skin cells while Saffron and Turmeric inhibit melanin production to reduce tan and brighten the skin.', 'mechanism, tan removal, exfoliation, melanin, glow'),
('practical', 'Mamaearth', 'Skin Compatibility', 'Suitable for all skin types, especially those suffering from sun damage, tanning, and dullness.', 'skin types, tanning, dull skin, sun damage'),
('practical', 'Mamaearth', 'Usage Protocol', 'Apply on damp face and massage in upward circular motions. The walnut beads act as a mild scrub. Rinse thoroughly. Use twice daily.', 'usage, instructions, circular, scrub, daily'),
('practical', 'Mamaearth', 'Key Benefits', 'Removes sun tan, brightens skin tone, provides gentle exfoliation, and leaves skin feeling soft and supple.', 'benefits, glow, tan removal, soft skin'),
('practical', 'Mamaearth', 'Safety & Side Effects', 'Safe for most skin types. Over-scrubbing can lead to redness. It is free from SLS and parabens.', 'safety, side effects, sls free, redness'),
('scientific', 'Mamaearth', 'Toxic-Free Validation', 'Made-Safe certified and dermatologically tested to be free from harmful chemicals like sulfates, phthalates, and artificial colors.', 'dermatologically tested, made safe, toxic free'),
('practical', 'Mamaearth', 'Teens & Adolescents', 'Safe for teenagers looking for natural brightening and tan removal solutions.', 'teenagers, natural, brightening'),
('scientific', 'Mamaearth', 'Product Differentiation', 'Focuses on the traditional "Ubtan" concept, combining physical exfoliation with skin-brightening bio-actives for a "glow-focused" result.', 'difference, ubtan, traditional vs modern, glow');
