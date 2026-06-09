import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const apiKey = process.env.GEMINI_API_KEY || process.env.AI_API_KEY;

async function listModels(apiVersion) {
    const url = `https://generativelanguage.googleapis.com/${apiVersion}/models?key=${apiKey}`;
    try {
        const res = await fetch(url);
        const status = res.status;
        const json = await res.json();
        console.log(`[${apiVersion}] ListModels status: ${status}`);
        if (status === 200 && json.models) {
            console.log('Available models:');
            json.models.forEach(m => {
                console.log(`  - Name: ${m.name}`);
                console.log(`    Supported methods: ${m.supportedGenerationMethods.join(', ')}`);
            });
        } else {
            console.log(`  Failed:`, JSON.stringify(json).substring(0, 300));
        }
    } catch (err) {
        console.error(`  Error: ${err.message}`);
    }
}

async function run() {
    await listModels('v1beta');
    console.log('----------------------------');
    await listModels('v1');
}

run();
