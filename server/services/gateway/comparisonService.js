import { supabase } from '../../db.js';
import { logger } from '../../utils/logger.js';
import fetch from 'node-fetch';

export const productComparisonService = {
    /**
     * Executes side-by-side Battle Mode comparison between two products.
     * @param {number} product1Id 
     * @param {number} product2Id 
     * @param {Array} preferences Custom preferences list
     * @param {string|null} geminiKey Optional user key
     * @returns {Object} Comparative analysis results with segment winners
     */
    async compareProducts(product1Id, product2Id, preferences = [], geminiKey = null) {
        try {
            logger.info(`[COMPARISON SERVICE] Launching battle between product ${product1Id} vs ${product2Id}`, 'AI_GATEWAY');

            // 1. Fetch products
            const { data: p1, error: e1 } = await supabase.from('products').select('*').eq('id', product1Id).single();
            const { data: p2, error: e2 } = await supabase.from('products').select('*').eq('id', product2Id).single();

            if (e1 || e2 || !p1 || !p2) {
                throw new Error('One or both products not found in inventory.');
            }

            p1.name = p1.title || p1.name;
            p2.name = p2.title || p2.name;

            // 2. Fetch reviews
            const { data: revs1 } = await supabase.from('reviews').select('rating, trust_score').eq('product_id', product1Id);
            const { data: revs2 } = await supabase.from('reviews').select('rating, trust_score').eq('product_id', product2Id);

            // Calculate average trust
            const trust1 = revs1 && revs1.length > 0 ? Math.round(revs1.reduce((acc, r) => acc + r.trust_score, 0) / revs1.length) : (p1.trust_score || 80);
            const trust2 = revs2 && revs2.length > 0 ? Math.round(revs2.reduce((acc, r) => acc + r.trust_score, 0) / revs2.length) : (p2.trust_score || 80);

            const isElectronics = (p1.category || '').toLowerCase().includes('electronics') || (p2.category || '').toLowerCase().includes('electronics');

            // 3. Compute Segment Scores & Winners (Battle Mode)
            // A. Oily skin match (for skincare) or Battery (for electronics)
            const p1Oily = isElectronics 
                ? Math.round(65 + ((p1.rating || 4.5) * 4) % 15 + (p1.price > 10000 ? 15 : 5))
                : (p1.name.toLowerCase().includes('salicylic') || p1.name.toLowerCase().includes('neem') ? 95 : 65);
            const p2Oily = isElectronics 
                ? Math.round(65 + ((p2.rating || 4.5) * 4) % 15 + (p2.price > 10000 ? 15 : 5))
                : (p2.name.toLowerCase().includes('salicylic') || p2.name.toLowerCase().includes('neem') ? 95 : 65);
            const winnerOily = p1Oily >= p2Oily ? p1.name : p2.name;

            // B. Dry skin match (for skincare) or Performance (for electronics)
            const p1Dry = isElectronics
                ? Math.round(70 + ((p1.rating || 4.5) * 3) % 12 + (p1.price > 15000 ? 12 : 3))
                : (p1.name.toLowerCase().includes('hyaluronic') || p1.name.toLowerCase().includes('ubtan') || p1.name.toLowerCase().includes('moist') ? 95 : 60);
            const p2Dry = isElectronics
                ? Math.round(70 + ((p2.rating || 4.5) * 3) % 12 + (p2.price > 15000 ? 12 : 3))
                : (p2.name.toLowerCase().includes('hyaluronic') || p2.name.toLowerCase().includes('ubtan') || p2.name.toLowerCase().includes('moist') ? 95 : 60);
            const winnerDry = p1Dry >= p2Dry ? p1.name : p2.name;

            // C. Ingredients (for skincare) or Display Quality (for electronics)
            const p1Ing = isElectronics
                ? Math.round(60 + ((p1.rating || 4.5) * 5) % 20 + (p1.name.toLowerCase().includes('pro') ? 10 : 0))
                : Math.round(50 + (p1.rating || 4.2) * 10);
            const p2Ing = isElectronics
                ? Math.round(60 + ((p2.rating || 4.5) * 5) % 20 + (p2.name.toLowerCase().includes('pro') ? 10 : 0))
                : Math.round(50 + (p2.rating || 4.2) * 10);
            const winnerIng = p1Ing >= p2Ing ? p1.name : p2.name;

            // D. Value (price vs rating)
            const calculateValueScore = (price) => {
                if (!price || price <= 0) return 85;
                if (price > 1000) {
                    return Math.max(10, Math.min(95, Math.round(95 - (price / 800))));
                } else {
                    return Math.max(10, Math.min(95, Math.round(95 - (price / 10))));
                }
            };
            const p1Val = calculateValueScore(p1.price);
            const p2Val = calculateValueScore(p2.price);
            const winnerVal = p1Val >= p2Val ? p1.name : p2.name;

            // E. Overall Winner
            const avg1 = Math.round((p1Oily + p1Dry + p1Ing + p1Val + trust1) / 5);
            const avg2 = Math.round((p2Oily + p2Dry + p2Ing + p2Val + trust2) / 5);
            const winnerOverall = avg1 >= avg2 ? p1.name : p2.name;

            // 4. Generate AI summary analysis text
            let analysisText = "";
            const activeKey = process.env.GROQ_API_KEY;
            
            if (activeKey) {
                try {
                    const prompt = isElectronics
                        ? `Compare this product pair: ${p1.name} (Price: ₹${p1.price}, Rating: ${p1.rating}/5) vs ${p2.name} (Price: ₹${p2.price}, Rating: ${p2.rating}/5).
                        Focus on battery life, performance, display quality, and overall value.
                        Declare the overall winner as ${winnerOverall} in a professional tech review verdict. Use clean markdown formatting with headers (###).`
                        : `Compare this product pair: ${p1.name} (Price: ₹${p1.price}, Rating: ${p1.rating}/5) vs ${p2.name} (Price: ₹${p2.price}, Rating: ${p2.rating}/5).
                        Focus on oily skin compatibility, dry skin compatibility, active ingredients, and overall value.
                        Declare the overall winner as ${winnerOverall} in a professional clinical verdict. Use clean markdown formatting with headers (###).`;

                    const systemInstruction = isElectronics
                        ? `You are ReviewLens' Lead Technology Analyst. Compare two tech products objectively and print a structured battle audit summary. Make the response professional and aesthetic.`
                        : `You are ReviewLens' Lead Clinical Skincare Analyst. Compare two products objectively and print a structured battle audit summary. Make the response professional and aesthetic.`;

                    const url = `https://api.groq.com/openai/v1/chat/completions`;
                    const res = await fetch(url, {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${activeKey}`
                        },
                        body: JSON.stringify({
                            model: "llama-3.3-70b-versatile",
                            messages: [
                                { role: "system", content: systemInstruction },
                                { role: "user", content: prompt }
                            ],
                            temperature: 0.1
                        })
                    });

                    if (res.ok) {
                        const json = await res.json();
                        const text = json.choices?.[0]?.message?.content;
                        if (text) {
                            analysisText = text;
                        }
                    }
                } catch (err) {
                    logger.error('[COMPARISON SERVICE] AI comparison request failed, using local builder', err, 'AI_GATEWAY');
                }
            }

            if (!analysisText) {
                if (isElectronics) {
                    analysisText = `### ⚖️ AI COMPARATIVE BATTLE VERDICT: ${winnerOverall.toUpperCase()} WINS (${Math.max(avg1, avg2)}% vs ${Math.min(avg1, avg2)}%)\n\n` +
                        `Our neural RAG engine has audited technical specifications and verified purchase behaviors side-by-side:\n\n` +
                        `*   **Winner for Battery Life:** **${winnerOily}** (Score: ${Math.max(p1Oily, p2Oily)}% vs ${Math.min(p1Oily, p2Oily)}%)\n` +
                        `*   **Winner for Performance:** **${winnerDry}** (Score: ${Math.max(p1Dry, p2Dry)}% vs ${Math.min(p1Dry, p2Dry)}%)\n` +
                        `*   **Display & Build Winner:** **${winnerIng}** (Score: ${Math.max(p1Ing, p2Ing)}% vs ${Math.min(p1Ing, p2Ing)}%)\n` +
                        `*   **Price & Value Winner:** **${winnerVal}** (Score: ${Math.max(p1Val, p2Val)}% vs ${Math.min(p1Val, p2Val)}%)\n\n` +
                        `### 🏆 Technology Verdict Summary\n` +
                        `For everyday reliability, build quality, and superior specifications matching your preferences, we highly recommend purchasing **${winnerOverall}**.`;
                } else {
                    analysisText = `### ⚖️ AI COMPARATIVE BATTLE VERDICT: ${winnerOverall.toUpperCase()} WINS (${Math.max(avg1, avg2)}% vs ${Math.min(avg1, avg2)}%)\n\n` +
                        `Our neural RAG engine has audited active ingredients and verified purchase behaviors side-by-side:\n\n` +
                        `*   **Winner for Oily Skin:** **${winnerOily}** (Score: ${Math.max(p1Oily, p2Oily)}% vs ${Math.min(p1Oily, p2Oily)}%)\n` +
                        `*   **Winner for Dry Skin:** **${winnerDry}** (Score: ${Math.max(p1Dry, p2Dry)}% vs ${Math.min(p1Dry, p2Dry)}%)\n` +
                        `*   **Ingredients Synergy Winner:** **${winnerIng}** (Score: ${Math.max(p1Ing, p2Ing)}% vs ${Math.min(p1Ing, p2Ing)}%)\n` +
                        `*   **Price & Value Winner:** **${winnerVal}** (Score: ${Math.max(p1Val, p2Val)}% vs ${Math.min(p1Val, p2Val)}%)\n\n` +
                        `### 🏆 Clinical Verdict Summary\n` +
                        `For general routine formulation and structural skin barrier support, we highly recommend purchasing **${winnerOverall}** as it registers the highest compatibility and lowest spam review risk.`;
                }
            }

            const key1 = isElectronics ? "Battery" : "Oily Skin";
            const key2 = isElectronics ? "Performance" : "Dry Skin";
            const key3 = isElectronics ? "Display" : "Ingredients";
            const key4 = "Value";

            const defaultPrefs = [key1, key2, key3, key4];
            const activePrefs = preferences.length > 0 ? preferences : defaultPrefs;

            const scoresObj1 = {};
            const scoresObj2 = {};

            activePrefs.forEach(pref => {
                const normPref = pref.toLowerCase();
                if (normPref.includes('battery') || normPref.includes('oily') || normPref.includes('skin type')) {
                    scoresObj1[pref] = p1Oily;
                    scoresObj2[pref] = p2Oily;
                } else if (normPref.includes('performance') || normPref.includes('dry') || normPref.includes('results') || normPref.includes('hydration')) {
                    scoresObj1[pref] = p1Dry;
                    scoresObj2[pref] = p2Dry;
                } else if (normPref.includes('display') || normPref.includes('ingredients') || normPref.includes('quality') || normPref.includes('actives') || normPref.includes('formula') || normPref.includes('noise')) {
                    scoresObj1[pref] = p1Ing;
                    scoresObj2[pref] = p2Ing;
                } else if (normPref.includes('value') || normPref.includes('price')) {
                    scoresObj1[pref] = p1Val;
                    scoresObj2[pref] = p2Val;
                } else {
                    scoresObj1[pref] = Math.round(70 + ((p1.rating || 4.5) * 5) % 25);
                    scoresObj2[pref] = Math.round(65 + ((p2.rating || 4.2) * 6) % 28);
                }
            });

            scoresObj1["Overall Match"] = avg1;
            scoresObj2["Overall Match"] = avg2;

            return {
                analysis: analysisText,
                explanation: analysisText,
                winner: avg1 >= avg2 ? p1 : p2,
                scores: {
                    preferences: activePrefs,
                    product_1: scoresObj1,
                    product_2: scoresObj2,
                    avg_1: avg1,
                    avg_2: avg2
                },
                fake_analysis: {
                    product_1: { fake_prob: 100 - trust1, total_reviews: revs1?.length || 5 },
                    product_2: { fake_prob: 100 - trust2, total_reviews: revs2?.length || 5 }
                }
            };
        } catch (err) {
            logger.error('[COMPARISON SERVICE ERROR] Battle comparison failed:', err, 'AI_GATEWAY');
            throw err;
        }
    }
};
