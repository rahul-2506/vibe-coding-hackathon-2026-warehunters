import fetch from 'node-fetch';

const API_URL = 'http://localhost:5000';

async function testRouteLockdown() {
    console.log('🛡️  VERIFYING PHASE 4 AUTHENTICATION ROUTE LOCKDOWNS\n');

    const securedEndpoints = [
        { name: 'Get User Feedback History', url: `${API_URL}/api/feedback/user/some-user-id`, method: 'GET' },
        { name: 'Get User Compare History', url: `${API_URL}/api/compare/history/some-user-id`, method: 'GET' },
        { name: 'Get User Saved Comparisons', url: `${API_URL}/api/compare/saved/some-user-id`, method: 'GET' }
    ];

    let allOk = true;
    for (const ep of securedEndpoints) {
        try {
            const start = Date.now();
            const res = await fetch(ep.url, { method: ep.method });
            const elapsed = Date.now() - start;

            console.log(`📡 Testing: [${ep.method}] ${ep.url}`);
            console.log(`   - HTTP Status Code: ${res.status} (Expected: 401)`);
            console.log(`   - Response Time: ${elapsed}ms`);

            if (res.status === 401) {
                const json = await res.json();
                console.log(`   - Response Body: ${JSON.stringify(json)}`);
                console.log(`   ✅ SUCCESS: Route is securely protected by authMiddleware.\n`);
            } else {
                console.log(`   ❌ FAILURE: Expected 401 Unauthorized but received ${res.status}.\n`);
                allOk = false;
            }
        } catch (err) {
            console.log(`   ❌ Connection Error: ${err.message}. Is the Express server running?\n`);
            allOk = false;
        }
    }

    if (allOk) {
        console.log('✨ All route locks verified successfully!');
    } else {
        console.log('⚠️ Some route locks failed validation checks.');
    }
}

testRouteLockdown().catch(err => {
    console.error('Fatal test error:', err);
});
