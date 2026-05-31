import { productService } from '../services/productService.js';

async function testSearch() {
    console.log("------------------------------------------------------------------");
    console.log("🚀 UPGRADED SEARCH ENGINE DIAGNOSTICS & VERIFICATION");
    console.log("------------------------------------------------------------------");
    
    // Test 1: Weighted multi-term search
    const query1 = "neem pure";
    console.log(`\n🔍 Searching for: "${query1}" (Expect highest score on pure neem brand products)...`);
    const results1 = await productService.searchProducts(query1);
    
    console.log(`Found ${results1.length} matching products.`);
    results1.slice(0, 3).forEach((p, idx) => {
        console.log(`  [Rank ${idx+1}] Title: "${p.title}" | Price: ₹${p.price} | Brand: ${p.brand} | Rating: ${p.rating}`);
    });

    // Test 2: Specificity term search (laptop gaming pc)
    const query2 = "laptop gaming pc";
    console.log(`\n🔍 Searching for: "${query2}" (Expect Electronics/Laptops category matches)...`);
    const results2 = await productService.searchProducts(query2);
    
    console.log(`Found ${results2.length} matching products.`);
    results2.slice(0, 3).forEach((p, idx) => {
        console.log(`  [Rank ${idx+1}] Title: "${p.title}" | Price: ₹${p.price} | Brand: ${p.brand} | Category: ${p.category}`);
    });

    // Test 3: Phrase match vs single term priority
    const query3 = "The Derma Co";
    console.log(`\n🔍 Searching for exact brand: "${query3}" (Expect highest matching brand)...`);
    const results3 = await productService.searchProducts(query3);
    
    console.log(`Found ${results3.length} matching products.`);
    results3.slice(0, 3).forEach((p, idx) => {
        console.log(`  [Rank ${idx+1}] Title: "${p.title}" | Price: ₹${p.price} | Brand: ${p.brand}`);
    });
    
    console.log("\n------------------------------------------------------------------");
    console.log("✅ SEARCH ENGINE DIAGNOSTICS COMPLETE!");
    console.log("------------------------------------------------------------------");
}

testSearch().catch(err => {
    console.error("Test execution failed:", err);
});
