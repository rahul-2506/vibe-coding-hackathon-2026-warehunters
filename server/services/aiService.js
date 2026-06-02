import fetch from 'node-fetch';
import { logger } from '../utils/logger.js';
import { queryRAG } from './ragService.js';

export const aiService = {
    async getMLServiceUrl() {
        return process.env.ML_SERVICE_URL || 'http://localhost:8000';
    },

    async verifyAIHealth() {
        const mlServiceUrl = await this.getMLServiceUrl();
        const url = `${mlServiceUrl}/health`;
        try {
            logger.info(`[HEALTH CHECK] Probing Python ML Service health at: ${url}`, 'AI_BRIDGE');
            const res = await Promise.race([
                fetch(url, { method: 'GET' }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
            ]);
            if (res.ok) {
                const data = await res.json();
                logger.info(`[HEALTH CHECK] Python ML Service is ONLINE. Status: ${data.status}`, 'AI_BRIDGE');
                return true;
            }
            logger.warn(`[HEALTH CHECK] Python ML Service returned status ${res.status}`, 'AI_BRIDGE');
            return false;
        } catch (err) {
            logger.warn(`[HEALTH CHECK] Python ML Service is OFFLINE: ${err.message}`, 'AI_BRIDGE');
            return false;
        }
    },

    async ragChat(message, geminiKey = null, openaiKey = null) {
        const mlServiceUrl = await this.getMLServiceUrl();
        const url = `${mlServiceUrl}/rag_chat`;
        
        logger.info(`[CHAT REQUEST] Frontend initiated chatbot query: "${message}"`, 'AI_BRIDGE');
        
        let attempt = 0;
        const maxAttempts = 3;
        const backoffTimes = [500, 1000, 2000];
        const timeoutMs = 8000;
        
        while (attempt < maxAttempts) {
            attempt++;
            try {
                logger.info(`[CHAT REQUEST] Sending request to Python AI Server (Attempt ${attempt}/${maxAttempts})...`, 'AI_BRIDGE');
                
                const headers = { 'Content-Type': 'application/json' };
                if (geminiKey) headers['x-gemini-key'] = geminiKey;
                if (openaiKey) headers['x-openai-key'] = openaiKey;

                const responsePromise = fetch(url, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ message })
                });
                
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Request Timeout')), timeoutMs)
                );
                
                const pythonRes = await Promise.race([responsePromise, timeoutPromise]);
                
                if (!pythonRes.ok) {
                    throw new Error(`Python RAG Service returned status ${pythonRes.status}`);
                }
                
                const data = await pythonRes.json();
                logger.info(`[CHAT RESPONSE] Successfully received response from Python AI Server: "${data.response ? data.response.substring(0, 80) : ''}..."`, 'AI_BRIDGE');
                
                return {
                    response: data.response || data.reply,
                    reply: data.reply || data.response
                };
                
            } catch (err) {
                logger.error(`[CHAT REQUEST ERROR] Attempt ${attempt} failed: ${err.message}`, err, 'AI_BRIDGE');
                
                if (attempt >= maxAttempts) {
                    logger.warn(`[CHAT FALLBACK] All ${maxAttempts} attempts to Python AI server failed. Redirecting query to local Node.js RAG Engine.`, 'AI_BRIDGE');
                    return await this.localFallback(message, err.message);
                }
                
                const delay = backoffTimes[attempt - 1];
                logger.warn(`[RETRY] Attempt ${attempt} failed. Retrying in ${delay}ms...`, 'AI_BRIDGE');
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    },

    async localFallback(message, reason) {
        try {
            logger.info(`[LOCAL RAG] Initializing local synthesis backup (Reason: ${reason})...`, 'AI_BRIDGE');
            const localResponse = await queryRAG(message);
            logger.info(`[LOCAL RAG SUCCESS] Local RAG synthesis completed successfully.`, 'AI_BRIDGE');
            return {
                response: localResponse,
                reply: localResponse
            };
        } catch (fallbackErr) {
            logger.error(`[FATAL FALLBACK ERROR] Local RAG engine failed: ${fallbackErr.message}`, fallbackErr, 'AI_BRIDGE');
            return {
                response: "🔬 **V-CHAT Skincare Intelligence:** I am currently running in safety mode. For optimal results, check our active ingredients (like Salicylic Acid, Neem, or Ubtan) or refresh the catalog view.",
                reply: "🔬 **V-CHAT Skincare Intelligence:** I am currently running in safety mode. For optimal results, check our active ingredients (like Salicylic Acid, Neem, or Ubtan) or refresh the catalog view."
            };
        }
    },

    async compareProducts(product1, product2, geminiKey = null, openaiKey = null) {
        const mlServiceUrl = await this.getMLServiceUrl();
        const url = `${mlServiceUrl}/compare_analysis`;
        
        logger.info(`[COMPARE REQUEST] Frontend initiated comparison analysis...`, 'AI_BRIDGE');
        
        let attempt = 0;
        const maxAttempts = 3;
        const backoffTimes = [500, 1000, 2000];
        const timeoutMs = 8000;
        
        while (attempt < maxAttempts) {
            attempt++;
            try {
                const headers = { 'Content-Type': 'application/json' };
                if (geminiKey) headers['x-gemini-key'] = geminiKey;
                if (openaiKey) headers['x-openai-key'] = openaiKey;

                const responsePromise = fetch(url, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ product1, product2 })
                });
                
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Request Timeout')), timeoutMs)
                );
                
                const pythonRes = await Promise.race([responsePromise, timeoutPromise]);
                
                if (!pythonRes.ok) {
                    throw new Error(`Python Compare service returned status ${pythonRes.status}`);
                }
                
                const data = await pythonRes.json();
                logger.info(`[COMPARE RESPONSE] Successfully received product comparison from Python AI server.`, 'AI_BRIDGE');
                return data;
            } catch (err) {
                logger.error(`[COMPARE REQUEST ERROR] Attempt ${attempt} failed: ${err.message}`, err, 'AI_BRIDGE');
                if (attempt >= maxAttempts) {
                    logger.warn(`[COMPARE FALLBACK] All ${maxAttempts} attempts failed. Product comparison failed. Returning structural offline fallback analysis.`, 'AI_BRIDGE');
                    return {
                        analysis: `⚖️ **NEURAL COMPARISON MODE ENABLED (Offline Fallback)**\n\n` +
                                  `Unable to contact the AI comparative service. Below is the structural summary of products:\n\n` +
                                  `*   **Product 1:** ${product1.title || product1.name || 'Unknown Product'}\n` +
                                  `*   **Product 2:** ${product2.title || product2.name || 'Unknown Product'}\n\n` +
                                  `🤖 *Please verify the FastAPI server status on port 8000 to enable detailed deep clinical comparisons.*`
                    };
                }
                
                const delay = backoffTimes[attempt - 1];
                logger.warn(`[RETRY] Attempt ${attempt} failed. Retrying in ${delay}ms...`, 'AI_BRIDGE');
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    },

    async scrapePrice(productName) {
        const mlServiceUrl = await this.getMLServiceUrl();
        const url = `${mlServiceUrl}/scrape_price`;
        
        logger.info(`[SCRAPER REQUEST] Scraping live price for: "${productName}"`, 'AI_BRIDGE');
        
        let attempt = 0;
        const maxAttempts = 3;
        const backoffTimes = [500, 1000, 2000];
        const timeoutMs = 8000;
        
        while (attempt < maxAttempts) {
            attempt++;
            try {
                const responsePromise = fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ product_name: productName })
                });
                
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Request Timeout')), timeoutMs)
                );
                
                const pythonRes = await Promise.race([responsePromise, timeoutPromise]);
                
                if (!pythonRes.ok) {
                    throw new Error(`Python Scraper returned status ${pythonRes.status}`);
                }
                
                const data = await pythonRes.json();
                logger.info(`[SCRAPER RESPONSE] Scraped listings successfully for: "${productName}"`, 'AI_BRIDGE');
                return data;
            } catch (err) {
                logger.error(`[SCRAPER REQUEST ERROR] Attempt ${attempt} failed: ${err.message}`, err, 'AI_BRIDGE');
                if (attempt >= maxAttempts) {
                    logger.warn(`[SCRAPER FALLBACK] All ${maxAttempts} attempts failed. Price scraping failed. Returning static retail listings.`, 'AI_BRIDGE');
                    return {
                        product_name: productName,
                        listings: [
                            {"price": 285.00, "source": "Nykaa Skincare Center (Direct)", "snippet": "Standard retail pricing for premium skincare facewashes."},
                            {"price": 299.00, "source": "Amazon Skincare Hub", "snippet": "Immediate shipping with standard Prime delivery options."}
                        ]
                    };
                }
                
                const delay = backoffTimes[attempt - 1];
                logger.warn(`[RETRY] Attempt ${attempt} failed. Retrying in ${delay}ms...`, 'AI_BRIDGE');
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    },

    async generateFake(product_id, product_name, tone) {
        const mlServiceUrl = await this.getMLServiceUrl();
        const url = `${mlServiceUrl}/api/analytics/generate-fake`;
        
        logger.info(`[AI_SERVICE] Proxied POST request for generate-fake for product: "${product_name}"`, 'AI_BRIDGE');
        
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ product_id, product_name, tone })
            });
            if (!res.ok) throw new Error(`Python generate-fake returned status ${res.status}`);
            const data = await res.json();
            return data;
        } catch (err) {
            logger.error(`[AI_SERVICE] generate-fake failed: ${err.message}`, err, 'AI_BRIDGE');
            throw err;
        }
    },

    async predict(review) {
        const mlServiceUrl = await this.getMLServiceUrl();
        const url = `${mlServiceUrl}/predict`;
        
        logger.info(`[AI_SERVICE] Proxied POST request for predict`, 'AI_BRIDGE');
        
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ review })
            });
            if (!res.ok) throw new Error(`Python predict returned status ${res.status}`);
            const data = await res.json();
            return data;
        } catch (err) {
            logger.error(`[AI_SERVICE] predict failed: ${err.message}`, err, 'AI_BRIDGE');
            throw err;
        }
    },

    async scanIngredients(imageBase64) {
        const geminiKey = process.env.GEMINI_API_KEY;
        if (!geminiKey) {
            logger.warn('[AI SERVICE] GEMINI_API_KEY missing for scanIngredients. Returning mock report.', 'AI_BRIDGE');
            return this.getMockIngredientReport();
        }

        try {
            let mimeType = 'image/jpeg';
            let cleanBase64 = imageBase64;
            if (imageBase64.startsWith('data:')) {
                const match = imageBase64.match(/^data:([^;]+);base64,(.*)$/);
                if (match) {
                    mimeType = match[1];
                    cleanBase64 = match[2];
                }
            }

            const prompt = `You are a professional clinical skincare ingredient analyst.
Analyze this skincare product label image.
Perform OCR extraction to read all ingredients, then analyze their safety and efficacy.
Return a JSON object containing:
- "extractedText": (string) Complete text read from the label.
- "safetyScore": (number, 0-100) Overall safety and skin-health rating.
- "risks": An object containing:
  - "dry": (number, 0-100) Risk rating for dry skin types.
  - "acne": (number, 0-100) Comedogenic / acne trigger risk rating.
  - "irritation": (number, 0-100) Sensitization / redness / allergen risk rating.
- "benefits": (array of strings) Clinical skin benefits identified from the active ingredients.
- "flaggedIngredients": (array of objects) Harmful, synthetic, or highly comedogenic ingredients found. Each object has:
  - "name": (string) Ingredient name
  - "reason": (string) Hazard reason
Return ONLY a valid JSON object. Do NOT include markdown styling or outer wrapper blocks.`;

            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { text: prompt },
                            {
                                inlineData: {
                                    mimeType: mimeType,
                                    data: cleanBase64
                                }
                            }
                        ]
                    }],
                    generationConfig: {
                        responseMimeType: "application/json"
                    }
                })
            });

            if (!res.ok) {
                throw new Error(`Gemini API returned status ${res.status}`);
            }

            const rawData = await res.json();
            const textResponse = rawData.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!textResponse) {
                throw new Error("Empty response from Gemini model");
            }

            const parsedReport = JSON.parse(textResponse);
            return parsedReport;

        } catch (err) {
            logger.error(`[AI SERVICE] scanIngredients failed: ${err.message}`, err, 'AI_BRIDGE');
            return this.getMockIngredientReport();
        }
    },

    getMockIngredientReport() {
        return {
            extractedText: "INGREDIENTS: Aqua, Salicylic Acid, Glycerin, Niacinamide, Isopropyl Myristate, Fragrance, Parabens, Alcohol Denat.",
            safetyScore: 68,
            risks: {
                dry: 45,
                acne: 75,
                irritation: 60
            },
            benefits: [
                "Exfoliates pores (Salicylic Acid)",
                "Reduces hyperpigmentation and strengthens skin barrier (Niacinamide)",
                "Attracts moisture (Glycerin)"
            ],
            flaggedIngredients: [
                { name: "Isopropyl Myristate", reason: "Highly comedogenic agent that can clog pores and worsen acne." },
                { name: "Alcohol Denat.", reason: "Drying agent that strips natural oils and compromises dry skin barrier." },
                { name: "Parabens", reason: "Synthetic preservative associated with potential hormone disruption." }
            ]
        };
    }
};

