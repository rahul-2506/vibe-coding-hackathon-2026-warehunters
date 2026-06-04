import fetch from 'node-fetch';

/**
 * Service to generate 1536-dimensional vector embeddings for semantic search.
 * Supports OpenAI, Gemini (with zero padding to 1536), and a local fallback.
 */
export const embeddingService = {
    async generateEmbedding(text, geminiKey = null, openaiKey = null) {
        if (!text || typeof text !== 'string') {
            return new Array(1536).fill(0);
        }

        const apiKeyGemini = geminiKey || process.env.GEMINI_API_KEY || process.env.AI_API_KEY;
        const apiKeyOpenai = openaiKey || process.env.OPENAI_API_KEY;

        // 1. Try OpenAI if key is available
        if (apiKeyOpenai && !apiKeyOpenai.startsWith('gsk_')) {
            try {
                const res = await fetch('https://api.openai.com/v1/embeddings', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKeyOpenai}`
                    },
                    body: JSON.stringify({
                        model: 'text-embedding-3-small',
                        input: text.replace(/\n/g, ' ')
                    })
                });

                if (res.ok) {
                    const json = await res.json();
                    if (json.data && json.data[0] && json.data[0].embedding) {
                        return json.data[0].embedding;
                    }
                } else {
                    console.warn(`[Embedding Service] OpenAI API returned status ${res.status}: ${await res.text()}`);
                }
            } catch (err) {
                console.error('[Embedding Service] OpenAI embedding failed:', err.message);
            }
        }

        // 2. Try Gemini if key is available
        if (apiKeyGemini && !apiKeyGemini.startsWith('gsk_')) {
            try {
                const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKeyGemini}`;
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        content: { parts: [{ text }] }
                    })
                });

                if (res.ok) {
                    const json = await res.json();
                    if (json.embedding && json.embedding.values) {
                        const values = json.embedding.values;
                        // Pad 768-dimensional Gemini embedding to 1536 dimensions
                        const padded = new Array(1536).fill(0);
                        for (let i = 0; i < Math.min(values.length, 1536); i++) {
                            padded[i] = values[i];
                        }
                        return padded;
                    }
                } else {
                    console.warn(`[Embedding Service] Gemini API returned status ${res.status}: ${await res.text()}`);
                }
            } catch (err) {
                console.error('[Embedding Service] Gemini embedding failed:', err.message);
            }
        }

        // 3. Deterministic fallback (stable local/offline testing)
        // Generates a 1536-dimensional hash vector based on character frequencies
        const vector = new Array(1536).fill(0);
        const words = text.toLowerCase().split(/\s+/);
        
        // Populate vector slots using word hashes
        for (let i = 0; i < words.length; i++) {
            const word = words[i];
            if (word.length === 0) continue;
            
            let hash = 0;
            for (let j = 0; j < word.length; j++) {
                hash = (hash * 31 + word.charCodeAt(j)) & 0xffffffff;
            }
            
            // Map the hash to multiple vector indices to spread the signal
            for (let k = 0; k < 3; k++) {
                const idx = Math.abs((hash + k * 17) % 1536);
                vector[idx] += 1.0 / (k + 1);
            }
        }

        // Ensure character-level density if words are too short
        for (let i = 0; i < text.length; i++) {
            const charCode = text.charCodeAt(i);
            const idx = (i * 37) % 1536;
            vector[idx] += charCode / 255.0;
        }

        // Normalize the vector (so cosine similarity <=> distance is mathematically consistent)
        let sumSq = 0;
        for (let i = 0; i < 1536; i++) {
            sumSq += vector[i] * vector[i];
        }
        
        const norm = Math.sqrt(sumSq) || 1.0;
        for (let i = 0; i < 1536; i++) {
            vector[i] = vector[i] / norm;
        }

        return vector;
    }
};
