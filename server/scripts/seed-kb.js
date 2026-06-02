import { supabase } from '../db.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const kbData = [
    // The Derma Co
    { category: 'practical', topic: 'The Derma Co', sub_topic: 'Product Overview', content: 'The Derma Co facewash is a dermatology-based skincare product designed to cleanse the skin while targeting specific concerns like acne, oiliness, pigmentation, and dullness using active ingredients.', keywords: 'what is, overview, definition, derma co' },
    { category: 'scientific', topic: 'The Derma Co', sub_topic: 'Key Ingredients', content: 'Common active ingredients include Salicylic Acid (removes dead skin & unclogs pores), Niacinamide (controls oil & improves texture), Hyaluronic Acid (hydration), and Glycolic Acid (brightens).', keywords: 'ingredients, actives, salicylic, niacinamide, components' },
    { category: 'scientific', topic: 'The Derma Co', sub_topic: 'Mechanism of Action', content: 'The facewash combines surfactants with active ingredients. Salicylic Acid (a BHA) penetrates deep into pores to dissolve excess sebum and dead skin cells, effectively preventing acne formation.', keywords: 'how it works, scientific, mechanism, pores, sebum' },
    { category: 'practical', topic: 'The Derma Co', sub_topic: 'Skin Compatibility', content: 'Suitable variants exist for different types: Oily skin (Salicylic Acid), Dry skin (Hyaluronic Acid), and Sensitive skin (Mild, fragrance-free formulations).', keywords: 'suitable, skin types, dry, oily, sensitive' },
    { category: 'practical', topic: 'The Derma Co', sub_topic: 'Usage Protocol', content: 'Method: Wet face, take a small amount, gently massage for 30–60 seconds, and rinse. Frequency: Twice daily (morning and night).', keywords: 'how to use, instructions, frequency, massage, 60 seconds' },
    { category: 'practical', topic: 'The Derma Co', sub_topic: 'Key Benefits', content: 'Benefits include deep cleansing, effective acne and oil control, significantly improved skin texture, and maintaining a healthy moisture balance.', keywords: 'benefits, advantages, why use, improvement' },
    { category: 'practical', topic: 'The Derma Co', sub_topic: 'Safety & Side Effects', content: 'Potential side effects include dryness, mild irritation, or peeling due to active acids. These usually occur if the product is overused or not suitable for the specific skin type.', keywords: 'side effects, irritation, peeling, safety, dryness' },
    { category: 'scientific', topic: 'The Derma Co', sub_topic: 'Clinical Recommendation', content: 'Designed based on dermatological science; many variants are clinically tested for safety and effectiveness, making them highly recommended for active-led skincare.', keywords: 'dermatologist recommended, clinical, safety testing' },
    { category: 'practical', topic: 'The Derma Co', sub_topic: 'Teens & Adolescents', content: 'Suitable for teenagers, especially those with acne-prone skin. It is advised to choose mild formulations and avoid overuse of strong active acids initially.', keywords: 'teenagers, kids, young skin, acne' },
    { category: 'scientific', topic: 'The Derma Co', sub_topic: 'Product Differentiation', content: 'Unlike regular cleansers, it contains targeted active ingredients that solve specific skin problems rather than just removing surface dirt.', keywords: 'difference, normal facewash, why special, actives' },

    // Himalaya
    { category: 'practical', topic: 'Himalaya', sub_topic: 'Product Overview', content: 'Himalaya Purifying Neem Facewash is a soap-free, herbal formulation that cleanses impurities and helps clear pimples using natural ingredients like Neem and Turmeric.', keywords: 'what is, himalaya, overview, neem wash' },
    { category: 'scientific', topic: 'Himalaya', sub_topic: 'Key Ingredients', content: 'Primary ingredients: Neem (antibacterial properties to kill problem-causing bacteria) and Turmeric (antiseptic and anti-inflammatory agent).', keywords: 'ingredients, neem, turmeric, herbal, natural' },
    { category: 'scientific', topic: 'Himalaya', sub_topic: 'Mechanism of Action', content: 'Uses a mild surfactant system that removes dirt without over-drying. Neem oil and leaves contain quercetin and nimbin which have direct antimicrobial action on acne-causing bacteria.', keywords: 'mechanism, how it works, antibacterial, antimicrobial' },
    { category: 'practical', topic: 'Himalaya', sub_topic: 'Skin Compatibility', content: 'Best suited for Oily skin to combination skin that is prone to occasional breakouts. Its soap-free nature makes it gentle for daily use.', keywords: 'skin types, oily, combination, gentle' },
    { category: 'practical', topic: 'Himalaya', sub_topic: 'Usage Protocol', content: 'Moisten face, apply a small quantity and gently work up a lather using a circular motion. Wash off and pat dry. Use twice daily.', keywords: 'usage, instructions, circular motion, daily' },
    { category: 'practical', topic: 'Himalaya', sub_topic: 'Key Benefits', content: 'Effectively prevents recurrence of acne, removes excess oil without stripping moisture, and improves general skin health through herbal properties.', keywords: 'benefits, pimple prevention, oil control, healthy skin' },
    { category: 'practical', topic: 'Himalaya', sub_topic: 'Safety & Side Effects', content: 'Very high safety profile. Extremely rare cases of irritation. Does not cause the "purging" typically associated with chemical exfoliants.', keywords: 'safety, side effects, gentle, no purging' },
    { category: 'scientific', topic: 'Himalaya', sub_topic: 'Herbal Validation', content: 'A clinically tested formula based on Ayurvedic principles, combining traditional knowledge with modern safety standards.', keywords: 'clinical, ayurvedic, testing, herbal science' },
    { category: 'practical', topic: 'Himalaya', sub_topic: 'Teens & Adolescents', content: 'Highly recommended for teenagers as a first-line defense against puberty-induced breakouts due to its gentle, herbal composition.', keywords: 'teenagers, safe for kids, mild' },
    { category: 'scientific', topic: 'Himalaya', sub_topic: 'Product Differentiation', content: 'Distinguished by its herbal, soap-free approach. It relies on natural antibacterial agents rather than synthetic acids for acne control.', keywords: 'difference, herbal vs chemical, why himalaya' },

    // Mamaearth
    { category: 'practical', topic: 'Mamaearth', sub_topic: 'Product Overview', content: 'Mamaearth Ubtan Facewash is a brightening cleanser enriched with Turmeric, Saffron, and Walnut beads, designed to remove tan and restore natural glow.', keywords: 'what is, mamaearth, ubtan, brightening' },
    { category: 'scientific', topic: 'Mamaearth', sub_topic: 'Key Ingredients', content: 'Enriched with Turmeric (antioxidant), Saffron (brightening), Walnut Beads (physical exfoliation), and Carrot Seed Oil (tan removal).', keywords: 'ingredients, saffron, turmeric, walnut, carrot seed' },
    { category: 'scientific', topic: 'Mamaearth', sub_topic: 'Mechanism of Action', content: 'Uses walnut beads to physically exfoliate dead skin cells while Saffron and Turmeric inhibit melanin production to reduce tan and brighten the skin.', keywords: 'mechanism, tan removal, exfoliation, melanin, glow' },
    { category: 'practical', topic: 'Mamaearth', sub_topic: 'Skin Compatibility', content: 'Suitable for sun tan, sun damage, and dull skin.', keywords: 'skin types, tanning, dull skin, sun damage' },
    { category: 'practical', topic: 'Mamaearth', sub_topic: 'Usage Protocol', content: 'Apply on damp face and massage in upward circular motions. The walnut beads act as a mild scrub. Rinse thoroughly. Use twice daily.', keywords: 'usage, instructions, circular, scrub, daily' },
    { category: 'practical', topic: 'Mamaearth', sub_topic: 'Key Benefits', content: 'Removes sun tan, brightens skin tone, provides gentle exfoliation, and leaves skin feeling soft and supple.', keywords: 'benefits, glow, tan removal, soft skin' },
    { category: 'practical', topic: 'Mamaearth', sub_topic: 'Safety & Side Effects', content: 'Safe for most skin types. Over-scrubbing can lead to redness. It is free from SLS and parabens.', keywords: 'safety, side effects, sls free, redness' },
    { category: 'scientific', topic: 'Mamaearth', sub_topic: 'Toxic-Free Validation', content: 'Made-Safe certified and dermatologically tested to be free from harmful chemicals like sulfates, phthalates, and artificial colors.', keywords: 'dermatologically tested, made safe, toxic free' },
    { category: 'practical', topic: 'Mamaearth', sub_topic: 'Teens & Adolescents', content: 'Safe for teenagers looking for natural brightening and tan removal solutions.', keywords: 'teenagers, natural, brightening' },
    { category: 'scientific', topic: 'Mamaearth', sub_topic: 'Product Differentiation', content: 'Focuses on the traditional "Ubtan" concept, combining physical exfoliation with skin-brightening bio-actives for a "glow-focused" result.', keywords: 'difference, ubtan, traditional vs modern, glow' }
];

async function seedKB() {
    console.log('🌱 Seeding knowledge_base table...');
    
    // First clear existing if any (failsafe)
    const { error: delError } = await supabase
        .from('knowledge_base')
        .delete()
        .neq('category', 'non-existent');

    if (delError) {
        console.warn('⚠️ Note: Could not clear existing KB rows:', delError.message);
    }

    const { data, error } = await supabase
        .from('knowledge_base')
        .insert(kbData)
        .select();

    if (error) {
        console.error('❌ Seeding KB failed:', error.message);
    } else {
        console.log(`✅ Seeding KB complete! Successfully inserted ${data.length} records.`);
    }
}

seedKB();
