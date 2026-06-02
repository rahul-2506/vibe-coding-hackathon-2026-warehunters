import { buildMegaCatalog } from '../services/productService.js';

try {
    console.log("=== Testing Skincare Subcategories deterministic mapping ===");
    const catalog = buildMegaCatalog();
    const skincare = catalog.filter(p => p.category === 'Skincare & Beauty');
    
    console.log(`Total generated products: ${catalog.length}`);
    console.log(`Skincare & Beauty products: ${skincare.length}`);
    
    const subcatCounts = {};
    skincare.forEach(p => {
        subcatCounts[p.subcategory] = (subcatCounts[p.subcategory] || 0) + 1;
    });
    
    console.log("\nSubcategories generated under Skincare & Beauty:");
    console.log(JSON.stringify(subcatCounts, null, 2));
    
    // Validate that all subcategories are filled
    const expected = ['Face Wash', 'Sunscreen', 'Moisturizer', 'Serum', 'Toner', 'Masks & Scrubs', 'Others'];
    const missing = expected.filter(cat => !subcatCounts[cat]);
    
    if (missing.length === 0) {
        console.log("\n✅ SUCCESS: All expected subcategories successfully generated!");
    } else {
        console.error(`\n❌ FAILED: Missing subcategories: ${missing.join(', ')}`);
    }
} catch (err) {
    console.error("Error executing backend subcategory tests:", err);
}
