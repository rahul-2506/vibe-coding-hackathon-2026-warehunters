import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const apiKey = process.env.GEMINI_API_KEY || process.env.AI_API_KEY;

async function testEmbedding(model, apiVersion, dimensionality) {
    const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${model}:embedContent?key=${apiKey}`;
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content: { parts: [{ text: 'Hello world' }] },
                outputDimensionality: dimensionality
            })
        });
        const status = res.status;
        const text = await res.text();
        console.log(`[${apiVersion}] [${model}] (dim=${dimensionality}) status: ${status}`);
        if (status === 200) {
            const json = JSON.parse(text);
            if (json.embedding && json.embedding.values) {
                console.log(`  Success! Vector length: ${json.embedding.values.length}`);
                return true;
            }
        } else {
            console.log(`  Failed: ${text.substring(0, 150)}`);
        }
    } catch (err) {
        console.error(`  Error: ${err.message}`);
    }
    return false;
}

async function run() {
    await testEmbedding('gemini-embedding-2', 'v1', 1536);
    await testEmbedding('gemini-embedding-001', 'v1', 1536);
}

run();
