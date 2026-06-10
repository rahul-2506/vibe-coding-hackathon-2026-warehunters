import { recommendationService } from '../services/gateway/recommendationService.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

async function verifyRecommendations() {
    console.log("------------------------------------------------------------------");
    console.log("🚀 RECOMMENDATION ENGINE DIAGNOSTICS & VERIFICATION");
    console.log("------------------------------------------------------------------");

    // Test case 1: AI/Heuristics query matching "acne"
    const prompt1 = "Verify if Mamaearth Ubtan facewash is good for active acne";
    console.log(`\n🔍 Querying recommendation service with prompt: "${prompt1}"...`);
    const results1 = await recommendationService.getAIRecommendations(prompt1);
    
    console.log(`Found ${results1.length} recommendations:`);
    results1.forEach((p, idx) => {
        console.log(`  [Rank ${idx+1}] ID: ${p.id} | Name: "${p.name}" | Price: ₹${p.price} | Match: ${p.matchScore}% | Explanation: "${p.explanation}"`);
        if (p.relativityTags) {
            console.log(`     Tags: ${JSON.stringify(p.relativityTags)}`);
        }
    });

    // Test case 2: Empty or generic query
    const prompt2 = "";
    console.log(`\n🔍 Querying recommendation service with empty prompt...`);
    const results2 = await recommendationService.getAIRecommendations(prompt2);
    
    console.log(`Found ${results2.length} recommendations:`);
    results2.forEach((p, idx) => {
        console.log(`  [Rank ${idx+1}] ID: ${p.id} | Name: "${p.name}" | Price: ₹${p.price} | Match: ${p.matchScore}%`);
    });

    console.log("\n------------------------------------------------------------------");
    console.log("✅ RECOMMENDATION DIAGNOSTICS COMPLETE!");
    console.log("------------------------------------------------------------------");
}

verifyRecommendations().catch(err => {
    console.error("Test execution failed:", err);
});
