import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000/api/products';

async function verifyQuery(label, q, filterFn) {
    console.log(`\n==================================================`);
    console.log(`TEST: ${label} (Query: "${q}")`);
    console.log(`==================================================`);
    try {
        const url = `${BASE_URL}/search?q=${encodeURIComponent(q)}`;
        const res = await fetch(url);
        if (!res.ok) {
            console.error(`Error: Response returned status ${res.status}`);
            return;
        }
        const json = await res.json();
        const products = json.data?.products || [];
        
        console.log(`Returned ${products.length} products:`);
        products.slice(0, 8).forEach((p, idx) => {
            console.log(`[#${idx + 1}] Brand: ${p.brand}, Price: ₹${p.price}, Name: "${p.name}"`);
        });

        if (filterFn) {
            filterFn(products);
        }
    } catch (e) {
        console.error('Exception during fetch:', e.message);
    }
}

async function runTests() {
    // 1. laptop -> Dell, HP, Lenovo, Asus, Acer, MSI
    await verifyQuery('Intent Match: laptop', 'laptop', (products) => {
        const brands = new Set(products.map(p => (p.brand || '').toLowerCase()));
        const expected = ['dell', 'hp', 'lenovo', 'asus', 'acer', 'msi'];
        const matches = expected.filter(b => brands.has(b));
        console.log(`Matched expected laptop brands: ${matches.join(', ')} (out of ${expected.join(', ')})`);
    });

    // 2. phone -> Samsung, Apple, OnePlus, Nothing
    await verifyQuery('Intent Match: phone', 'phone', (products) => {
        const brands = new Set(products.map(p => (p.brand || '').toLowerCase()));
        const expected = ['samsung', 'apple', 'oneplus', 'nothing'];
        const matches = expected.filter(b => brands.has(b));
        console.log(`Matched expected phone brands: ${matches.join(', ')} (out of ${expected.join(', ')})`);
    });

    // 3. gaming laptop -> RTX laptops ranked top
    await verifyQuery('Intent Match: gaming laptop', 'gaming laptop', (products) => {
        console.log('Top 3 names:');
        products.slice(0, 3).forEach(p => {
            console.log(`- "${p.name}" (Specs/GPU: ${p.specifications?.GPU || p.features?.GPU || 'None'})`);
        });
        const allRTX = products.slice(0, 3).every(p => {
            const nameLower = p.name.toLowerCase();
            const gpuLower = (p.specifications?.GPU || p.features?.GPU || '').toLowerCase();
            return nameLower.includes('rtx') || gpuLower.includes('rtx') || nameLower.includes('gaming');
        });
        console.log(`Verification - Are top results gaming/RTX laptops? ${allRTX ? 'YES' : 'NO'}`);
    });

    // 4. best phone under 30000 -> actual products matching constraints
    await verifyQuery('Intent Match: best phone under 30000', 'best phone under 30000', (products) => {
        const allUnder30k = products.every(p => p.price <= 30000);
        const phones = products.filter(p => p.category === 'Electronics' && (p.subcategory === 'Smartphones' || p.name.toLowerCase().includes('phone') || p.name.toLowerCase().includes('iphone') || p.name.toLowerCase().includes('galaxy')));
        console.log(`Verification - Are all returned products <= ₹30,000? ${allUnder30k ? 'YES' : 'NO'}`);
        console.log(`Number of budget phones returned: ${phones.length}`);
    });
}

runTests();
